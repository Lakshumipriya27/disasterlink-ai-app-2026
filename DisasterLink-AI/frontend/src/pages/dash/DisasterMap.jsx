import { Crosshair, Layers, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Circle, CircleMarker, Marker, Popup } from 'react-leaflet'
import { Link } from 'react-router-dom'
import MapView, { FlyTo, pinIcon } from '../../components/MapView'
import { Alert, Button, CachedBanner, Card, Check, ErrorState, Input, Loading, PageHeader, Select } from '../../components/ui'
import { useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { CATEGORIES, URGENCY } from '../../lib/constants'
import { useSync } from '../../lib/sync.jsx'

const LAYERS = [
  ['requests', 'Emergency requests'], ['sos', 'SOS alerts'], ['resources', 'Relief resources'], ['shelters', 'Temporary shelters'],
  ['zones', 'Affected zones (simulated)'], ['underserved', 'Potentially underserved'], ['vulnerable', 'Vulnerable people (restricted)'],
]
const RES_COLOR = '#0891b2'
const LEVEL_COLOR = { high: '#dc2626', moderate: '#f97316', low: '#94a3b8' }

export default function DisasterMap() {
  const { isStaff } = useAuth()
  const { online } = useSync()
  const { data, loading, error, reload, fromCache, savedAt } = useApi('/api/analytics/map', { cache: true })
  const [on, setOn] = useState({ requests: true, sos: true, resources: true, shelters: true, zones: true, underserved: false, vulnerable: false })
  const [cat, setCat] = useState('')
  const [urg, setUrg] = useState('')
  const [fly, setFly] = useState(null)
  const [coords, setCoords] = useState('')
  const [search, setSearch] = useState('')
  const [searchMsg, setSearchMsg] = useState('')
  const [found, setFound] = useState(null)

  const reqs = useMemo(() => (data?.requests || []).filter((r) => (!cat || r.category === cat) && (!urg || r.urgency === urg) && r.status !== 'fulfilled'), [data, cat, urg])

  const goCoords = () => {
    const m = coords.split(/[,\s]+/).map(Number)
    if (m.length >= 2 && !m.some(Number.isNaN) && Math.abs(m[0]) <= 90 && Math.abs(m[1]) <= 180) { setFly([m[0], m[1]]); setFound({ pos: [m[0], m[1]], label: 'Entered coordinates' }); setSearchMsg('') }
    else setSearchMsg('Enter coordinates as "lat, lng", e.g. 12.98, 80.22')
  }
  const doSearch = async () => {
    if (!search.trim()) return
    if (!online) { setSearchMsg('Location search needs an internet connection. Use coordinate entry instead.'); return }
    setSearchMsg('Searching…')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(search + ', Chennai')}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      const j = await res.json()
      if (!j.length) { setSearchMsg('No match found.'); return }
      const pos = [Number(j[0].lat), Number(j[0].lon)]
      setFly(pos); setFound({ pos, label: j[0].display_name }); setSearchMsg('')
    } catch { setSearchMsg('Search service unavailable.') }
  }

  return (
    <div>
      <PageHeader title="Disaster Map" subtitle="Requests, SOS alerts, resources, shelters and affected zones - simulated Chennai coordinates." />
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      {loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : data && (
        <div className="grid xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-3">
            <div className="card p-3 grid sm:grid-cols-2 gap-2">
              <form onSubmit={(e) => { e.preventDefault(); doSearch() }} className="flex gap-2"><Input aria-label="Search place" placeholder="Search a place (online)" value={search} onChange={(e) => setSearch(e.target.value)} /><Button type="submit" variant="secondary" icon={Search}>Find</Button></form>
              <form onSubmit={(e) => { e.preventDefault(); goCoords() }} className="flex gap-2"><Input aria-label="Coordinates" placeholder="lat, lng" value={coords} onChange={(e) => setCoords(e.target.value)} /><Button type="submit" variant="secondary" icon={Crosshair}>Go</Button></form>
              {searchMsg && <p className="text-xs text-slate-600 sm:col-span-2">{searchMsg}</p>}
            </div>
            <div className="card p-2">
              <MapView height={620} zoom={11}>
                {fly && <FlyTo center={fly} zoom={14} />}
                {found && <Marker position={found.pos} icon={pinIcon('#0b1a36', 18)}><Popup>{found.label}</Popup></Marker>}
                {on.zones && data.impact_zones.map((z) => (
                  <Circle key={z.area} center={[z.lat, z.lng]} radius={z.radius_km * 1000} pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#3b82f6', fillOpacity: 0.06 + z.severity * 0.12 }}>
                    <Popup><strong>{z.area}</strong> (SIMULATED)<br />Severity {Math.round(z.severity * 100)}% · est. {z.estimated_affected_population.toLocaleString()} affected<br /><span className="text-slate-500">{z.note}</span></Popup>
                  </Circle>
                ))}
                {on.underserved && data.underserved.filter((u) => u.level !== 'low').map((u) => (
                  <Circle key={u.area} center={[u.lat, u.lng]} radius={2200} pathOptions={{ color: LEVEL_COLOR[u.level], dashArray: '6 6', weight: 2, fillOpacity: 0.05 }}>
                    <Popup><strong>{u.area}</strong><br />Potentially underserved ({u.level}, score {u.score}).<br /><Link to="/app/unreported">View analysis</Link></Popup>
                  </Circle>
                ))}
                {on.shelters && data.shelters.map((s) => (
                  <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon('#7c3aed', 24, 'S')}>
                    <Popup><strong>{s.name}</strong><br />{s.remaining} of {s.capacity} places free{s.wheelchair_accessible && s.accessibility_verified ? ' · ♿ verified' : ''}{s.medical_support ? ' · medical' : ''}</Popup>
                  </Marker>
                ))}
                {on.resources && data.resources.map((r) => (
                  <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={6} pathOptions={{ color: '#fff', weight: 1.5, fillColor: RES_COLOR, fillOpacity: r.availability === 'depleted' ? 0.3 : 0.9 }}>
                    <Popup><strong>{r.name}</strong><br />{r.available_quantity} {r.unit} available · {r.organization}<br />{r.location_name}</Popup>
                  </CircleMarker>
                ))}
                {on.requests && reqs.map((r) => (
                  <CircleMarker key={r.id} center={[r.lat, r.lng]} radius={r.urgency === 'critical' ? 10 : r.urgency === 'high' ? 8 : 6}
                    pathOptions={{ color: '#fff', weight: 2, fillColor: URGENCY[r.urgency].color, fillOpacity: r.verification === 'verified' ? 0.95 : 0.55 }}>
                    <Popup><strong>{r.id}</strong> · {CATEGORIES[r.category]?.label} · {URGENCY[r.urgency].label}<br />{r.description}<br /><span className="text-slate-500">{r.people} people · {r.verification}{r.is_simulated ? ' · SIMULATED' : ''}</span><br /><Link to={`/app/requests?id=${r.id}`}>Open request</Link></Popup>
                  </CircleMarker>
                ))}
                {on.sos && data.sos.filter((s) => !['assisted', 'closed'].includes(s.status)).map((s) => (
                  <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon('#dc2626', 28, 'SOS')}>
                    <Popup><strong>{s.id}</strong>{s.silent ? ' (silent)' : ''}<br />{s.category} · {s.status}<br /><Link to="/app/sos">Open SOS monitoring</Link></Popup>
                  </Marker>
                ))}
                {on.vulnerable && isStaff && data.vulnerable.map((v) => (
                  <CircleMarker key={v.id} center={[v.lat, v.lng]} radius={5} pathOptions={{ color: '#7c2d12', weight: 2, fillColor: '#fde68a', fillOpacity: 1 }}>
                    <Popup><strong>{v.display_name}</strong> ({v.id})<br />{v.requirements}<br /><span className="text-slate-500">Registered support need - not an active emergency.</span></Popup>
                  </CircleMarker>
                ))}
              </MapView>
            </div>
          </div>
          <div className="space-y-4">
            <Card title="Layers" icon={Layers}>
              <div className="space-y-2.5">
                {LAYERS.map(([k, l]) => (k === 'vulnerable' && !isStaff ? (
                  <p key={k} className="text-xs text-slate-400">Vulnerable-person layer: coordinators only</p>
                ) : <Check key={k} id={`l-${k}`} label={l} checked={on[k]} onChange={(v) => setOn({ ...on, [k]: v })} />))}
              </div>
            </Card>
            <Card title="Filter requests">
              <div className="space-y-2">
                <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}</Select>
                <Select aria-label="Priority" value={urg} onChange={(e) => setUrg(e.target.value)}><option value="">All priorities</option>{Object.entries(URGENCY).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}</Select>
                <p className="text-xs text-slate-500">{reqs.length} open requests shown</p>
              </div>
            </Card>
            <Card title="Legend">
              <ul className="space-y-2 text-xs text-slate-600">
                {Object.entries(URGENCY).map(([k, u]) => <li key={k} className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: u.color }} />{u.label} request (faded = unverified)</li>)}
                <li className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-red-600 text-white text-[7px] font-bold flex items-center justify-center">SOS</span>Open SOS alert</li>
                <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: RES_COLOR }} />Relief resource</li>
                <li className="flex items-center gap-2"><span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[8px] font-bold flex items-center justify-center">S</span>Shelter</li>
                <li className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border border-blue-500 bg-blue-100" />Simulated affected zone</li>
                <li className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border-2 border-dashed border-red-500" />Potentially underserved</li>
              </ul>
            </Card>
            <Alert tone="gray">All incidents shown are SIMULATED for demonstration. Map tiles © OpenStreetMap contributors; tiles you view are cached for offline use.</Alert>
          </div>
        </div>
      )}
    </div>
  )
}
