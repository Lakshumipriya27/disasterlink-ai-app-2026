import { CheckCircle2, CloudOff, HandHeart } from 'lucide-react'
import { useState } from 'react'
import { Alert, Button, Card, Check, Field, Input, Select, Textarea } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { AREAS, ASSIST_TYPES } from '../../lib/constants'
import { useSync } from '../../lib/sync.jsx'

export default function VolunteerRegister() {
  const { online } = useSync()
  const orgs = useApi('/api/volunteers/organizations/public', { cache: true })
  const [f, setF] = useState({ name: '', phone: '', organization_id: '', organization_name: '', assistance_types: [], service_area: '', skills: '', has_vehicle: false })
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))
  const toggle = (t) => set('assistance_types')(f.assistance_types.includes(t) ? f.assistance_types.filter((x) => x !== t) : [...f.assistance_types, t])

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (f.name.trim().length < 2) return setErr('Please enter your name.')
    if (!f.assistance_types.length) return setErr('Select at least one way you can help.')
    if (!f.service_area) return setErr('Select your service area.')
    setBusy(true)
    try { setDone(await api('/api/volunteers/register', { method: 'POST', auth: false, body: { ...f, organization_id: f.organization_id || null } })) }
    catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }

  if (done) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
      <h1 className="mt-3 text-2xl font-bold">Registration received</h1>
      <p className="mt-2 text-slate-600">Volunteer ID <strong className="font-mono">{done.id}</strong>. {done.message}</p>
    </div>
  )
  return (
    <div className="bg-canvas">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><HandHeart className="w-8 h-8 text-blue-600" />Volunteer registration</h1>
        <p className="mt-2 text-slate-600">Individuals and relief organisations can register. Coordinators review registrations and assign tasks.</p>
        {!online && <Alert tone="orange" icon={CloudOff} className="mt-4">Registration needs an internet connection. Please try again when online.</Alert>}
        <form onSubmit={submit} className="mt-6 space-y-6">
          <Card title="About you">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full name" htmlFor="n" required><Input id="n" value={f.name} onChange={set('name')} /></Field>
              <Field label="Phone" htmlFor="ph"><Input id="ph" value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
              <Field label="Organisation" htmlFor="o">
                <Select id="o" value={f.organization_id} onChange={set('organization_id')}>
                  <option value="">Independent / new organisation</option>
                  {(orgs.data || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </Field>
              {!f.organization_id && <Field label="New organisation name (optional)" htmlFor="on"><Input id="on" value={f.organization_name} onChange={set('organization_name')} /></Field>}
              <Field label="General service area" htmlFor="a" required>
                <Select id="a" value={f.service_area} onChange={set('service_area')}><option value="">Select…</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select>
              </Field>
            </div>
          </Card>
          <Card title="How can you help?">
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(ASSIST_TYPES).map(([k, l]) => <Check key={k} id={k} label={l} checked={f.assistance_types.includes(k)} onChange={() => toggle(k)} />)}
            </div>
            <div className="mt-4 space-y-4">
              <Field label="Relevant skills" htmlFor="sk"><Textarea id="sk" rows={2} value={f.skills} onChange={set('skills')} placeholder="e.g. first aid, swimming, sign language, driving" /></Field>
              <Check id="veh" label="I have a vehicle I can use for relief work" checked={f.has_vehicle} onChange={set('has_vehicle')} />
            </div>
          </Card>
          {err && <Alert tone="red">{err}</Alert>}
          <Button type="submit" size="lg" loading={busy} disabled={!online}>Register</Button>
        </form>
      </div>
    </div>
  )
}
