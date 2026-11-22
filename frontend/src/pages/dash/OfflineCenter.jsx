import { CheckCircle2, CloudOff, Database, HardDrive, Map, RefreshCw, Share2, Trash2, Wifi } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { cachedTileCount } from '../../components/MapView'
import { Alert, Badge, Button, Card, EmptyState, PageHeader, StatCard, StatusBadge } from '../../components/ui'
import { useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { cacheAll, outboxDelete } from '../../lib/db'
import { bytes, fmtDate, timeAgo } from '../../lib/format'
import { useSync } from '../../lib/sync.jsx'

export default function OfflineCenter() {
  const s = useSync()
  const { isStaff } = useAuth()
  const [cache, setCache] = useState([])
  const [tiles, setTiles] = useState(null)
  const [swState, setSwState] = useState('checking')
  const [storage, setStorage] = useState(null)
  const records = useApi('/api/sync/records', { skip: !isStaff })
  useEffect(() => {
    cacheAll().then((c) => setCache(c.sort((a, b) => b.saved_at.localeCompare(a.saved_at)))).catch(() => {})
    cachedTileCount().then(setTiles)
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then((r) => setSwState(r?.active ? 'active' : 'not registered (use the production build: npm run build && npm run preview)'))
    else setSwState('not supported')
    navigator.storage?.estimate?.().then(setStorage).catch(() => {})
  }, [s.lastSync, s.online])

  const statusText = { online: 'Online', offline: 'Offline', syncing: 'Synchronizing', failed: 'Synchronization failed' }[s.status]
  return (
    <div>
      <PageHeader title="Offline Center" subtitle="Real status of this device's offline queue, cached data and synchronisation."
        actions={<Button icon={RefreshCw} onClick={() => s.syncNow()} loading={s.syncing} disabled={!s.online}>SYNC NOW</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Connection" value={statusText} icon={s.online ? Wifi : CloudOff} tone={s.status === 'online' ? 'green' : s.status === 'failed' ? 'orange' : s.status === 'syncing' ? 'blue' : 'gray'} hint={s.backend === false && s.online ? 'Server unreachable' : s.backend ? 'Server reachable' : ''} />
        <StatCard label="Pending items" value={s.pendingCount} icon={HardDrive} tone={s.pendingCount ? 'orange' : 'green'} hint={`${s.failedCount} failed/rejected`} />
        <StatCard label="Pending attachments" value={s.pendingMedia} icon={Database} tone={s.pendingMedia ? 'orange' : 'green'} />
        <StatCard label="Last successful sync" value={s.lastSync ? timeAgo(s.lastSync) : 'Never'} icon={CheckCircle2} tone="cyan" hint={s.lastSync ? fmtDate(s.lastSync) : ''} />
        <StatCard label="Cached map tiles" value={tiles ?? '—'} icon={Map} tone="navy" hint="Tiles you have viewed" />
      </div>
      {s.lastError && <Alert tone="orange" className="mb-4">{s.lastError}</Alert>}
      <div className="grid xl:grid-cols-3 gap-6">
        <Card title="Device outbox" subtitle="Requests and SOS alerts created on this device" className="xl:col-span-2" bodyClass="p-0">
          {s.items.length === 0 ? <EmptyState title="Outbox is empty" message="Items submitted from this browser appear here with their real delivery status." /> : (
            <div className="overflow-x-auto"><table className="table-base">
              <thead><tr><th>Item</th><th>Created</th><th>Status</th><th>Server ID</th><th>Attempts</th><th /></tr></thead>
              <tbody>{s.items.map((i) => (
                <tr key={i.client_id}>
                  <td><p className="font-medium text-slate-800">{i.type === 'sos' ? 'SOS alert' : 'Request'}{i.relayed && <Badge tone="cyan" className="ml-2">relayed</Badge>}</p><p className="text-xs text-slate-500 line-clamp-1 max-w-xs">{i.payload.description || (i.payload.categories || []).join(', ')}</p><p className="text-[10px] font-mono text-slate-400">{i.client_id}</p></td>
                  <td className="text-xs whitespace-nowrap">{fmtDate(i.created_at)}</td>
                  <td><StatusBadge status={i.status === 'pending' ? (s.online ? 'pending' : 'offline') : i.status} />{i.last_error && <p className="text-[11px] text-orange-700 mt-1 max-w-[200px]">{i.last_error}</p>}</td>
                  <td className="font-mono text-xs">{i.server_id || '—'}{i.server_result === 'already_synced' && <span className="block text-[10px] text-slate-500 font-sans">duplicate upload prevented</span>}</td>
                  <td className="tabular-nums">{i.attempts || 0}</td>
                  <td>{(i.status === 'synced' || i.status === 'rejected') && <button className="p-1.5 rounded hover:bg-slate-100" aria-label="Remove from device" title="Remove from this device" onClick={async () => { await outboxDelete(i.client_id); s.refresh() }}><Trash2 className="w-4 h-4 text-slate-400" /></button>}</td>
                </tr>))}</tbody>
            </table></div>
          )}
          {s.media.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-navy-800 mb-2">Attachments queue</p>
              <ul className="space-y-1 text-sm">{s.media.map((m) => <li key={m.client_id} className="flex items-center justify-between"><span>{m.kind} · {bytes(m.size)} · {m.duration_s}s</span><Badge tone={m.status === 'uploaded' ? 'green' : m.status === 'failed' ? 'orange' : 'gray'}>{m.status === 'uploaded' ? 'Uploaded' : m.status === 'failed' ? `Failed: ${m.error}` : 'Waiting for parent record to sync'}</Badge></li>)}</ul>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="This device" bodyClass="p-4 text-sm space-y-2">
            <p>Service worker (app shell cache): <strong>{swState}</strong></p>
            {storage && <p>Storage used: <strong>{bytes(storage.usage || 0)}</strong> of ~{bytes(storage.quota || 0)}</p>}
            <p className="text-xs text-slate-500">Cached API responses ({cache.length}) let you view previously loaded dashboards offline; they are always labelled with their save time.</p>
            <ul className="text-xs text-slate-600 max-h-48 overflow-y-auto scrollbar-thin divide-y divide-slate-100">{cache.map((c) => <li key={c.key} className="py-1 flex justify-between gap-2"><span className="font-mono truncate">{c.key}</span><span className="text-slate-400 whitespace-nowrap">{timeAgo(c.saved_at)}</span></li>)}</ul>
          </Card>
          <Card title="How offline mode works" bodyClass="p-4 text-sm text-slate-600 space-y-2">
            <ol className="list-decimal pl-5 space-y-1">
              <li>Every request/SOS is saved to IndexedDB first, with a unique client ID.</li>
              <li>When online, the app checks <code>/api/health</code>, then uploads the queue to <code>/api/sync/batch</code>.</li>
              <li>The server records each client ID; re-sending returns the existing record, so retries never create duplicates.</li>
              <li>Attachments upload after their parent record is on the server.</li>
              <li>Failed items retry automatically every 20 s and whenever the browser goes back online.</li>
            </ol>
            <p className="text-xs text-slate-500">Separate offline devices cannot exchange data automatically. Use the <Link className="text-blue-600 hover:underline" to="/relay"><Share2 className="inline w-3 h-3" /> relay file</Link> for manual store-and-forward.</p>
          </Card>
        </div>
      </div>
      {isStaff && (
        <Card title="Server synchronisation log" className="mt-6" bodyClass="p-0">
          {!records.data ? <p className="p-5 text-sm text-slate-500">{records.error ? records.error.message : 'Loading…'}</p> : (
            <>
              <div className="px-5 py-3 text-sm text-slate-600 border-b border-slate-100">{records.data.offline_requests} requests and {records.data.offline_sos} SOS alerts arrived via offline sync · <strong>{records.data.duplicate_upload_attempts_blocked}</strong> duplicate upload attempts blocked by idempotency</div>
              <div className="overflow-x-auto max-h-80 overflow-y-auto scrollbar-thin"><table className="table-base"><thead><tr><th>Client ID</th><th>Type</th><th>Entity</th><th>Device time</th><th>Received</th><th>Attempts</th></tr></thead>
                <tbody>{records.data.records.map((r) => <tr key={r.client_id}><td className="font-mono text-[11px]">{r.client_id}</td><td>{r.entity_type}</td><td className="font-mono text-xs">{r.entity_id}</td><td className="text-xs">{fmtDate(r.device_created_at)}</td><td className="text-xs">{fmtDate(r.received_at)}</td><td className="tabular-nums">{r.attempts}</td></tr>)}</tbody></table></div>
            </>
          )}
        </Card>
      )}
    </div>
  )
}
