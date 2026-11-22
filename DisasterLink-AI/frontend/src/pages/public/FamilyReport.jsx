import { CheckCircle2, HeartHandshake, Lock } from 'lucide-react'
import { useState } from 'react'
import { Alert, Button, Card, Check, Field, Input, Select, Textarea } from '../../components/ui'
import { api } from '../../lib/api'
import { AREAS } from '../../lib/constants'

export default function FamilyReport() {
  const [f, setF] = useState({ report_type: 'missing', person_name: '', age: '', gender: '', description: '', family_reference: '', last_known_location: '', area: '', last_seen_at: '', reporter_contact: '', consent_to_share: false })
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  const [statusId, setStatusId] = useState('')
  const [status, setStatus] = useState(null)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (f.person_name.trim().length < 2) return setErr('Enter the person’s name or a description.')
    if (f.reporter_contact.trim().length < 3) return setErr('Enter a contact so a coordinator can reach you.')
    const c = AREAS[f.area]
    setBusy(true)
    try {
      setDone(await api('/api/family/reports', { method: 'POST', auth: false, body: {
        ...f, age: f.age === '' ? null : Number(f.age), last_seen_at: f.last_seen_at ? new Date(f.last_seen_at).toISOString() : null,
        lat: c ? c[0] : null, lng: c ? c[1] : null } }))
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  const check = async () => { setStatus(null); try { setStatus(await api(`/api/family/reports/${statusId.trim()}/status`, { auth: false })) } catch (e) { setStatus({ error: e.message }) } }

  return (
    <div className="bg-canvas">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3"><HeartHandshake className="w-8 h-8 text-blue-600" />Family reconnection</h1>
        <p className="mt-2 text-slate-600">Report a missing family member, or a person you have found. Reports are never published. Coordinators review possible matches and contact both sides only after verification and consent.</p>
        <Alert tone="blue" icon={Lock} className="mt-4">There is no public missing-person database. Only authorised coordinators can see reports.</Alert>
        {done ? (
          <Card className="mt-6"><div className="text-center py-6"><CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" /><p className="mt-2 font-semibold">Report {done.id} received</p><p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{done.message}</p></div></Card>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-6">
            <Card title="Report">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Report type" htmlFor="rt"><Select id="rt" value={f.report_type} onChange={set('report_type')}><option value="missing">I am looking for someone (missing)</option><option value="found">I have found / am sheltering someone</option></Select></Field>
                <Field label="Person’s name" htmlFor="pn" required><Input id="pn" value={f.person_name} onChange={set('person_name')} /></Field>
                <Field label="Approximate age" htmlFor="ag"><Input id="ag" type="number" min={0} max={120} value={f.age} onChange={set('age')} /></Field>
                <Field label="Gender" htmlFor="gd"><Select id="gd" value={f.gender} onChange={set('gender')}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></Select></Field>
                <Field label="Last known / found location" htmlFor="ll"><Input id="ll" value={f.last_known_location} onChange={set('last_known_location')} /></Field>
                <Field label="Area" htmlFor="ar"><Select id="ar" value={f.area} onChange={set('area')}><option value="">Select…</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select></Field>
                <Field label="Time last seen / found" htmlFor="ls"><Input id="ls" type="datetime-local" value={f.last_seen_at} onChange={set('last_seen_at')} /></Field>
                <Field label="Family reference" htmlFor="fr" hint="e.g. “Mother - Priya”"><Input id="fr" value={f.family_reference} onChange={set('family_reference')} /></Field>
              </div>
              <div className="mt-4"><Field label="Description (clothing, features)" htmlFor="ds"><Textarea id="ds" rows={3} value={f.description} onChange={set('description')} /></Field></div>
            </Card>
            <Card title="Your contact (coordinators only)">
              <Field label="Phone or contact" htmlFor="rc" required><Input id="rc" value={f.reporter_contact} onChange={set('reporter_contact')} /></Field>
              <div className="mt-4"><Check id="cs" checked={f.consent_to_share} onChange={set('consent_to_share')} label="If a coordinator verifies a match, I consent to my contact being shared with the matched family." /></div>
            </Card>
            {err && <Alert tone="red">{err}</Alert>}
            <Button type="submit" size="lg" loading={busy}>Submit report</Button>
          </form>
        )}
        <Card title="Check report status" className="mt-8">
          <div className="flex gap-2"><Input aria-label="Report ID" value={statusId} onChange={(e) => setStatusId(e.target.value)} placeholder="MPR-…" /><Button onClick={check} disabled={!statusId.trim()}>Check</Button></div>
          {status && <p className="mt-3 text-sm">{status.error ? <span className="text-orange-700">{status.error}</span> : <>Status: <strong className="capitalize">{status.status}</strong></>}</p>}
        </Card>
      </div>
    </div>
  )
}
