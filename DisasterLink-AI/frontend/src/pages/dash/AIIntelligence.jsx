import { Brain, Copy, Cpu, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bars } from '../../components/Charts'
import { Alert, Badge, Button, CachedBanner, Card, CategoryBadge, Check, EmptyState, ErrorState, Input, Loading, PageHeader, StatusBadge, Tabs, Textarea, UrgencyBadge } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { CATEGORIES } from '../../lib/constants'

const SAMPLES = [
  'Family of 4 trapped on terrace, water rising, grandfather has chest pain',
  'Thanni illai, 30 people need drinking water near Velachery lake',
  'Need insulin and BP tablets for elderly couple, medicines washed away',
  'House collapsed, 6 people including 2 children need a place to stay tonight',
]

function Analyzer() {
  const [text, setText] = useState(SAMPLES[0])
  const [people, setPeople] = useState(1)
  const [ext, setExt] = useState(false)
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const status = useApi('/api/ai/status')
  const run = async () => {
    setBusy(true); setErr('')
    try { setRes(await api('/api/ai/analyze', { method: 'POST', body: { text, people_affected: Number(people) || 1, use_external: ext } })) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="grid xl:grid-cols-5 gap-6">
      <div className="xl:col-span-2 space-y-4">
        <Card title="Analyse a request" icon={Brain}>
          <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label="Request text" />
          <div className="flex flex-wrap gap-1.5 mt-2">{SAMPLES.map((s, i) => <button key={i} onClick={() => setText(s)} className="text-xs rounded-full bg-slate-100 hover:bg-slate-200 px-2.5 py-1">Sample {i + 1}</button>)}</div>
          <div className="mt-3 flex items-center gap-3"><label className="text-sm text-slate-600" htmlFor="pp">People</label><Input id="pp" type="number" min={1} value={people} onChange={(e) => setPeople(e.target.value)} className="!w-24" /></div>
          <div className="mt-3"><Check id="ext" checked={ext} onChange={setExt} label="Use optional external AI enhancement" description={status.data?.external?.active ? `Active: ${status.data.external.model}` : 'Not configured - the local rule-based engine will be used.'} /></div>
          <Button className="mt-4" icon={Sparkles} onClick={run} loading={busy} disabled={text.trim().length < 3}>Analyse</Button>
          {err && <Alert tone="red" className="mt-3">{err}</Alert>}
        </Card>
        <Card title="Engine status" icon={Cpu} bodyClass="p-4 text-sm space-y-1">
          <p>Local engine: <Badge tone="green">Always available</Badge></p>
          <p className="text-xs text-slate-500">{status.data?.local_engine}</p>
          <p className="pt-2">External AI: <Badge tone={status.data?.external?.active ? 'green' : 'gray'}>{status.data?.external?.active ? 'Active' : 'Disabled'}</Badge></p>
          <p className="text-xs text-slate-500">Set AI_PROVIDER=anthropic and ANTHROPIC_API_KEY in backend/.env (optional).</p>
        </Card>
      </div>
      <div className="xl:col-span-3 space-y-4">
        {!res ? <Card><EmptyState icon={Brain} title="Run an analysis" message="Classification, keywords, urgency factors and possible duplicates will appear here." /></Card> : (
          <>
            <Card title="Classification" subtitle={`Engine: ${res.classification.engine} · confidence ${Math.round(res.classification.confidence * 100)}%`}>
              <div className="flex flex-wrap items-center gap-3">{res.classification.categories.map((c, i) => <span key={c} className={i ? 'opacity-70' : ''}><CategoryBadge category={c} /></span>)}</div>
              <div className="mt-3 flex flex-wrap gap-1">{res.classification.keywords.map((k) => <Badge key={k} tone="blue">{k}</Badge>)}</div>
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-600 space-y-0.5">{res.classification.explanation.map((e, i) => <li key={i}>{e}</li>)}</ul>
              {Object.keys(res.classification.scores || {}).length > 0 && (
                <div className="mt-4"><Bars height={160} data={Object.entries(res.classification.scores).map(([k, v]) => ({ name: CATEGORIES[k].short, score: v, k }))} x="name" bars={[{ key: 'score', name: 'Keyword score' }]} colors={(d) => CATEGORIES[d.k].color} /></div>
              )}
            </Card>
            <Card title="Urgency recommendation" action={<UrgencyBadge level={res.urgency.level} />}>
              <div className="flex items-center gap-4">
                <div className="text-4xl font-semibold text-navy-800 tabular-nums">{res.urgency.score}</div>
                <div className="flex-1"><div className="h-2 rounded-full bg-gradient-to-r from-slate-300 via-blue-500 via-60% to-red-600 relative"><span className="absolute -top-1 w-1 h-4 bg-navy-900 rounded" style={{ left: `${res.urgency.score}%` }} /></div>
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>Low</span><span>Medium 28</span><span>High 48</span><span>Critical 70</span></div></div>
              </div>
              <table className="table-base mt-4"><thead><tr><th>Factor</th><th>Detail</th><th className="text-right">Points</th></tr></thead>
                <tbody>{res.urgency.factors.map((f, i) => <tr key={i}><td>{f.factor}</td><td className="text-slate-500">{f.detail}</td><td className="text-right tabular-nums">{f.points > 0 ? '+' : ''}{f.points}</td></tr>)}</tbody></table>
              <p className="text-xs text-slate-500 mt-3">{res.urgency.disclaimer}</p>
            </Card>
            <Card title="Similar existing requests (duplicate check)">
              {(res.duplicates || []).length === 0 ? <p className="text-sm text-slate-500">No similar requests found.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">{res.duplicates.map((d) => <li key={d.id} className="py-2"><Link to={`/app/requests?id=${d.id}`} className="font-mono text-xs text-blue-600">{d.id}</Link> <Badge tone="purple">{Math.round(d.score * 100)}%</Badge><p className="text-slate-600 text-xs mt-0.5">{d.description}</p><p className="text-[11px] text-slate-400">{d.reasons.join(' · ')}</p></li>)}</ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}

function DuplicateQueue() {
  const { isStaff } = useAuth()
  const { data, loading, error, reload, fromCache, savedAt } = useApi('/api/ai/duplicates', { cache: true })
  const [busy, setBusy] = useState('')
  const act = async (k, path, body) => { setBusy(k); try { await api(path, { method: 'POST', body }); await reload(true) } finally { setBusy('') } }
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <div className="space-y-4">
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      {data.length === 0 && <Card><EmptyState icon={Copy} title="No possible duplicates flagged" /></Card>}
      {data.map((d) => (
        <Card key={d.request.id} title={`${d.request.id} ↔ ${d.original.id}`} subtitle={d.reasons.join(' · ')} action={<Badge tone={d.confirmed ? 'gray' : 'purple'}>{d.confirmed ? 'Confirmed duplicate' : `${Math.round(d.score * 100)}% similar`}</Badge>}>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {[['Flagged request', d.request], ['Possible original', d.original]].map(([t, r]) => (
              <div key={r.id} className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t} · <span className="font-mono">{r.id}</span></p>
                <p className="mt-1 text-slate-800">{r.description}</p>
                <div className="mt-2 flex flex-wrap gap-2 items-center"><CategoryBadge category={r.category} /><StatusBadge status={r.status} /><span className="text-xs text-slate-500">{r.area} · {r.contact_phone}</span></div>
              </div>
            ))}
          </div>
          {isStaff && !d.confirmed && (
            <div className="mt-4 flex gap-2">
              <Button size="sm" icon={Copy} loading={busy === `m${d.request.id}`} onClick={() => act(`m${d.request.id}`, `/api/requests/${d.request.id}/mark-duplicate`, { duplicate_of: d.original.id })}>Confirm duplicate</Button>
              <Button size="sm" variant="secondary" icon={X} loading={busy === `n${d.request.id}`} onClick={() => act(`n${d.request.id}`, `/api/requests/${d.request.id}/not-duplicate`)}>Not a duplicate</Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function Insights() {
  const { data, loading, error, reload } = useApi('/api/ai/insights', { cache: true })
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  return (
    <div className="space-y-6">
      <div className="grid xl:grid-cols-2 gap-6">
        <Card title="Most frequent keywords"><Bars data={data.top_keywords} x="keyword" horizontal height={320} bars={[{ key: 'count', name: 'Requests' }]} /></Card>
        <Card title="Classification confidence"><Bars data={data.confidence_distribution} x="bucket" bars={[{ key: 'count', name: 'Requests', color: '#06b6d4' }]} />
          <p className="text-xs text-slate-500 mt-2">Low-confidence requests should be reviewed by a coordinator.</p></Card>
      </div>
      <div className="grid xl:grid-cols-2 gap-6">
        <Card title="Low-confidence pending requests" bodyClass="p-0">{data.low_confidence_queue.length === 0 ? <EmptyState title="None" /> : (
          <ul className="divide-y divide-slate-100">{data.low_confidence_queue.map((r) => <li key={r.id} className="px-5 py-3 text-sm"><Link to={`/app/requests?id=${r.id}`} className="font-mono text-xs text-blue-600">{r.id}</Link> · {Math.round(r.classification_confidence * 100)}%<p className="text-slate-600 line-clamp-1">{r.description}</p></li>)}</ul>)}
        </Card>
        <Card title={`Coordinator overrides (${data.override_count})`} subtitle="Human decisions recorded with reasons" bodyClass="p-0">{data.overrides.length === 0 ? <EmptyState title="No overrides yet" /> : (
          <ul className="divide-y divide-slate-100">{data.overrides.map((r) => <li key={r.id} className="px-5 py-3 text-sm"><div className="flex items-center gap-2"><span className="font-mono text-xs">{r.id}</span><UrgencyBadge level={r.urgency_recommended} /> → <UrgencyBadge level={r.urgency_override} /></div><p className="text-xs text-slate-500 mt-1">“{r.override_reason}” - {r.overridden_by}</p></li>)}</ul>)}
        </Card>
      </div>
      <Alert tone="gray">{data.disclaimer}</Alert>
    </div>
  )
}

export default function AIIntelligence() {
  const [tab, setTab] = useState('analyze')
  return (
    <div>
      <PageHeader title="AI Intelligence" subtitle="Local, explainable rule-based NLP: categorisation, keyword extraction, duplicate detection and transparent urgency recommendations." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'analyze', label: 'Analyser' }, { value: 'dups', label: 'Duplicate review' }, { value: 'insights', label: 'Insights & overrides' }]} />
      {tab === 'analyze' ? <Analyzer /> : tab === 'dups' ? <DuplicateQueue /> : <Insights />}
    </div>
  )
}
