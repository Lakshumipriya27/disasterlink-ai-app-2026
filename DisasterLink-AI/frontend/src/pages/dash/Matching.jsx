import { AlertTriangle, ArrowRight, CheckCircle2, GitMerge, Play, Send, Truck, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, CachedBanner, Card, CategoryBadge, EmptyState, ErrorState, Loading, PageHeader, ProgressBar, StatusBadge, Tabs, UrgencyBadge } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { CATEGORIES } from '../../lib/constants'

const NEXT = { suggested: ['submit', 'Send for approval', Send], awaiting_approval: ['approve', 'Approve allocation', CheckCircle2], approved: ['dispatch', 'Mark dispatched', Truck], dispatched: ['fulfil', 'Mark fulfilled', CheckCircle2] }

export default function Matching() {
  const { isStaff } = useAuth()
  const [tab, setTab] = useState('active')
  const sh = useApi('/api/matching/shortages', { cache: true })
  const mt = useApi('/api/matching', { cache: true })
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const reload = () => { sh.reload(true); mt.reload(true) }

  const run = async () => {
    setBusy('run'); setMsg(null)
    try { const r = await api('/api/matching/generate', { method: 'POST' }); setMsg({ tone: 'green', text: `Matching engine created ${r.created} new suggestion(s). Review and send them for approval.` }); setTab('active'); reload() }
    catch (e) { setMsg({ tone: 'red', text: e.message }) } finally { setBusy('') }
  }
  const step = async (m, action) => {
    setBusy(m.id + action); setMsg(null)
    try { await api(`/api/matching/${m.id}/transition`, { method: 'POST', body: { action } }); reload() }
    catch (e) { setMsg({ tone: 'red', text: e.message }) } finally { setBusy('') }
  }
  const shortages = (sh.data || []).filter((s) => s.status === 'shortage' || s.status === 'critical_shortage')
  const all = mt.data || []
  const groups = { active: all.filter((m) => ['suggested', 'awaiting_approval', 'approved', 'dispatched'].includes(m.status)), done: all.filter((m) => ['fulfilled', 'rejected'].includes(m.status)) }

  return (
    <div>
      <PageHeader title="Need-Aware Resource Matching" subtitle="Finds locations where verified demand exceeds supply and recommends allocations. Human approval is mandatory before any allocation is confirmed."
        actions={isStaff && <Button icon={Play} onClick={run} loading={busy === 'run'}>Run matching engine</Button>} />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <CachedBanner fromCache={sh.fromCache || mt.fromCache} savedAt={sh.savedAt || mt.savedAt} />
      <Card title="Demand vs supply - shortage analysis" subtitle="Verified open demand compared with usable (non-expired, unreserved) stock in the same area" icon={AlertTriangle} className="mb-6">
        {sh.loading && !sh.data ? <Loading /> : sh.error ? <ErrorState error={sh.error} onRetry={sh.reload} /> : shortages.length === 0 ? <EmptyState icon={CheckCircle2} title="No verified shortages" /> : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {shortages.map((s) => (
              <div key={`${s.area}${s.category}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between"><p className="font-semibold text-navy-800">{s.area}</p><Badge tone={s.status === 'critical_shortage' ? 'red' : 'orange'}>{s.status === 'critical_shortage' ? 'Critical shortage' : 'Shortage'}</Badge></div>
                <div className="mt-2"><CategoryBadge category={s.category} /></div>
                <p className="mt-3 text-sm text-slate-700"><strong>{s.verified_demand}</strong> units needed (verified) · only <strong>{s.supply}</strong> available</p>
                <div className="mt-2"><ProgressBar value={(s.coverage || 0) * 100} tone={s.status === 'critical_shortage' ? 'red' : 'orange'} /></div>
                <p className="text-xs text-slate-500 mt-1">Gap {s.gap} · {s.verified_requests} verified request(s){s.unverified_demand ? ` · +${s.unverified_demand} unverified` : ''}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'Active matches', count: groups.active.length }, { value: 'done', label: 'Completed / rejected', count: groups.done.length }]} />
      {mt.loading && !mt.data ? <Loading /> : mt.error ? <ErrorState error={mt.error} onRetry={mt.reload} /> : groups[tab].length === 0 ? (
        <Card><EmptyState icon={GitMerge} title="No matches here" message={tab === 'active' && isStaff ? 'Run the matching engine to generate suggestions for verified requests.' : undefined} /></Card>
      ) : (
        <div className="space-y-3">
          {groups[tab].map((m) => {
            const nx = NEXT[m.status]
            return (
              <Card key={m.id} bodyClass="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-slate-500">{m.id}</span><StatusBadge status={m.status} /><Badge tone="blue">score {m.score}</Badge></div>
                    <div className="mt-2 grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-center text-sm">
                      <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">RESOURCE</p><p className="font-medium text-slate-800">{m.resource.name}</p><p className="text-xs text-slate-500">{m.resource.id} · {m.resource.location_name} · {m.resource.organization}</p></div>
                      <div className="flex flex-col items-center text-xs text-slate-500"><ArrowRight className="w-5 h-5 text-blue-600" />{m.quantity} {m.resource.unit}<span>{m.distance_km} km</span></div>
                      <div className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">REQUEST → {m.destination}</p><Link to={`/app/requests?id=${m.request.id}`} className="font-mono text-xs text-blue-600">{m.request.id}</Link><div className="flex items-center gap-2 mt-1"><CategoryBadge category={m.request.category} /><UrgencyBadge level={m.request.urgency} /></div><p className="text-xs text-slate-500 mt-1">needs {m.request.quantity_needed}</p></div>
                    </div>
                    <details className="mt-2"><summary className="text-xs text-blue-600 cursor-pointer">Why this match?</summary><ul className="mt-1 list-disc pl-5 text-xs text-slate-600 space-y-0.5">{m.explanation.map((e, i) => <li key={i}>{e}</li>)}</ul></details>
                    {m.decided_by && <p className="text-[11px] text-slate-400 mt-1">Last decision by {m.decided_by}</p>}
                  </div>
                  {isStaff && nx && (
                    <div className="flex lg:flex-col gap-2 shrink-0">
                      <Button size="sm" icon={nx[2]} variant={m.status === 'awaiting_approval' ? 'success' : 'primary'} loading={busy === m.id + nx[0]} onClick={() => step(m, nx[0])}>{nx[1]}</Button>
                      {m.status !== 'dispatched' && <Button size="sm" variant="secondary" icon={X} loading={busy === `${m.id}reject`} onClick={() => step(m, 'reject')}>Reject</Button>}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <p className="text-xs text-slate-400 mt-4">Workflow: Suggested → Awaiting approval → Approved (stock reserved) → Dispatched → Fulfilled (stock deducted). {Object.keys(CATEGORIES).length} request categories supported.</p>
    </div>
  )
}
