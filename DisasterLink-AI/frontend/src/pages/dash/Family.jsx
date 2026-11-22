import { CheckCircle2, HeartHandshake, Lock, RefreshCw, X } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Check, EmptyState, ErrorState, Loading, PageHeader, StatusBadge, Tabs } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { fmtDate } from '../../lib/format'

function Report({ r, title }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4 text-sm">
      <p className="text-[11px] font-semibold text-slate-500 uppercase">{title} · <span className="font-mono normal-case">{r.id}</span></p>
      <p className="mt-1 font-semibold text-slate-800">{r.person_name}</p>
      <p className="text-xs text-slate-600">{[r.age != null && `${r.age} yrs`, r.gender].filter(Boolean).join(' · ')}</p>
      <p className="text-xs text-slate-600 mt-2">{r.description}</p>
      <p className="text-xs text-slate-500 mt-2">{r.last_known_location} · {fmtDate(r.last_seen_at)}</p>
      {r.family_reference && <p className="text-xs text-slate-500">Family: {r.family_reference}</p>}
      <p className="text-xs mt-2 flex items-center gap-1"><Lock className="w-3 h-3" />Contact: <span className="font-medium">{r.reporter_contact}</span></p>
      <p className="text-[11px] text-slate-400 mt-1">Reporter consent to share: {r.consent_to_share ? 'yes' : 'no'}</p>
    </div>
  )
}

export default function Family() {
  const [tab, setTab] = useState('suggestions')
  const sug = useApi('/api/family/suggestions')
  const reps = useApi('/api/family/reports')
  const [consent, setConsent] = useState({})
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const reload = () => { sug.reload(true); reps.reload(true) }
  const verify = async (s, decision) => {
    setBusy(s.id + decision); setMsg(null)
    try { await api(`/api/family/suggestions/${s.id}/verify`, { method: 'POST', body: { decision, consent_confirmed: !!consent[s.id] } }); setMsg({ tone: 'green', text: decision === 'verified' ? 'Match verified. Contact details are now visible to coordinators for reunification.' : 'Suggestion rejected.' }); reload() }
    catch (e) { setMsg({ tone: 'red', text: e.message }) } finally { setBusy('') }
  }
  const refresh = async () => { setBusy('r'); try { const r = await api('/api/family/refresh', { method: 'POST' }); setMsg({ tone: 'green', text: `${r.new_suggestions} new suggestion(s).` }); reload() } finally { setBusy('') } }

  return (
    <div>
      <PageHeader title="Family Reconnection" subtitle="Similarity-based match suggestions between missing and found reports. Identity and contact details are disclosed only after human verification and consent."
        actions={<Button variant="secondary" icon={RefreshCw} loading={busy === 'r'} onClick={refresh}>Re-run matching</Button>} />
      <Alert tone="blue" icon={Lock} className="mb-5">This is a controlled, coordinator-only module. There is no public missing-person database.</Alert>
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'suggestions', label: 'Match suggestions', count: sug.data?.filter((s) => s.status === 'suggested').length }, { value: 'reports', label: 'All reports', count: reps.data?.length }]} />
      {tab === 'suggestions' ? (sug.loading && !sug.data ? <Loading /> : sug.error ? <ErrorState error={sug.error} onRetry={sug.reload} /> : sug.data.length === 0 ? <Card><EmptyState icon={HeartHandshake} title="No match suggestions" /></Card> : (
        <div className="space-y-4">
          {sug.data.map((s) => (
            <Card key={s.id} title={`Possible match ${s.id}`} subtitle={s.explanation.join(' · ')} action={<div className="flex items-center gap-2"><Badge tone="purple">{Math.round(s.score * 100)}% similarity</Badge><StatusBadge status={s.status === 'suggested' ? 'pending' : s.status === 'verified' ? 'reunited' : 'rejected'} /></div>}>
              <div className="grid md:grid-cols-2 gap-4"><Report r={s.missing} title="Missing report" /><Report r={s.found} title="Found report" /></div>
              {s.status === 'suggested' ? (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between border-t border-slate-100 pt-4">
                  <Check id={`c-${s.id}`} checked={consent[s.id]} onChange={(v) => setConsent({ ...consent, [s.id]: v })} label="I have verified identity and both parties consent to sharing contact details" />
                  <div className="flex gap-2"><Button size="sm" variant="success" icon={CheckCircle2} disabled={!consent[s.id]} loading={busy === `${s.id}verified`} onClick={() => verify(s, 'verified')}>Verify match</Button><Button size="sm" variant="secondary" icon={X} loading={busy === `${s.id}rejected`} onClick={() => verify(s, 'rejected')}>Not a match</Button></div>
                </div>
              ) : <p className="mt-3 text-xs text-slate-500">Decision by {s.verified_by}{s.consent_confirmed ? ' · consent confirmed' : ''}</p>}
            </Card>
          ))}
        </div>
      )) : (reps.loading && !reps.data ? <Loading /> : reps.error ? <ErrorState error={reps.error} onRetry={reps.reload} /> : (
        <Card bodyClass="p-0"><div className="overflow-x-auto"><table className="table-base">
          <thead><tr><th>Report</th><th>Type</th><th>Person</th><th>Last known location</th><th>Status</th><th>Received</th></tr></thead>
          <tbody>{reps.data.map((r) => <tr key={r.id}><td className="font-mono text-xs">{r.id}{r.is_simulated && <span className="block text-[10px] text-violet-600 font-sans font-semibold">SIMULATED</span>}</td><td><Badge tone={r.report_type === 'missing' ? 'orange' : 'cyan'}>{r.report_type}</Badge></td><td>{r.person_name}<span className="block text-xs text-slate-500">{[r.age != null && `${r.age} yrs`, r.gender].filter(Boolean).join(' · ')}</span></td><td className="text-xs">{r.last_known_location}</td><td><StatusBadge status={r.status} /></td><td className="text-xs text-slate-500">{fmtDate(r.created_at)}</td></tr>)}</tbody>
        </table></div></Card>
      ))}
    </div>
  )
}
