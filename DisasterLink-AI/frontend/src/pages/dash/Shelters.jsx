import { Accessibility, Droplets, HeartPulse, Plus, Users, Utensils } from 'lucide-react'
import { useState } from 'react'
import ShelterFinder from '../../components/ShelterFinder'
import { Alert, Badge, Button, CachedBanner, Card, Check, ErrorState, Field, Input, Loading, Modal, PageHeader, ProgressBar, StatusBadge, Tabs } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { AREAS } from '../../lib/constants'

function Occ({ s, onSaved }) {
  const [v, setV] = useState(s.occupancy)
  const [err, setErr] = useState('')
  const save = async () => { setErr(''); try { await api(`/api/shelters/${s.id}`, { method: 'PATCH', body: { occupancy: Number(v) } }); onSaved() } catch (e) { setErr(e.message) } }
  return <div className="flex items-center gap-2"><Input aria-label="Occupancy" type="number" min={0} max={s.capacity} value={v} onChange={(e) => setV(e.target.value)} className="!w-24 !py-1" /><Button size="sm" variant="secondary" onClick={save} disabled={Number(v) === s.occupancy}>Update</Button>{err && <span className="text-xs text-red-600">{err}</span>}</div>
}

function AddShelter({ open, onClose, onSaved }) {
  const [f, setF] = useState({ name: '', area: '', address: '', capacity: 100, occupancy: 0, contact: '', wheelchair_accessible: false, accessibility_verified: false, accessible_toilets: false, drinking_water: true, food_available: true, medical_support: false, family_rooms: false, women_safe_space: false })
  const [err, setErr] = useState('')
  const save = async () => {
    setErr(''); if (!f.area || f.name.length < 2) return setErr('Name and area are required.')
    const c = AREAS[f.area]
    try { await api('/api/shelters', { method: 'POST', body: { ...f, capacity: Number(f.capacity), occupancy: Number(f.occupancy), lat: c[0] + 0.004, lng: c[1] + 0.004 } }); onSaved(); onClose() } catch (e) { setErr(e.message) }
  }
  const b = (k, l) => <Check id={`s-${k}`} label={l} checked={f[k]} onChange={(v) => setF({ ...f, [k]: v })} />
  return (
    <Modal open={open} onClose={onClose} title="Add shelter" wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Name" required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Area" required><select className="input" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}><option value="">Select…</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</select></Field>
        <Field label="Capacity"><Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
        <Field label="Current occupancy"><Input type="number" min={0} value={f.occupancy} onChange={(e) => setF({ ...f, occupancy: e.target.value })} /></Field>
        <Field label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="Contact"><Input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-4">{b('wheelchair_accessible', 'Wheelchair accessible')}{b('accessibility_verified', 'Accessibility verified on site')}{b('accessible_toilets', 'Accessible toilets')}{b('drinking_water', 'Drinking water')}{b('food_available', 'Food available')}{b('medical_support', 'Basic medical support')}{b('family_rooms', 'Family rooms')}{b('women_safe_space', 'Women-safe space')}</div>
      {err && <Alert tone="red" className="mt-3">{err}</Alert>}
    </Modal>
  )
}

export default function Shelters() {
  const { isStaff } = useAuth()
  const [tab, setTab] = useState('list')
  const [add, setAdd] = useState(false)
  const { data, loading, error, reload, fromCache, savedAt } = useApi('/api/shelters', { cache: true })
  const tot = (data || []).reduce((a, s) => ({ cap: a.cap + s.capacity, occ: a.occ + s.occupancy }), { cap: 0, occ: 0 })
  const F = ({ on, icon: I, l }) => <span className={`inline-flex items-center gap-1 text-xs ${on ? 'text-emerald-700' : 'text-slate-300 line-through'}`}><I className="w-3.5 h-3.5" />{l}</span>
  return (
    <div>
      <PageHeader title="Shelter Management" subtitle="Capacity, occupancy, accessibility and facilities, with intelligent shelter matching." actions={isStaff && <Button icon={Plus} onClick={() => setAdd(true)}>Add shelter</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'list', label: 'Shelters', count: data?.length }, { value: 'match', label: 'Shelter matching' }]} />
      <CachedBanner fromCache={fromCache} savedAt={savedAt} />
      {tab === 'match' ? <ShelterFinder /> : loading && !data ? <Loading /> : error ? <ErrorState error={error} onRetry={reload} /> : (
        <>
          <div className="card p-4 mb-5 flex flex-wrap items-center gap-6 text-sm"><span className="flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" />Total capacity <strong>{tot.cap}</strong></span><span>Occupied <strong>{tot.occ}</strong></span><span>Free <strong className="text-emerald-700">{tot.cap - tot.occ}</strong></span><div className="flex-1 min-w-[160px]"><ProgressBar value={(tot.occ / Math.max(1, tot.cap)) * 100} /></div></div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.map((s) => {
              const pct = (s.occupancy / s.capacity) * 100
              return (
                <Card key={s.id} bodyClass="p-5">
                  <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-navy-800 leading-snug">{s.name}</p><p className="text-xs text-slate-500 mt-0.5">{s.area} · {s.contact}</p></div><StatusBadge status={s.status} /></div>
                  <div className="mt-4"><div className="flex justify-between text-xs text-slate-600 mb-1"><span>{s.occupancy} / {s.capacity} occupied</span><span className="font-semibold">{s.remaining} free</span></div><ProgressBar value={pct} tone={pct > 90 ? 'red' : pct > 70 ? 'orange' : 'cyan'} /></div>
                  <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
                    <F on={s.wheelchair_accessible && s.accessibility_verified} icon={Accessibility} l={s.wheelchair_accessible && !s.accessibility_verified ? 'Wheelchair (unverified)' : 'Wheelchair verified'} />
                    <F on={s.drinking_water} icon={Droplets} l="Water" /><F on={s.food_available} icon={Utensils} l="Food" /><F on={s.medical_support} icon={HeartPulse} l="Medical" /><F on={s.family_rooms} icon={Users} l="Family rooms" />
                  </div>
                  {s.is_simulated && <Badge tone="purple" className="mt-3">SIMULATED</Badge>}
                  {isStaff && <div className="mt-4 pt-4 border-t border-slate-100"><Occ s={s} onSaved={() => reload(true)} /></div>}
                </Card>
              )
            })}
          </div>
        </>
      )}
      <AddShelter open={add} onClose={() => setAdd(false)} onSaved={() => reload(true)} />
    </div>
  )
}
