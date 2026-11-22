import { Circle, Popup } from 'react-leaflet'
import { useState } from 'react'
import { Bars, Donut } from '../../components/Charts'
import MapView from '../../components/MapView'
import { Alert, CachedBanner, Card, ErrorState, Loading, PageHeader, StatCard, Tabs } from '../../components/ui'
import { useApi } from '../../lib/api'
import { CATEGORIES, STATUS, label } from '../../lib/constants'
import { fmtNum, pct } from '../../lib/format'

function Overview() {
  const { data, loading, error, reload, fromCache, savedAt } = useApi('/api/analytics/summary', { cache: true })
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const t = data.totals
  const statuses = ['pending', 'verified', 'in_progress', 'fulfilled', 'duplicate', 'rejected']
  return (
    <div className="space-y-6">
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Fulfilment rate" value={pct(t.fulfilment_rate)} tone="green" hint={`${t.fulfilled} of ${t.requests} requests`} />
        <StatCard label="Avg. time to fulfil" value={t.avg_hours_to_fulfil != null ? `${t.avg_hours_to_fulfil} h` : '—'} tone="blue" />
        <StatCard label="Matches fulfilled" value={`${t.matches_fulfilled} / ${t.matches_total}`} tone="cyan" />
        <StatCard label="AI urgency overrides" value={t.urgency_overrides} tone="orange" hint={`avg. classification confidence ${pct(t.avg_classification_confidence)}`} />
        <StatCard label="Volunteers" value={t.volunteers} tone="navy" />
        <StatCard label="Registered vulnerable" value={t.vulnerable_registered} tone="purple" />
        <StatCard label="Shelter occupancy" value={pct(t.shelter_occupancy / Math.max(1, t.shelter_capacity))} tone="blue" hint={`${t.shelter_occupancy} / ${t.shelter_capacity}`} />
        <StatCard label="Offline-synced requests" value={t.offline_synced} tone="gray" />
      </div>
      <div className="grid xl:grid-cols-3 gap-6">
        <Card title="Request status by area" className="xl:col-span-2">
          <Bars data={data.area_status} x="area" stacked height={280} bars={statuses.map((s, i) => ({ key: s, name: label(STATUS, s), color: ['#94a3b8', '#06b6d4', '#2563eb', '#10b981', '#8b5cf6', '#ef4444'][i] }))} />
        </Card>
        <Card title="Request sources"><Donut data={data.sources.map((d) => ({ ...d, name: d.source.replace('_', ' ') }))} nameKey="name" valueKey="count" /></Card>
      </div>
      <div className="grid xl:grid-cols-2 gap-6">
        <Card title="Resource match funnel"><Bars data={data.match_funnel.map((d) => ({ ...d, name: label(STATUS, d.stage) }))} x="name" bars={[{ key: 'count', name: 'Matches', color: '#1e3a6e' }]} /></Card>
        <Card title="Shelter occupancy"><Bars data={data.shelters.map((s) => ({ name: s.name.split(',')[0].replace(' (SIMULATED)', ''), occupancy: s.occupancy, free: s.capacity - s.occupancy }))} x="name" horizontal stacked height={260} bars={[{ key: 'occupancy', name: 'Occupied', color: '#2563eb' }, { key: 'free', name: 'Free', color: '#bae6fd' }]} /></Card>
      </div>
    </div>
  )
}

function Impact() {
  const { data, loading, error, reload, fromCache, savedAt } = useApi('/api/analytics/impact', { cache: true })
  if (loading && !data) return <Loading />
  if (error) return <ErrorState error={error} onRetry={reload} />
  const cats = Object.keys(CATEGORIES)
  return (
    <div className="space-y-6">
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      <Alert tone="orange">{data.disclaimer}</Alert>
      <div className="grid xl:grid-cols-5 gap-6">
        <Card title="Demand density (open requests weighted by urgency)" className="xl:col-span-3" bodyClass="p-2">
          <MapView height={460} zoom={11}>
            {data.areas.map((a) => <Circle key={a.area} center={[a.lat, a.lng]} radius={3000} pathOptions={{ color: '#2563eb', weight: 1, fillOpacity: 0.04 + a.severity * 0.1, dashArray: '4 4' }}><Popup><strong>{a.area}</strong> · severity {Math.round(a.severity * 100)}% (simulated)</Popup></Circle>)}
            {data.heat.map((h, i) => <Circle key={i} center={[h.lat, h.lng]} radius={350 + h.weight * 450} pathOptions={{ stroke: false, fillColor: h.weight >= 1 ? '#dc2626' : h.weight >= 0.75 ? '#f97316' : '#2563eb', fillOpacity: 0.28 }} />)}
          </MapView>
        </Card>
        <Card title="Demand distribution by area (units requested)" className="xl:col-span-2">
          <Bars horizontal stacked height={460} x="area" data={data.areas.map((a) => ({ area: a.area, ...a.demand_by_category }))} bars={cats.map((c) => ({ key: c, name: CATEGORIES[c].label, color: CATEGORIES[c].color }))} />
        </Card>
      </div>
      <Card title="Area intelligence summary" bodyClass="p-0">
        <div className="overflow-x-auto"><table className="table-base">
          <thead><tr><th>Area</th><th>Simulated severity</th><th>Est. affected</th><th>Requests (confirmed / unverified)</th><th>Registered vulnerable</th><th>Shelter free</th><th>Shortages</th><th>Underserved</th></tr></thead>
          <tbody>{data.areas.map((a) => <tr key={a.area}><td className="font-medium">{a.area}</td><td>{Math.round(a.severity * 100)}%</td><td className="tabular-nums">{fmtNum(a.estimated_affected_population)}</td><td className="tabular-nums">{a.confirmed_requests} / {a.unverified_reports + a.sos_alerts}</td><td className="tabular-nums">{a.registered_vulnerable}</td><td className="tabular-nums">{a.shelter_capacity - a.shelter_occupancy}</td><td className="text-xs">{a.shortages.join(', ') || '—'}</td><td className="capitalize">{a.level} ({a.underserved_score})</td></tr>)}</tbody>
        </table></div>
      </Card>
    </div>
  )
}

export default function Analytics() {
  const [tab, setTab] = useState('overview')
  return (
    <div>
      <PageHeader title="Analytics & Disaster Impact Intelligence" subtitle="Operational analytics from live data, and geographic impact analysis from simulated scenario data." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Operational analytics' }, { value: 'impact', label: 'Impact intelligence' }]} />
      {tab === 'overview' ? <Overview /> : <Impact />}
    </div>
  )
}
