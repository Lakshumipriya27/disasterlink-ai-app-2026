import { CheckCircle2, CloudOff, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import LocationPicker from '../../components/LocationPicker'
import { Alert, Button, Card, Check, Field, Input, Textarea } from '../../components/ui'
import { api } from '../../lib/api'
import { VP_CATEGORIES } from '../../lib/constants'
import { useSync } from '../../lib/sync.jsx'

export default function SupportRegister() {
  const { online } = useSync()
  const [f, setF] = useState({ display_name: '', contact_phone: '', address_hint: '', categories: [], assistance_requirements: '', accessibility_requirements: '', household_size: 1, emergency_contact: '', consent: false })
  const [loc, setLoc] = useState({ lat: null, lng: null, area: '' })
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (f.display_name.trim().length < 2) return setErr('Please enter a name or how you would like to be addressed.')
    if (!loc.area && loc.lat == null) return setErr('Please share your location or select your area.')
    if (!f.consent) return setErr('Consent is required to register.')
    setBusy(true)
    try { setDone(await api('/api/vulnerable/register', { method: 'POST', auth: false, body: { ...f, household_size: Number(f.household_size) || 1, lat: loc.lat, lng: loc.lng, area: loc.area || '' } })) }
    catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  if (done) return (
    <div className="max-w-xl mx-auto px-4 py-16 text-center">
      <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" /><h1 className="mt-3 text-2xl font-bold">You are registered</h1>
      <p className="mt-2 text-slate-600">Registration ID <strong className="font-mono">{done.id}</strong>. {done.message}</p>
    </div>
  )
  return (
    <div className="bg-canvas">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><ShieldCheck className="w-8 h-8 text-blue-600" />Register for extra support</h1>
        <p className="mt-2 text-slate-600">For elderly people living alone, people with disabilities or medical needs. During a disaster, coordinators can plan welfare checks and suitable shelter for registered people. Registration is voluntary, private and can be withdrawn.</p>
        {!online && <Alert tone="orange" icon={CloudOff} className="mt-4">Registration needs an internet connection.</Alert>}
        <form onSubmit={submit} className="mt-6 space-y-6">
          <Card title="Your details">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name (or preferred name)" htmlFor="dn" required><Input id="dn" value={f.display_name} onChange={set('display_name')} /></Field>
              <Field label="Phone (optional)" htmlFor="cp"><Input id="cp" value={f.contact_phone} onChange={set('contact_phone')} inputMode="tel" /></Field>
              <Field label="Household size" htmlFor="hs"><Input id="hs" type="number" min={1} value={f.household_size} onChange={set('household_size')} /></Field>
              <Field label="Emergency contact (optional)" htmlFor="ec"><Input id="ec" value={f.emergency_contact} onChange={set('emergency_contact')} /></Field>
            </div>
          </Card>
          <Card title="Support needs">
            <div className="grid sm:grid-cols-2 gap-3">
              {Object.entries(VP_CATEGORIES).map(([k, l]) => <Check key={k} id={k} label={l} checked={f.categories.includes(k)} onChange={() => set('categories')(f.categories.includes(k) ? f.categories.filter((x) => x !== k) : [...f.categories, k])} />)}
            </div>
            <div className="mt-4 grid gap-4">
              <Field label="Assistance requirements" htmlFor="ar"><Textarea id="ar" rows={2} value={f.assistance_requirements} onChange={set('assistance_requirements')} placeholder="e.g. weekly dialysis, needs help to walk" /></Field>
              <Field label="Accessibility requirements" htmlFor="acr"><Textarea id="acr" rows={2} value={f.accessibility_requirements} onChange={set('accessibility_requirements')} placeholder="e.g. wheelchair-accessible toilet, audio instructions" /></Field>
            </div>
          </Card>
          <Card title="Location">
            <LocationPicker value={loc} onChange={setLoc} />
            <div className="mt-3"><Field label="Address hint (optional)" htmlFor="ah"><Input id="ah" value={f.address_hint} onChange={set('address_hint')} /></Field></div>
          </Card>
          <Card title="Consent">
            <Check id="consent" checked={f.consent} onChange={set('consent')} label="I consent to DisasterLink AI storing this information and sharing it only with authorised relief coordinators for disaster assistance."
              description="Registering does not mean you are in danger and does not trigger an emergency response. Use SOS if you need help now. You can ask a coordinator to withdraw your registration at any time." />
          </Card>
          {err && <Alert tone="red">{err}</Alert>}
          <Button type="submit" size="lg" loading={busy} disabled={!online}>Register</Button>
        </form>
      </div>
    </div>
  )
}
