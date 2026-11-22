import { Brain, Copy, Download, ExternalLink, Search, ShieldCheck, ShieldX, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Marker } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import MapView, { pinIcon } from '../../components/MapView'
import {
  Alert, Badge, Button, CachedBanner, Card, CategoryBadge, EmptyState, ErrorState, Field, Input, KeyValue, Loading, Modal,
  PageHeader, Select, StatusBadge, Textarea, Toast, UrgencyBadge,
} from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { AREAS, CATEGORIES, STATUS, URGENCY, label } from '../../lib/constants'
import { fmtDate, timeAgo } from '../../lib/format'

function RequestDetail({ id, onClose, onChanged }) {
  const { isStaff, role } = useAuth()
  const { data: r, loading, error, reload } = useApi(id ? `/api/requests/${id}` : null, { skip: !id })
  const vols = useApi('/api/volunteers?availability=available', { skip: !isStaff })
  const [ov, setOv] = useState({ level: 'high', reason: '' })
  const [vol, setVol] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)

  const act = async (key, fn, ok) => {
    setBusy(key); setMsg(null)
    try { await fn(); setMsg({ tone: 'green', text: ok }); await reload(true); onChanged?.() }
    catch (e) { setMsg({ tone: 'red', text: e.message }) } finally { setBusy('') }
  }
  const post = (path, body) => api(`/api/requests/${id}${path}`, { method: 'POST', body })

  return (
    <Modal open={!!id} onClose={onClose} title={`Request ${id || ''}`} wide>
      {loading && !r ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : r && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={r.category} /><UrgencyBadge level={r.urgency} overridden={!!r.urgency_override} />
            <StatusBadge status={r.status} /><StatusBadge status={r.verification_status} />
            {r.source === 'sos' && <Badge tone="red">SOS</Badge>}
            {r.synced_from_offline && <Badge tone="cyan">Synced from offline</Badge>}
            {r.is_simulated && <Badge tone="purple">SIMULATED</Badge>}
          </div>
          <p className="text-[15px] text-slate-800 leading-relaxed">{r.description}</p>
          <KeyValue items={[
            ['People affected', r.people_affected], ['Units needed', r.quantity_needed], ['Area', r.area], ['Location', r.location_name],
            ['Coordinates', r.lat != null ? `${r.lat}, ${r.lng}` : 'Not provided'], ['Received', fmtDate(r.created_at)],
            r.offline_created_at && ['Created on device (offline)', fmtDate(r.offline_created_at)],
            ['Requester', r.requester_name || '—'], ['Contact', r.contact_phone || '—'],
            ['Vulnerability', [r.has_elderly && 'elderly', r.has_children && 'children', r.has_disabled && 'disability', r.has_medical_condition && 'medical', r.has_pregnant && 'pregnant'].filter(Boolean).join(', ') || 'None reported'],
            r.assigned_volunteer_id && ['Assigned volunteer', r.assigned_volunteer_id],
          ]} />
          {r.lat != null && <div className="rounded-xl overflow-hidden border border-slate-200"><MapView height={180} center={[r.lat, r.lng]} zoom={14}><Marker position={[r.lat, r.lng]} icon={pinIcon(URGENCY[r.urgency].color, 22)} /></MapView></div>}

          <div className="grid md:grid-cols-2 gap-4">
            <Card title="AI classification" icon={Brain} bodyClass="p-4 text-sm space-y-2">
              <p>Engine: <span className="font-medium">{r.classification_engine}</span> · confidence {Math.round(r.classification_confidence * 100)}%</p>
              {r.categories.length > 1 && <p className="text-xs">Also mentions: {r.categories.slice(1).map((c) => CATEGORIES[c]?.label).join(', ')}</p>}
              <div className="flex flex-wrap gap-1">{r.keywords.map((k) => <Badge key={k}>{k}</Badge>)}</div>
              <ul className="list-disc pl-4 text-xs text-slate-600 space-y-0.5">{r.classification_explanation.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </Card>
            <Card title={`Urgency recommendation: ${URGENCY[r.urgency_recommended].label} (${r.urgency_score})`} bodyClass="p-4 text-sm">
              <ul className="space-y-1 text-xs">
                {r.urgency_factors.map((f, i) => <li key={i} className="flex justify-between gap-3"><span>{f.factor}{f.detail ? ` – ${f.detail}` : ''}</span><span className="tabular-nums text-slate-500">{f.points > 0 ? '+' : ''}{f.points}</span></li>)}
              </ul>
              <p className="text-[11px] text-slate-400 mt-2">Thresholds: critical ≥70, high ≥48, medium ≥28. Advisory only - not medical triage.</p>
              {r.urgency_override && <Alert tone="orange" className="mt-3 !py-2">Overridden to <strong>{r.urgency_override}</strong> by {r.overridden_by}: “{r.override_reason}”</Alert>}
            </Card>
          </div>

          {r.possible_duplicates.length > 0 && (
            <Card title="Possible duplicates" bodyClass="p-0">
              <ul className="divide-y divide-slate-100">
                {r.possible_duplicates.map((d) => (
                  <li key={d.id} className="px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                    <div className="min-w-0"><p><span className="font-mono text-xs">{d.id}</span> <Badge tone="purple">{Math.round(d.score * 100)}% similar</Badge></p>
                      <p className="text-xs text-slate-600 truncate">{d.description}</p><p className="text-[11px] text-slate-400">{d.reasons.join(' · ')}</p></div>
                    {isStaff && r.status !== 'duplicate' && <Button size="sm" variant="secondary" icon={Copy} loading={busy === `dup-${d.id}`}
                      onClick={() => act(`dup-${d.id}`, () => post('/mark-duplicate', { duplicate_of: d.id }), `Marked as duplicate of ${d.id}`)}>Mark this request as duplicate</Button>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {r.matches.length > 0 && (
            <Card title="Resource matches" bodyClass="p-4 text-sm space-y-1">
              {r.matches.map((m) => <p key={m.id}><span className="font-mono text-xs">{m.id}</span> · {m.quantity} {m.resource.unit} of {m.resource.name} · <StatusBadge status={m.status} /></p>)}
            </Card>
          )}

          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          {isStaff ? (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap gap-2">
                {r.verification_status !== 'verified' && <Button variant="success" icon={ShieldCheck} loading={busy === 'v'} onClick={() => act('v', () => post('/verify', { decision: 'verified' }), 'Request verified')}>Verify</Button>}
                {r.verification_status !== 'rejected' && <Button variant="secondary" icon={ShieldX} loading={busy === 'x'} onClick={() => act('x', () => post('/verify', { decision: 'rejected' }), 'Request rejected')}>Reject</Button>}
                {['verified', 'in_progress'].includes(r.status) && <Button variant="secondary" loading={busy === 'ip'} onClick={() => act('ip', () => api(`/api/requests/${id}/status`, { method: 'PATCH', body: { status: 'in_progress' } }), 'Marked in progress')}>Mark in progress</Button>}
                {r.status !== 'fulfilled' && r.status !== 'rejected' && <Button variant="secondary" loading={busy === 'f'} onClick={() => act('f', () => api(`/api/requests/${id}/status`, { method: 'PATCH', body: { status: 'fulfilled' } }), 'Marked fulfilled')}>Mark fulfilled</Button>}
                {r.duplicate_of && <Button variant="ghost" loading={busy === 'nd'} onClick={() => act('nd', () => post('/not-duplicate'), 'Duplicate flag cleared')}>Not a duplicate</Button>}
                <Button variant="ghost" loading={busy === 'rc'} onClick={() => act('rc', () => post('/recompute-urgency'), 'Urgency recalculated')}>Recalculate urgency</Button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <p className="text-sm font-semibold text-navy-800">Override urgency</p>
                  <Select aria-label="New urgency" value={ov.level} onChange={(e) => setOv({ ...ov, level: e.target.value })}>{Object.entries(URGENCY).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}</Select>
                  <Textarea aria-label="Reason" rows={2} placeholder="Reason (required, recorded in the audit log)" value={ov.reason} onChange={(e) => setOv({ ...ov, reason: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={ov.reason.trim().length < 5} loading={busy === 'ov'} onClick={() => act('ov', () => post('/override-urgency', ov), 'Urgency overridden')}>Save override</Button>
                    {r.urgency_override && <Button size="sm" variant="ghost" onClick={() => act('co', () => post('/clear-override'), 'Override cleared')}>Clear override</Button>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                  <p className="text-sm font-semibold text-navy-800">Assign volunteer</p>
                  <Select aria-label="Volunteer" value={vol} onChange={(e) => setVol(e.target.value)}>
                    <option value="">Select available volunteer…</option>
                    {(vols.data || []).filter((v) => v.approval_status === 'approved').map((v) => <option key={v.id} value={v.id}>{v.name} · {v.service_area}</option>)}
                  </Select>
                  <Button size="sm" icon={UserPlus} disabled={!vol} loading={busy === 'as'} onClick={() => act('as', () => post('/assign', { volunteer_id: vol }), 'Volunteer assigned')}>Assign</Button>
                </div>
              </div>
            </div>
          ) : role === 'volunteer' && <Alert tone="gray">Read-only view. Coordinators verify, prioritise and assign requests.</Alert>}
        </div>
      )}
    </Modal>
  )
}

export default function Requests() {
  const [params, setParams] = useSearchParams()
  const [flt, setFlt] = useState({ category: '', area: '', urgency: '', status: '', verification: '', q: '' })
  const [q, setQ] = useState('')
  const [toast, setToast] = useState('')
  useEffect(() => { const t = setTimeout(() => setFlt((s) => ({ ...s, q })), 300); return () => clearTimeout(t) }, [q])
  const qs = new URLSearchParams(Object.entries(flt).filter(([, v]) => v)).toString()
  const { data, loading, error, reload, fromCache, savedAt } = useApi(`/api/requests${qs ? `?${qs}` : ''}`, { cache: true })
  const set = (k) => (e) => setFlt((s) => ({ ...s, [k]: e.target.value }))
  const openId = params.get('id')
  const rows = useMemo(() => data || [], [data])

  const exportCsv = () => {
    const cols = ['id', 'created_at', 'category', 'urgency', 'status', 'verification_status', 'area', 'people_affected', 'quantity_needed', 'source', 'is_simulated', 'description']
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `requests-${Date.now()}.csv`; a.click()
  }

  return (
    <div>
      <PageHeader title="Emergency Requests" subtitle="Review, verify and prioritise incoming requests. AI suggestions are advisory."
        actions={<><Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button><Link to="/request"><Button icon={ExternalLink}>Log a request</Button></Link></>} />
      <div className="card p-3 mb-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
        <div className="relative col-span-2 md:col-span-3 xl:col-span-1"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><Input aria-label="Search" className="pl-9" placeholder="Search text or ID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select aria-label="Category" value={flt.category} onChange={set('category')}><option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</Select>
        <Select aria-label="Area" value={flt.area} onChange={set('area')}><option value="">All areas</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select>
        <Select aria-label="Priority" value={flt.urgency} onChange={set('urgency')}><option value="">All priorities</option>{Object.entries(URGENCY).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}</Select>
        <Select aria-label="Status" value={flt.status} onChange={set('status')}><option value="">All statuses</option>{['pending', 'verified', 'in_progress', 'fulfilled', 'duplicate', 'rejected'].map((s) => <option key={s} value={s}>{label(STATUS, s)}</option>)}</Select>
        <Select aria-label="Verification" value={flt.verification} onChange={set('verification')}><option value="">Any verification</option><option value="unverified">Unverified</option><option value="verified">Verified</option><option value="rejected">Rejected</option></Select>
      </div>
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      <Card bodyClass="p-0">
        {loading && !data ? <Loading /> : error ? <div className="p-5"><ErrorState error={error} onRetry={reload} /></div> : rows.length === 0 ? <EmptyState title="No requests match these filters" /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Request</th><th>Category</th><th>Priority</th><th>Status</th><th>Area</th><th>People</th><th>Received</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="cursor-pointer" onClick={() => setParams({ id: r.id })}>
                    <td className="max-w-md">
                      <div className="flex items-center gap-2"><span className="font-mono text-xs text-slate-500">{r.id}</span>
                        {r.source === 'sos' && <Badge tone="red">SOS</Badge>}{r.duplicate_of && r.status !== 'duplicate' && <Badge tone="purple">Possible duplicate</Badge>}
                        {r.synced_from_offline && <Badge tone="cyan">Offline</Badge>}{r.is_simulated && <span className="text-[10px] text-violet-600 font-semibold">SIMULATED</span>}</div>
                      <p className="text-sm text-slate-800 mt-0.5 line-clamp-1">{r.description}</p>
                    </td>
                    <td><CategoryBadge category={r.category} /></td>
                    <td><UrgencyBadge level={r.urgency} overridden={!!r.urgency_override} /></td>
                    <td><div className="flex flex-col gap-1 items-start"><StatusBadge status={r.status} />{r.verification_status !== 'verified' && <span className="text-[11px] text-slate-400">{r.verification_status}</span>}</div></td>
                    <td className="whitespace-nowrap">{r.area || '—'}</td><td className="tabular-nums">{r.people_affected}</td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-xs text-slate-400 mt-2">* priority manually overridden by a coordinator.</p>
      <RequestDetail id={openId} onClose={() => setParams({})} onChanged={() => reload(true)} />
      <Toast message={toast} onClose={() => setToast('')} />
    </div>
  )
}
