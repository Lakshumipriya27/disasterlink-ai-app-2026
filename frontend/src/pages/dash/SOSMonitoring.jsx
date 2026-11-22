import { FileAudio, FileVideo, MapPin, RefreshCw, Siren } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Marker } from 'react-leaflet'
import { Link } from 'react-router-dom'
import MapView, { pinIcon } from '../../components/MapView'
import { Alert, Badge, Button, CachedBanner, Card, EmptyState, ErrorState, KeyValue, Loading, PageHeader, Select, StatusBadge, Tabs, Textarea, cx } from '../../components/ui'
import { api, apiBlob, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { CATEGORIES } from '../../lib/constants'
import { bytes, fmtDate, timeAgo } from '../../lib/format'

function MediaItem({ m }) {
  const [url, setUrl] = useState(null)
  const [err, setErr] = useState('')
  const load = async () => { try { setUrl(URL.createObjectURL(await apiBlob(m.url))) } catch (e) { setErr(e.message) } }
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">{m.kind === 'video' ? <FileVideo className="w-4 h-4 text-blue-600" /> : <FileAudio className="w-4 h-4 text-blue-600" />}{m.kind} · {bytes(m.size_bytes)}{m.duration_s ? ` · ${m.duration_s}s` : ''}</span>
        {!url && <Button size="sm" variant="secondary" onClick={load}>Load</Button>}
      </div>
      {url && (m.kind === 'video' ? <video src={url} controls className="mt-2 w-full rounded-lg bg-slate-900 max-h-64" /> : <audio src={url} controls className="mt-2 w-full" />)}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  )
}

export default function SOSMonitoring() {
  const { isStaff } = useAuth()
  const [tab, setTab] = useState('open')
  const { data, loading, error, reload, fromCache, savedAt } = useApi('/api/sos', { cache: true })
  const [sel, setSel] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  useEffect(() => { const t = setInterval(() => reload(true), 15000); return () => clearInterval(t) }, [reload])
  const list = (data || []).filter((s) => (tab === 'open' ? !['assisted', 'closed'].includes(s.assistance_status) : true))
  const cur = (data || []).find((s) => s.id === sel) || list[0]
  useEffect(() => { setNotes(cur?.coordinator_notes || ''); setMsg(null) }, [cur?.id]) // eslint-disable-line

  const update = async (body) => {
    setBusy(true); setMsg(null)
    try { await api(`/api/sos/${cur.id}`, { method: 'PATCH', body }); await reload(true); setMsg({ tone: 'green', text: 'Updated' }) }
    catch (e) { setMsg({ tone: 'red', text: e.message }) } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="SOS Monitoring" subtitle="One-touch SOS alerts. Auto-refreshes every 15 seconds." actions={<Button variant="secondary" icon={RefreshCw} onClick={() => reload()}>Refresh</Button>} />
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'open', label: 'Open', count: (data || []).filter((s) => !['assisted', 'closed'].includes(s.assistance_status)).length }, { value: 'all', label: 'All', count: (data || []).length }]} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : list.length === 0 ? <Card><EmptyState icon={Siren} title="No SOS alerts in this view" /></Card> : (
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-2 max-h-[75vh] overflow-y-auto scrollbar-thin pr-1">
            {list.map((s) => (
              <button key={s.id} onClick={() => setSel(s.id)} className={cx('card w-full text-left p-4 transition', cur?.id === s.id ? 'ring-2 ring-red-300' : 'hover:shadow-lift')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><span className={cx('w-2.5 h-2.5 rounded-full', s.assistance_status === 'awaiting_response' ? 'bg-red-600 animate-pulse' : 'bg-slate-300')} /><span className="font-mono text-sm font-semibold">{s.id}</span></span>
                  <StatusBadge status={s.assistance_status} />
                </div>
                <p className="text-sm text-slate-700 mt-2">{s.categories.map((c) => CATEGORIES[c]?.label || c).join(', ')}{s.silent && ' · Silent'}</p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3 h-3" />{s.area || (s.location_status === 'captured' ? 'GPS' : `Location ${s.location_status}`)} · {timeAgo(s.created_at)}
                  {s.media.length > 0 && <Badge tone="blue" className="ml-1">{s.media.length} media</Badge>}{s.synced_from_offline && <Badge tone="cyan" className="ml-1">offline</Badge>}{s.is_simulated && <Badge tone="purple" className="ml-1">SIM</Badge>}</p>
              </button>
            ))}
          </div>
          {cur && (
            <div className="lg:col-span-3 space-y-4">
              <Card title={`SOS ${cur.id}`} subtitle={`Received ${fmtDate(cur.created_at)}`}>
                <KeyValue items={[
                  ['Emergency categories', cur.categories.map((c) => CATEGORIES[c]?.label || c).join(', ')],
                  ['Mode', cur.silent ? 'Silent SOS' : 'Standard'],
                  ['Location', cur.lat != null ? `${cur.lat}, ${cur.lng}${cur.accuracy_m ? ` (±${Math.round(cur.accuracy_m)} m)` : ''}` : `Not available (${cur.location_status})`],
                  ['Area', cur.area || '—'], ['Accessibility needs', cur.accessibility_needs.join(', ') || 'None stated'],
                  ['Verification', <StatusBadge key="v" status={cur.verification_status} />], ['Assistance', <StatusBadge key="a" status={cur.assistance_status} />],
                  cur.device_created_at && ['Created on device', fmtDate(cur.device_created_at)],
                  cur.request_id && ['Linked request', <Link key="l" className="text-blue-600 hover:underline" to={`/app/requests?id=${cur.request_id}`}>{cur.request_id}</Link>],
                ]} />
                {cur.lat != null && <div className="mt-4 rounded-xl overflow-hidden border border-slate-200"><MapView height={220} center={[cur.lat, cur.lng]} zoom={14}><Marker position={[cur.lat, cur.lng]} icon={pinIcon('#dc2626', 28, 'SOS')} /></MapView></div>}
              </Card>
              <Card title="Media attachments" subtitle="Only uploaded recordings appear here">
                {cur.media.length === 0 ? <p className="text-sm text-slate-500">No media attached.</p> : <div className="space-y-2">{cur.media.map((m) => <MediaItem key={m.id} m={m} />)}</div>}
              </Card>
              {isStaff ? (
                <Card title="Coordinator actions">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Select aria-label="Verification" value={cur.verification_status} onChange={(e) => update({ verification_status: e.target.value })} disabled={busy}>
                      <option value="unverified">Unverified</option><option value="verified">Verified</option><option value="false_alarm">False alarm</option>
                    </Select>
                    <Select aria-label="Assistance status" value={cur.assistance_status} onChange={(e) => update({ assistance_status: e.target.value })} disabled={busy}>
                      {['awaiting_response', 'acknowledged', 'team_dispatched', 'assisted', 'closed'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </Select>
                  </div>
                  <Textarea className="mt-3" rows={3} aria-label="Coordinator notes" placeholder="Coordinator notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  <Button className="mt-2" size="sm" loading={busy} onClick={() => update({ coordinator_notes: notes })}>Save notes</Button>
                  {msg && <Alert tone={msg.tone} className="mt-3">{msg.text}</Alert>}
                </Card>
              ) : <Alert tone="gray">Read-only. Coordinators update SOS status.</Alert>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
