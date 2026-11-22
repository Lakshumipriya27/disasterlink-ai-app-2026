import { AlertTriangle, CheckCircle2, Home, Search, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Marker, Popup } from 'react-leaflet'
import { api } from '../lib/api'
import LocationPicker from './LocationPicker'
import MapView, { pinIcon } from './MapView'
import { Alert, Badge, Button, Card, Check, Field, Input, ProgressBar } from './ui'

export default function ShelterFinder() {
  const [loc, setLoc] = useState({ lat: 12.9815, lng: 80.218, area: 'Velachery' })
  const [f, setF] = useState({ family_size: 1, wheelchair: false, medical: false, children: false, elderly: false, women_safe: false, needs_food: true, needs_water: true })
  const [res, setRes] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))

  const search = async () => {
    if (loc.lat == null) return setErr('Set a location first.')
    setBusy(true); setErr('')
    try { setRes(await api('/api/shelters/match', { method: 'POST', auth: false, body: { ...f, family_size: Number(f.family_size) || 1, lat: loc.lat, lng: loc.lng } })) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="grid lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card title="Your needs">
          <div className="space-y-3">
            <Field label="Number of people" htmlFor="fs"><Input id="fs" type="number" min={1} value={f.family_size} onChange={set('family_size')} /></Field>
            <Check id="wc" label="Wheelchair user" description="Only shelters with VERIFIED wheelchair access are recommended" checked={f.wheelchair} onChange={set('wheelchair')} />
            <Check id="md" label="Needs basic medical support" checked={f.medical} onChange={set('medical')} />
            <Check id="ch" label="Children in the group" checked={f.children} onChange={set('children')} />
            <Check id="el" label="Elderly person in the group" checked={f.elderly} onChange={set('elderly')} />
            <Check id="ws" label="Women-safe space preferred" checked={f.women_safe} onChange={set('women_safe')} />
          </div>
        </Card>
        <Card title="Location"><LocationPicker value={loc} onChange={setLoc} showMap={false} /></Card>
        {err && <Alert tone="red">{err}</Alert>}
        <Button size="lg" icon={Search} className="w-full" onClick={search} loading={busy}>Find suitable shelters</Button>
      </div>
      <div className="lg:col-span-3 space-y-4">
        {!res ? (
          <Card><div className="py-10 text-center text-sm text-slate-500"><Home className="w-8 h-8 mx-auto text-slate-300 mb-2" />Enter your needs and search to see recommended shelters.</div></Card>
        ) : (
          <>
            {res.note && <Alert tone="blue" icon={AlertTriangle}>{res.note}</Alert>}
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <MapView height={260} center={[loc.lat, loc.lng]} zoom={11}>
                <Marker position={[loc.lat, loc.lng]} icon={pinIcon('#0b1a36', 18)}><Popup>Your location</Popup></Marker>
                {res.recommendations.map((s, i) => (
                  <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(i === 0 ? '#2563eb' : '#06b6d4', 24, String(i + 1))}><Popup><strong>{s.name}</strong><br />{s.remaining} places free · {s.distance_km} km</Popup></Marker>
                ))}
              </MapView>
            </div>
            {res.recommendations.length === 0 && <Alert tone="orange">No shelter currently meets all hard requirements. A coordinator should arrange alternatives.</Alert>}
            {res.recommendations.map((s, i) => (
              <Card key={s.id} className={i === 0 ? 'ring-2 ring-blue-200' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">{i === 0 && <Badge tone="blue">Best match</Badge>}<p className="font-semibold text-navy-800">{s.name}</p></div>
                    <p className="text-xs text-slate-500 mt-0.5">{s.area} · {s.distance_km} km · {s.contact}</p>
                  </div>
                  <span className="text-sm font-semibold text-blue-700 tabular-nums">{s.score}</span>
                </div>
                <div className="mt-3"><ProgressBar value={(1 - s.remaining / s.capacity) * 100} tone={s.remaining / s.capacity < 0.15 ? 'orange' : 'cyan'} /><p className="text-xs text-slate-500 mt-1">{s.remaining} of {s.capacity} places free</p></div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {s.reasons.map((r) => <span key={r} className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />{r}</span>)}
                  {s.warnings.map((w) => <span key={w} className="inline-flex items-center gap-1 text-xs text-orange-700"><AlertTriangle className="w-3.5 h-3.5" />{w}</span>)}
                </div>
              </Card>
            ))}
            {res.excluded.length > 0 && (
              <Card title="Not recommended" subtitle="Excluded because they do not meet a requirement">
                <ul className="space-y-2 text-sm">{res.excluded.map((e) => <li key={e.id} className="flex items-start gap-2"><XCircle className="w-4 h-4 text-slate-400 mt-0.5" /><span><strong className="font-medium text-slate-700">{e.name}</strong> ({e.distance_km} km) – {e.reason}</span></li>)}</ul>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
