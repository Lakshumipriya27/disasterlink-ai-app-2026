import { CheckCircle2, Clock, CloudOff, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Alert, Badge, Button, Card, CategoryBadge, EmptyState, Input, StatusBadge, UrgencyBadge } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate, timeAgo } from '../../lib/format'
import { useSync } from '../../lib/sync.jsx'

export default function Track() {
  const [params] = useSearchParams()
  const [id, setId] = useState(params.get('id') || '')
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const sync = useSync()

  const lookup = async (rid = id) => {
    const q = rid.trim().toUpperCase()
    if (!q) return
    setBusy(true); setErr(''); setRes(null)
    try {
      setRes(q.startsWith('SOS-') ? { kind: 'sos', ...(await api(`/api/sos/track/${q}`, { auth: false })) }
        : { kind: 'request', ...(await api(`/api/requests/track/${q}`, { auth: false })) })
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  useEffect(() => { if (params.get('id')) lookup(params.get('id')) }, []) // eslint-disable-line

  return (
    <div className="bg-canvas min-h-[70vh]">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Track a request</h1>
        <p className="text-slate-600 mt-2">Enter your request ID (REQ-…) or SOS number (SOS-…). Only status information is shown - no personal details.</p>
        <form onSubmit={(e) => { e.preventDefault(); lookup() }} className="mt-6 flex gap-2">
          <Input aria-label="Request ID" value={id} onChange={(e) => setId(e.target.value)} placeholder="e.g. REQ-SIM005" className="!py-3 !text-base" />
          <Button type="submit" size="lg" icon={Search} loading={busy}>Track</Button>
        </form>
        {err && <Alert tone="orange" className="mt-4">{err}</Alert>}
        {res && (
          <Card className="mt-6" title={res.id} subtitle={`Submitted ${fmtDate(res.created_at)} · updated ${timeAgo(res.updated_at)}`}>
            {res.kind === 'request' ? (
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-slate-500">Category</p><div className="mt-1"><CategoryBadge category={res.category} /></div></div>
                <div><p className="text-xs text-slate-500">Status</p><div className="mt-1"><StatusBadge status={res.status} /></div></div>
                <div><p className="text-xs text-slate-500">Verification</p><div className="mt-1"><StatusBadge status={res.verification_status} /></div></div>
                <div><p className="text-xs text-slate-500">Priority</p><div className="mt-1"><UrgencyBadge level={res.urgency} /></div></div>
                <div><p className="text-xs text-slate-500">Area</p><p className="mt-1 font-medium">{res.area || '—'}</p></div>
                {res.synced_from_offline && <div><Badge tone="cyan">Submitted offline, synchronised</Badge></div>}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-slate-500">Assistance status</p><div className="mt-1"><StatusBadge status={res.assistance_status} /></div></div>
                <div><p className="text-xs text-slate-500">Verification</p><div className="mt-1"><StatusBadge status={res.verification_status} /></div></div>
              </div>
            )}
          </Card>
        )}
        <Card className="mt-8" title="Submitted from this device" subtitle="Stored in this browser. Status shows whether each item actually reached the server.">
          {sync.items.length === 0 ? <EmptyState title="Nothing submitted from this device yet" /> : (
            <ul className="divide-y divide-slate-100 -my-2">
              {sync.items.map((i) => (
                <li key={i.client_id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{i.type === 'sos' ? 'SOS alert' : (i.payload.description || '').slice(0, 70)}</p>
                    <p className="text-xs text-slate-500">{fmtDate(i.created_at)} · {i.server_id ? <span className="font-mono">{i.server_id}</span> : `device ref ${i.client_id.slice(0, 8)}`}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {i.status === 'synced' ? <Badge tone="green"><CheckCircle2 className="w-3 h-3" />Delivered</Badge>
                      : i.status === 'rejected' ? <Badge tone="red">Rejected by server</Badge>
                      : sync.online ? <Badge tone="orange"><Clock className="w-3 h-3" />Not delivered yet</Badge>
                      : <Badge tone="gray"><CloudOff className="w-3 h-3" />Saved offline</Badge>}
                    {i.server_id && <Button size="sm" variant="ghost" onClick={() => { setId(i.server_id); lookup(i.server_id) }}>Track</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
