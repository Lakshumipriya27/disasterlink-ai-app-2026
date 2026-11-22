// Offline-first synchronisation engine.
// Every request/SOS is first saved to the IndexedDB outbox ("save first, then send"), then uploaded.
// Status shown in the UI always reflects what actually happened; an item is "synced" only after the
// server responded with an ID. Unique client IDs make retries idempotent (no duplicate uploads).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { deviceId, mediaAll, mediaPut, metaGet, metaSet, outboxAll, outboxGet, outboxPut } from './db'

const SyncCtx = createContext(null)

export function SyncProvider({ children }) {
  const [online, setOnline] = useState(navigator.onLine)
  const [backend, setBackend] = useState(null) // true | false | null(unknown)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(null)
  const [lastError, setLastError] = useState(null)
  const [items, setItems] = useState([])
  const [media, setMedia] = useState([])
  const running = useRef(false)

  const refresh = useCallback(async () => {
    const [o, m] = await Promise.all([outboxAll(), mediaAll()])
    o.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    setItems(o); setMedia(m)
    return o
  }, [])

  const checkBackend = useCallback(async () => {
    if (!navigator.onLine) { setBackend(false); return false }
    try { await api('/api/health', { timeout: 5000, auth: false }); setBackend(true); return true }
    catch { setBackend(false); return false }
  }, [])

  const uploadMedia = async (outbox) => {
    const all = await mediaAll()
    let failed = 0
    for (const m of all) {
      if (m.status === 'uploaded') continue
      const owner = outbox.find((o) => o.client_id === m.owner_client_id)
      if (!owner || owner.status !== 'synced' || !owner.server_id) continue
      const form = new FormData()
      const ext = m.mime.includes('mp4') ? 'mp4' : m.mime.includes('ogg') ? 'ogg' : 'webm'
      form.append('file', new File([m.blob], `${m.kind}-${m.client_id}.${ext}`, { type: m.mime }))
      form.append('owner_type', owner.type === 'sos' ? 'sos' : 'request')
      form.append('owner_id', owner.server_id)
      form.append('kind', m.kind)
      form.append('client_id', m.client_id)
      if (m.duration_s) form.append('duration_s', String(m.duration_s))
      try {
        const res = await api('/api/media/upload', { method: 'POST', form, timeout: 120000, auth: false })
        await mediaPut({ ...m, status: 'uploaded', server_id: res.id, error: null, uploaded_at: new Date().toISOString() })
      } catch (e) {
        failed++
        await mediaPut({ ...m, status: 'failed', error: e.message })
      }
    }
    return failed
  }

  const syncNow = useCallback(async () => {
    if (running.current) return { skipped: true }
    running.current = true
    setSyncing(true)
    setLastError(null)
    try {
      if (!navigator.onLine) throw new Error('Device is offline. Items stay saved on this device.')
      if (!(await checkBackend())) throw new Error('Server is not reachable. Will retry automatically.')
      let outbox = await outboxAll()
      const pending = outbox.filter((i) => i.status === 'pending' || i.status === 'failed' || i.status === 'syncing')
      if (pending.length) {
        for (const p of pending) await outboxPut({ ...p, status: 'syncing' })
        await refresh()
        let res
        try {
          res = await api('/api/sync/batch', {
            method: 'POST', auth: false, timeout: 30000,
            body: {
              device_id: await deviceId(),
              items: pending.map((p) => ({ client_id: p.client_id, type: p.type, payload: p.payload, device_created_at: p.created_at })),
            },
          })
        } catch (e) {
          for (const p of pending) await outboxPut({ ...p, status: 'failed', attempts: (p.attempts || 0) + 1, last_error: e.message })
          throw e
        }
        const now = new Date().toISOString()
        for (const r of res.results) {
          const p = pending.find((x) => x.client_id === r.client_id)
          if (!p) continue
          if (r.status === 'created' || r.status === 'already_synced') {
            await outboxPut({ ...p, status: 'synced', server_id: r.entity_id, server_request_id: r.request_id || null,
              synced_at: now, attempts: (p.attempts || 0) + 1, last_error: null, server_result: r.status })
          } else {
            await outboxPut({ ...p, status: r.status === 'rejected' ? 'rejected' : 'failed', attempts: (p.attempts || 0) + 1, last_error: r.error })
          }
        }
        outbox = await outboxAll()
      }
      const mediaFailed = await uploadMedia(outbox)
      const ts = new Date().toISOString()
      setLastSync(ts); await metaSet('last_sync', ts)
      const after = await refresh()
      const stillFailed = after.filter((i) => i.status === 'failed').length
      if (stillFailed || mediaFailed) setLastError(`${stillFailed} item(s) and ${mediaFailed} attachment(s) failed - will retry.`)
      return { ok: true, synced: pending.length }
    } catch (e) {
      setLastError(e.message)
      await refresh()
      return { ok: false, error: e.message }
    } finally {
      running.current = false
      setSyncing(false)
    }
  }, [checkBackend, refresh])

  /** Save an item to the outbox, then try to send it immediately. Returns the stored item after the attempt. */
  const enqueue = useCallback(async (type, payload, extra = {}) => {
    const item = {
      client_id: payload.client_id, type, payload, status: 'pending', attempts: 0,
      created_at: new Date().toISOString(), ...extra,
    }
    await outboxPut(item)
    await refresh()
    if (navigator.onLine) await syncNow()
    return outboxGet(item.client_id)
  }, [refresh, syncNow])

  useEffect(() => {
    refresh()
    metaGet('last_sync').then((v) => v && setLastSync(v))
    checkBackend()
    const on = () => { setOnline(true); syncNow() }
    const off = () => { setOnline(false); setBackend(false) }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    const t = setInterval(async () => {
      const o = await outboxAll()
      const m = await mediaAll()
      const hasWork = o.some((i) => ['pending', 'failed', 'syncing'].includes(i.status)) || m.some((x) => x.status !== 'uploaded')
      if (navigator.onLine && hasWork) syncNow()
      else if (navigator.onLine) checkBackend()
    }, 20000)
    if (navigator.onLine) setTimeout(() => syncNow(), 1500)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); clearInterval(t) }
  }, [refresh, syncNow, checkBackend])

  const pendingCount = items.filter((i) => ['pending', 'syncing', 'failed'].includes(i.status)).length
  const failedCount = items.filter((i) => i.status === 'failed' || i.status === 'rejected').length
  const pendingMedia = media.filter((m) => m.status !== 'uploaded').length
  let status = 'online'
  if (!online) status = 'offline'
  else if (syncing) status = 'syncing'
  else if (lastError || backend === false) status = 'failed'

  return (
    <SyncCtx.Provider value={{ online, backend, syncing, lastSync, lastError, items, media, pendingCount, failedCount,
      pendingMedia, status, syncNow, enqueue, refresh, checkBackend }}>
      {children}
    </SyncCtx.Provider>
  )
}

export const useSync = () => useContext(SyncCtx)
