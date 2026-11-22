import { Bluetooth, Download, FileUp, Info, Share2, Wifi } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, Button, Card } from '../../components/ui'
import { outboxGet, outboxPut } from '../../lib/db'
import { useSync } from '../../lib/sync.jsx'

const FORMAT = 'disasterlink-relay-v1'

async function checksum(text) {
  if (!crypto?.subtle) return null
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default function Relay() {
  const sync = useSync()
  const [msg, setMsg] = useState(null)
  const pending = sync.items.filter((i) => i.status !== 'synced' && i.status !== 'rejected')
  const canShareFiles = typeof navigator.canShare === 'function'
  const webBluetooth = 'bluetooth' in navigator

  const buildFile = async () => {
    const items = pending.map(({ client_id, type, payload, created_at }) => ({ client_id, type, payload, created_at }))
    const body = JSON.stringify(items)
    const doc = { format: FORMAT, exported_at: new Date().toISOString(), count: items.length, sha256: await checksum(body), items }
    return new File([JSON.stringify(doc, null, 2)], `disasterlink-relay-${Date.now()}.json`, { type: 'application/json' })
  }
  const download = async () => {
    const file = await buildFile()
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click()
    setMsg({ tone: 'green', text: `Exported ${pending.length} pending item(s). Transfer this file to another device by any means available (Bluetooth file share, USB, local Wi-Fi).` })
  }
  const share = async () => {
    const file = await buildFile()
    if (!navigator.canShare({ files: [file] })) return setMsg({ tone: 'orange', text: 'This browser cannot share files. Use Download instead.' })
    try { await navigator.share({ files: [file], title: 'DisasterLink relay file' }); setMsg({ tone: 'green', text: 'Share sheet opened. Choose Bluetooth / Nearby Share to send it to a nearby device.' }) }
    catch (e) { if (e.name !== 'AbortError') setMsg({ tone: 'orange', text: `Share failed: ${e.message}` }) }
  }
  const importFile = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    try {
      const doc = JSON.parse(await file.text())
      if (doc.format !== FORMAT || !Array.isArray(doc.items)) throw new Error('Not a DisasterLink relay file.')
      const sum = await checksum(JSON.stringify(doc.items))
      if (doc.sha256 && sum && sum !== doc.sha256) throw new Error('File integrity check failed (checksum mismatch).')
      let added = 0, skipped = 0
      for (const it of doc.items) {
        if (!it.client_id || !['request', 'sos'].includes(it.type) || typeof it.payload !== 'object') { skipped++; continue }
        if (await outboxGet(it.client_id)) { skipped++; continue }
        await outboxPut({ client_id: it.client_id, type: it.type, payload: { ...it.payload, client_id: it.client_id }, status: 'pending', attempts: 0, created_at: it.created_at || new Date().toISOString(), relayed: true })
        added++
      }
      await sync.refresh()
      setMsg({ tone: 'green', text: `Imported ${added} item(s) into this device's outbox (${skipped} already present or invalid). They will be uploaded when this device is online. Duplicate uploads are prevented by their unique IDs.` })
      if (navigator.onLine && added) sync.syncNow()
    } catch (err) { setMsg({ tone: 'red', text: err.message }) }
  }

  return (
    <div className="bg-canvas">
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Offline relay (store &amp; forward)</h1>
          <p className="mt-2 text-slate-600">If one device has no connection but another nearby device will get online first, pending requests can be carried as a file and uploaded by the other device.</p>
        </div>
        <Alert tone="blue" icon={Info} title="What this does - and does not - do">This is a manual store-and-forward relay using a file. Browsers cannot create automatic Bluetooth or Wi-Fi Direct mesh networks, so devices do <strong>not</strong> exchange data automatically or instantly.</Alert>
        <Card title="Send pending items from this device" subtitle={`${pending.length} item(s) not yet delivered to the server`}>
          <div className="flex flex-wrap gap-2">
            <Button icon={Download} onClick={download} disabled={!pending.length}>Download relay file</Button>
            {canShareFiles && <Button variant="secondary" icon={Share2} onClick={share} disabled={!pending.length}>Share to nearby device</Button>}
          </div>
        </Card>
        <Card title="Receive items from another device" subtitle="Import a relay file; items join this device's outbox and upload when online.">
          <label className="inline-flex items-center gap-2 rounded-lg bg-blue-50 text-blue-700 px-3.5 py-2 text-sm font-medium cursor-pointer hover:bg-blue-100">
            <FileUp className="w-4 h-4" />Choose relay file<input type="file" accept="application/json,.json" className="sr-only" onChange={importFile} />
          </label>
        </Card>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <Card title="Native nearby-device communication (architecture prototype)" icon={Bluetooth}>
          <div className="space-y-3 text-sm text-slate-600">
            <p>Capability check on this browser: Web Bluetooth <Badge tone={webBluetooth ? 'green' : 'gray'}>{webBluetooth ? 'present' : 'not available'}</Badge> · File sharing <Badge tone={canShareFiles ? 'green' : 'gray'}>{canShareFiles ? 'available' : 'not available'}</Badge></p>
            <p>Web Bluetooth can only connect <em>to</em> a GATT peripheral; browsers cannot advertise as a peripheral or use Wi-Fi Direct, so true peer-to-peer relay requires a native app. The proposed native design (not implemented in this web build):</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li><Bluetooth className="inline w-3.5 h-3.5" /> Android/iOS companion app advertises a BLE service carrying only message <em>references</em> (client ID + hash).</li>
              <li>Nearby devices request missing items over a short-lived encrypted BLE/<Wifi className="inline w-3.5 h-3.5" /> Wi-Fi Direct channel and store them in their own outbox.</li>
              <li>Any device that reaches the internet uploads to <code>/api/sync/batch</code>; the server's client-ID idempotency guarantees each request is created once.</li>
              <li>Hop count and expiry limit flooding; payloads are signed so relays cannot alter them.</li>
            </ol>
          </div>
        </Card>
      </div>
    </div>
  )
}
