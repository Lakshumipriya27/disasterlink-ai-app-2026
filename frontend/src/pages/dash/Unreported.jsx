import { Info, Radar, Users } from 'lucide-react'
import { Circle, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import MapView from '../../components/MapView'
import { Alert, Badge, CachedBanner, Card, ErrorState, Loading, PageHeader, ProgressBar } from '../../components/ui'
import { useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { fmtNum, timeAgo } from '../../lib/format'

const LV = { high: { tone: 'red', color: '#dc2626' }, moderate: { tone: 'orange', color: '#f97316' }, low: { tone: 'gray', color: '#94a3b8' } }

export default function Unreported() {
  const { isStaff } = useAuth()
  const { data, loading, error, reload, fromCache, savedAt } = useApi('/api/analytics/impact', { cache: true })
  return (
    <div>
      <PageHeader title="Unreported Need Detection" subtitle="Areas where people may need help but few or no requests have been received. Recommends welfare checks - never creates confirmed cases automatically." />
      <Alert tone="orange" icon={Info} className="mb-5" title="Estimates, not confirmed emergencies">An area with no reports does not mean nobody is affected. Figures labelled “estimated” come from SIMULATED impact data and stated assumptions{data?.assumptions ? ` (reporting rate ${data.assumptions.reporting_rate * 1000} requests per 1,000 affected; ${data.assumptions.need_share_at_full_severity * 100}% need at full severity)` : ''}.</Alert>
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <div className="grid xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            {data.areas.map((a) => (
              <Card key={a.area} bodyClass="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{a.area}</h3><Badge tone={LV[a.level].tone}>{a.level === 'low' ? 'Low concern' : `Potentially underserved · ${a.level}`}</Badge></div>
                    <p className="text-xs text-slate-500 mt-0.5">{a.impact_note} · simulated severity {Math.round(a.severity * 100)}%</p></div>
                  <div className="text-right"><p className="text-2xl font-semibold text-navy-800 tabular-nums">{a.underserved_score}</p><p className="text-[11px] text-slate-500">underserved score</p></div>
                </div>
                <div className="mt-2"><ProgressBar value={a.underserved_score} tone={a.level === 'high' ? 'red' : a.level === 'moderate' ? 'orange' : 'cyan'} /></div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3"><p className="text-[11px] font-semibold text-emerald-700 uppercase">Confirmed</p><p className="text-xl font-semibold text-navy-800">{a.confirmed_requests}</p><p className="text-[11px] text-slate-500">verified requests</p></div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-600 uppercase">Unverified</p><p className="text-xl font-semibold text-navy-800">{a.unverified_reports + a.sos_alerts}</p><p className="text-[11px] text-slate-500">reports + SOS</p></div>
                  <div className="rounded-lg border border-dashed border-orange-300 bg-orange-50/50 p-3"><p className="text-[11px] font-semibold text-orange-700 uppercase">Estimated</p><p className="text-xl font-semibold text-navy-800">~{fmtNum(a.estimated_unreported_people)}</p><p className="text-[11px] text-slate-500">people possibly unreported</p></div>
                </div>
                <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                  <p>Estimated affected population: <strong>{fmtNum(a.estimated_affected_population)}</strong></p>
                  <p>Requests received vs expected: <strong>{a.confirmed_requests + a.unverified_reports + a.sos_alerts} / {a.expected_requests}</strong> ({Math.round(a.reporting_ratio * 100)}%)</p>
                  <p>Registered vulnerable people: <strong>{a.registered_vulnerable}</strong> ({a.vulnerable_unchecked_48h} not checked in 48 h)</p>
                  <p>Last welfare check: <strong>{a.last_welfare_check ? timeAgo(a.last_welfare_check) : 'none recorded'}</strong></p>
                  {a.shortages.length > 0 && <p>Verified shortages: <strong>{a.shortages.join(', ')}</strong></p>}
                  <p>Shelter capacity in area: <strong>{a.shelter_capacity - a.shelter_occupancy} free of {a.shelter_capacity}</strong></p>
                </div>
                <div className="mt-4 rounded-lg bg-blue-50/60 border border-blue-100 p-3">
                  <p className="text-xs font-semibold text-blue-800">Recommended coordinator actions</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-blue-900 space-y-0.5">{a.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  {isStaff && a.registered_vulnerable > 0 && <Link to={`/app/vulnerable?area=${encodeURIComponent(a.area)}`} className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-700 hover:underline"><Users className="w-3.5 h-3.5" />Open registered people in {a.area}</Link>}
                </div>
              </Card>
            ))}
          </div>
          <div className="space-y-4">
            <Card title="Underserved map" icon={Radar} bodyClass="p-2">
              <MapView height={420} zoom={10}>
                {data.areas.map((a) => (
                  <Circle key={a.area} center={[a.lat, a.lng]} radius={1500 + a.underserved_score * 30} pathOptions={{ color: LV[a.level].color, fillColor: LV[a.level].color, fillOpacity: 0.18, weight: 2 }}>
                    <Popup><strong>{a.area}</strong><br />Score {a.underserved_score} ({a.level})<br />{a.confirmed_requests} confirmed · ~{a.estimated_unreported_people} estimated unreported</Popup>
                  </Circle>
                ))}
              </MapView>
            </Card>
            <Alert tone="gray">Score = low request volume relative to impact (40) + simulated severity (25) + unchecked registered vulnerable people (20) + verified shortages (15).</Alert>
          </div>
        </div>
      )}
    </div>
  )
}
