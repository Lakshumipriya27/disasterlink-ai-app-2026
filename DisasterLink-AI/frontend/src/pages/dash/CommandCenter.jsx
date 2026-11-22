import { AlertTriangle, Boxes, CheckCircle2, CloudOff, Flame, GitMerge, Inbox, ListChecks, Radar, RefreshCw, ShieldCheck, Timer } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bars, Donut, Timeline } from '../../components/Charts'
import { Badge, Button, CachedBanner, Card, CategoryBadge, EmptyState, ErrorState, Loading, PageHeader, Select, StatCard, StatusBadge, UrgencyBadge } from '../../components/ui'
import { useApi } from '../../lib/api'
import { AREAS, CATEGORIES, STATUS, URGENCY, label } from '../../lib/constants'
import { fmtNum, timeAgo } from '../../lib/format'

export default function CommandCenter() {
  const [flt, setFlt] = useState({ category: '', area: '', urgency: '', status: '' })
  const qs = new URLSearchParams(Object.entries(flt).filter(([, v]) => v)).toString()
  const { data, loading, error, reload, fromCache, savedAt } = useApi(`/api/analytics/dashboard${qs ? `?${qs}` : ''}`, { cache: true })
  const nav = useNavigate()
  const set = (k) => (e) => setFlt((s) => ({ ...s, [k]: e.target.value }))

  return (
    <div>
      <PageHeader title="Command Center" subtitle="Live overview of the simulated Chennai flood response. All figures are calculated from current application data."
        actions={<Button variant="secondary" icon={RefreshCw} onClick={() => reload()}>Refresh</Button>} />
      <div className="card p-3 mb-5 grid grid-cols-2 md:grid-cols-5 gap-2 items-center">
        <Select aria-label="Category" value={flt.category} onChange={set('category')}><option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</Select>
        <Select aria-label="Location" value={flt.area} onChange={set('area')}><option value="">All locations</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select>
        <Select aria-label="Priority" value={flt.urgency} onChange={set('urgency')}><option value="">All priorities</option>{Object.entries(URGENCY).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}</Select>
        <Select aria-label="Status" value={flt.status} onChange={set('status')}><option value="">All statuses</option>{['pending', 'verified', 'in_progress', 'fulfilled', 'duplicate', 'rejected'].map((s) => <option key={s} value={s}>{label(STATUS, s)}</option>)}</Select>
        <Button variant="ghost" onClick={() => setFlt({ category: '', area: '', urgency: '', status: '' })} disabled={!qs}>Clear filters</Button>
      </div>
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <StatCard label="Total requests" value={fmtNum(data.stats.total_requests)} icon={Inbox} hint={`${fmtNum(data.stats.people_affected)} people affected`} onClick={() => nav('/app/requests')} />
            <StatCard label="Verified" value={fmtNum(data.stats.verified)} icon={ShieldCheck} tone="cyan" />
            <StatCard label="Pending review" value={fmtNum(data.stats.pending)} icon={Timer} tone="gray" />
            <StatCard label="Critical (open)" value={fmtNum(data.stats.critical)} icon={Flame} tone="red" hint={`${data.stats.sos_open} open SOS alerts`} />
            <StatCard label="High priority (open)" value={fmtNum(data.stats.high)} icon={AlertTriangle} tone="orange" />
            <StatCard label="Available resource units" value={fmtNum(data.stats.available_resource_units)} icon={Boxes} tone="navy" hint={`${data.stats.resource_records} usable stock records`} onClick={() => nav('/app/resources')} />
            <StatCard label="Pending matches" value={fmtNum(data.stats.pending_matches)} icon={GitMerge} tone="purple" onClick={() => nav('/app/matching')} />
            <StatCard label="Fulfilled" value={fmtNum(data.stats.fulfilled)} icon={CheckCircle2} tone="green" hint={`${data.stats.in_progress} in progress`} />
            <StatCard label="Potentially underserved areas" value={fmtNum(data.stats.underserved_areas)} icon={Radar} tone="orange" onClick={() => nav('/app/unreported')} />
            <StatCard label="Synced from offline" value={fmtNum(data.stats.offline_synced)} icon={CloudOff} tone="blue" />
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <Card title="Requests by category" className="xl:col-span-2">
              {data.category_chart.length ? <Bars data={data.category_chart.map((d) => ({ ...d, name: CATEGORIES[d.category]?.short || d.category }))} x="name" bars={[{ key: 'count', name: 'Requests' }]} colors={(d) => CATEGORIES[d.category]?.color || '#64748b'} />
                : <EmptyState title="No requests match these filters" />}
            </Card>
            <Card title="Request status">
              {data.status_chart.length ? <Donut data={data.status_chart.map((d) => ({ ...d, name: label(STATUS, d.status) }))} nameKey="name" valueKey="count" /> : <EmptyState title="No data" />}
            </Card>
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <Card title="Emergency activity timeline" subtitle="Requests received per 2-hour window (last 48 h)" className="xl:col-span-2">
              <Timeline data={data.timeline.map((t) => ({ ...t, label: new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }))} x="label"
                areas={[{ key: 'requests', name: 'All requests', color: '#2563eb' }, { key: 'sos', name: 'SOS', color: '#dc2626' }, { key: 'critical', name: 'Critical', color: '#f97316' }]} />
            </Card>
            <Card title="Urgent assistance" subtitle="Open critical & high requests, oldest first" bodyClass="p-0">
              {data.urgent.length === 0 ? <EmptyState icon={CheckCircle2} title="No open urgent requests" /> : (
                <ul className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto scrollbar-thin">
                  {data.urgent.map((r) => (
                    <li key={r.id}><Link to={`/app/requests?id=${r.id}`} className="block px-5 py-3 hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs font-mono text-slate-500">{r.id}</span><UrgencyBadge level={r.urgency} overridden={!!r.urgency_override} /></div>
                      <p className="text-sm text-slate-800 mt-1 line-clamp-2">{r.description}</p>
                      <p className="text-xs text-slate-500 mt-1">{r.area} · {timeAgo(r.created_at)} · {r.people_affected} people</p>
                    </Link></li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="grid xl:grid-cols-2 gap-6">
            <Card title="Resource availability vs open demand" subtitle="Units available (non-expired) compared with units requested">
              <Bars data={data.resource_chart.map((d) => ({ ...d, name: CATEGORIES[d.category].short }))} x="name"
                bars={[{ key: 'available', name: 'Available', color: '#06b6d4' }, { key: 'demand', name: 'Open demand', color: '#1e3a6e' }]} />
            </Card>
            <Card title="Geographic demand" subtitle="Active requests and people affected by area">
              <Bars data={data.geo_demand} x="area" horizontal height={260} bars={[{ key: 'requests', name: 'Requests', color: '#2563eb' }, { key: 'critical', name: 'Critical', color: '#dc2626' }]} />
            </Card>
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            <Card title="Recent requests" className="xl:col-span-2" bodyClass="p-0" action={<Link to="/app/requests" className="text-sm text-blue-600 hover:underline">View all</Link>}>
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead><tr><th>ID</th><th>Category</th><th>Area</th><th>Priority</th><th>Status</th><th>Received</th></tr></thead>
                  <tbody>
                    {data.recent.map((r) => (
                      <tr key={r.id} className="cursor-pointer" onClick={() => nav(`/app/requests?id=${r.id}`)}>
                        <td className="font-mono text-xs">{r.id}{r.is_simulated && <span className="block text-[10px] text-violet-600">SIMULATED</span>}</td>
                        <td><CategoryBadge category={r.category} /></td><td>{r.area || '—'}</td>
                        <td><UrgencyBadge level={r.urgency} overridden={!!r.urgency_override} /></td><td><StatusBadge status={r.status} /></td>
                        <td className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(r.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <div className="space-y-6">
              <Card title="Resource shortage alerts" icon={AlertTriangle} bodyClass="p-0">
                {data.shortage_alerts.length === 0 ? <EmptyState icon={CheckCircle2} title="No verified shortages" /> : (
                  <ul className="divide-y divide-slate-100">
                    {data.shortage_alerts.slice(0, 5).map((s) => (
                      <li key={`${s.area}-${s.category}`} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-2"><CategoryBadge category={s.category} /><Badge tone={s.status === 'critical_shortage' ? 'red' : 'orange'}>{s.status === 'critical_shortage' ? 'Critical' : 'Shortage'}</Badge></div>
                        <p className="text-xs text-slate-600 mt-1.5">{s.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Potentially underserved" icon={Radar} bodyClass="p-0" action={<Link to="/app/unreported" className="text-sm text-blue-600 hover:underline">Details</Link>}>
                {data.underserved.length === 0 ? <EmptyState title="No areas flagged" /> : (
                  <ul className="divide-y divide-slate-100">
                    {data.underserved.map((a) => (
                      <li key={a.area} className="px-5 py-3 flex items-center justify-between gap-2 text-sm">
                        <span><span className="font-medium text-slate-800">{a.area}</span><span className="block text-xs text-slate-500">{a.confirmed_requests} confirmed · est. {fmtNum(a.estimated_unreported_people)} unreported (estimate)</span></span>
                        <Badge tone={a.level === 'high' ? 'red' : 'orange'}>{a.level}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
