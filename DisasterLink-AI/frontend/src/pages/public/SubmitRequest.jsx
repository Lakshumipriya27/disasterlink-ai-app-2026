import { Brain, CheckCircle2, CloudOff, Mic, Send, Square } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import LocationPicker from '../../components/LocationPicker'
import { Alert, Badge, Button, Card, CategoryBadge, Check, Field, Input, Textarea, UrgencyBadge, cx } from '../../components/ui'
import { classifyLocal, urgencyLocal } from '../../lib/classifier'
import { CATEGORIES } from '../../lib/constants'
import { uuid } from '../../lib/db'
import { listen, sttSupported } from '../../lib/speech'
import { useSync } from '../../lib/sync.jsx'

const EMPTY = { description: '', category_hint: '', people_affected: 1, requester_name: '', contact_phone: '', location_name: '',
  has_elderly: false, has_children: false, has_disabled: false, has_medical_condition: false, has_pregnant: false }

export default function SubmitRequest() {
  const sync = useSync()
  const [f, setF] = useState(EMPTY)
  const [loc, setLoc] = useState({ lat: null, lng: null, area: '' })
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [listening, setListening] = useState(false)
  const [sttMsg, setSttMsg] = useState('')
  const recog = useRef(null)
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }))

  const preview = useMemo(() => {
    if (f.description.trim().length < 8) return null
    const c = classifyLocal(f.description, f.category_hint || undefined)
    const u = urgencyLocal({ text: f.description, category: c.category, people: Number(f.people_affected) || 1, elderly: f.has_elderly,
      children: f.has_children, disabled: f.has_disabled, medical: f.has_medical_condition, pregnant: f.has_pregnant })
    return { c, u }
  }, [f])

  const live = result && sync.items.find((i) => i.client_id === result.client_id)
  useEffect(() => () => recog.current?.stop(), [])

  const voice = () => {
    if (listening) { recog.current?.stop(); return }
    setSttMsg('')
    const base = f.description ? f.description + ' ' : ''
    recog.current = listen({
      onResult: (t) => setF((s) => ({ ...s, description: base + t })),
      onEnd: () => setListening(false),
      onError: (m) => { setSttMsg(m); setListening(false) },
    })
    if (recog.current) setListening(true)
  }

  const validate = () => {
    const e = {}
    if (f.description.trim().length < 10) e.description = 'Please describe what you need (at least 10 characters).'
    if (!(Number(f.people_affected) >= 1)) e.people_affected = 'Enter the number of people (1 or more).'
    if (loc.lat == null && !loc.area && !f.location_name.trim()) e.location = 'Share your location, choose an area, or type a landmark.'
    if (loc.lat != null && (Math.abs(loc.lat) > 90 || Math.abs(loc.lng) > 180 || Number.isNaN(loc.lat))) e.location = 'Coordinates are invalid.'
    if (f.contact_phone && !/^[0-9+\-\s]{6,20}$/.test(f.contact_phone)) e.contact_phone = 'Enter a valid phone number.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (ev) => {
    ev.preventDefault()
    if (!validate()) return
    setBusy(true)
    const payload = {
      client_id: uuid(), ...f, people_affected: Number(f.people_affected), category_hint: f.category_hint || null,
      lat: loc.lat, lng: loc.lng, area: loc.area || '', device_created_at: new Date().toISOString(),
    }
    const stored = await sync.enqueue('request', payload, { local_analysis: preview })
    setResult(stored)
    setBusy(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (result && live) {
    const ok = live.status === 'synced'
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className={cx('rounded-2xl border-2 p-6', ok ? 'border-emerald-300 bg-emerald-50' : 'border-orange-300 bg-orange-50')} role="alert">
          <div className="flex items-center gap-3">
            {ok ? <CheckCircle2 className="w-8 h-8 text-emerald-600" /> : <CloudOff className="w-8 h-8 text-orange-600" />}
            <h1 className={cx('text-2xl font-bold', ok ? 'text-emerald-800' : 'text-orange-800')}>{ok ? 'Request delivered to the server' : 'Saved on this device – not yet delivered'}</h1>
          </div>
          {ok ? (
            <p className="mt-3 text-emerald-900 text-lg">Request ID: <strong className="font-mono">{live.server_id}</strong>. Keep this ID to track your request.</p>
          ) : (
            <p className="mt-3 text-orange-900">{sync.online ? 'The server could not be reached right now.' : 'You are offline.'} Your request is stored safely in this browser and will be sent automatically when connectivity returns. Device reference <span className="font-mono">{live.client_id.slice(0, 8)}</span>.</p>
          )}
          {live.last_error && !ok && <p className="text-sm text-orange-700 mt-1">Last error: {live.last_error}</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {ok ? <Link to={`/track?id=${live.server_id}`}><Button>Track request</Button></Link>
              : <Button onClick={() => sync.syncNow()} loading={sync.syncing} disabled={!sync.online}>Try sending now</Button>}
            <Button variant="secondary" onClick={() => { setResult(null); setF(EMPTY); setLoc({ lat: null, lng: null, area: '' }) }}>Submit another request</Button>
          </div>
        </div>
        {live.local_analysis && (
          <Card title="On-device AI recommendation" subtitle="Calculated locally; the server re-analyses the request when it arrives." className="mt-6" icon={Brain}>
            <div className="flex flex-wrap items-center gap-3"><CategoryBadge category={live.local_analysis.c.category} /><UrgencyBadge level={live.local_analysis.u.level} /></div>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="bg-canvas">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Request emergency assistance</h1>
        <p className="mt-2 text-slate-600 max-w-2xl">Describe what you need. Works offline - your request is saved on this device first and sent as soon as a connection is available. If life is in immediate danger, use <Link to="/sos" className="text-red-600 font-semibold underline">SOS</Link>.</p>
        <form onSubmit={submit} className="mt-8 grid lg:grid-cols-3 gap-6" noValidate>
          <div className="lg:col-span-2 space-y-6">
            <Card title="What do you need?">
              <div className="space-y-4">
                <Field label="Describe your situation" htmlFor="desc" required error={errors.description}
                  hint="Example: “Need drinking water for 12 people, elderly mother is unwell”. Tamil words like thanni or saapadu are understood.">
                  <div className="relative">
                    <Textarea id="desc" rows={5} value={f.description} onChange={set('description')} placeholder="Type here…" aria-invalid={!!errors.description} />
                    {sttSupported && (
                      <button type="button" onClick={voice} className={cx('absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium', listening ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                        aria-label={listening ? 'Stop voice input' : 'Start voice input'}>
                        {listening ? <><Square className="w-3 h-3" />Listening…</> : <><Mic className="w-3.5 h-3.5" />Speak</>}
                      </button>
                    )}
                  </div>
                </Field>
                {sttMsg && <p className="text-xs text-orange-700">{sttMsg}</p>}
                <div>
                  <p className="label">Category (optional - AI will suggest one)</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORIES).map(([k, c]) => (
                      <button type="button" key={k} onClick={() => set('category_hint')(f.category_hint === k ? '' : k)} aria-pressed={f.category_hint === k}
                        className={cx('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm', f.category_hint === k ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600 hover:bg-white')}>
                        <c.icon className="w-3.5 h-3.5" style={{ color: c.color }} />{c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Number of people" htmlFor="ppl" required error={errors.people_affected}>
                    <Input id="ppl" type="number" min={1} max={10000} value={f.people_affected} onChange={set('people_affected')} />
                  </Field>
                </div>
                <div>
                  <p className="label">Does anyone need extra care?</p>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Check id="v1" label="Elderly person" checked={f.has_elderly} onChange={set('has_elderly')} />
                    <Check id="v2" label="Children" checked={f.has_children} onChange={set('has_children')} />
                    <Check id="v3" label="Person with disability" checked={f.has_disabled} onChange={set('has_disabled')} />
                    <Check id="v4" label="Medical condition" checked={f.has_medical_condition} onChange={set('has_medical_condition')} />
                    <Check id="v5" label="Pregnant woman" checked={f.has_pregnant} onChange={set('has_pregnant')} />
                  </div>
                </div>
              </div>
            </Card>
            <Card title="Where are you?">
              <div className="space-y-3">
                <LocationPicker value={loc} onChange={setLoc} />
                <Field label="Landmark / address (optional)" htmlFor="lm"><Input id="lm" value={f.location_name} onChange={set('location_name')} placeholder="e.g. Near Velachery bus stand" /></Field>
                {errors.location && <p className="text-xs text-red-600" role="alert">{errors.location}</p>}
              </div>
            </Card>
            <Card title="Contact (optional)" subtitle="Visible only to authorised coordinators.">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Name" htmlFor="nm"><Input id="nm" value={f.requester_name} onChange={set('requester_name')} autoComplete="name" /></Field>
                <Field label="Phone" htmlFor="ph" error={errors.contact_phone}><Input id="ph" value={f.contact_phone} onChange={set('contact_phone')} inputMode="tel" autoComplete="tel" /></Field>
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            <div className="lg:sticky lg:top-24 space-y-6">
              <Card title="AI recommendation preview" subtitle="Runs on this device, even offline" icon={Brain}>
                {!preview ? <p className="text-sm text-slate-500">Start describing your need to see the suggested category and urgency.</p> : (
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between"><span className="text-slate-500">Category</span><CategoryBadge category={preview.c.category} /></div>
                    <div className="flex items-center justify-between"><span className="text-slate-500">Suggested urgency</span><UrgencyBadge level={preview.u.level} /></div>
                    {preview.c.keywords?.length > 0 && <div className="flex flex-wrap gap-1">{preview.c.keywords.map((k) => <Badge key={k}>{k}</Badge>)}</div>}
                    <ul className="text-xs text-slate-600 space-y-1 border-t border-slate-100 pt-3">
                      {preview.u.factors.map((x, i) => <li key={i} className="flex justify-between gap-2"><span>{x.factor}{x.detail ? ` – ${x.detail}` : ''}</span><span className="tabular-nums text-slate-400">+{x.points}</span></li>)}
                    </ul>
                    <p className="text-[11px] text-slate-400">Advisory only. Coordinators make the final decision.</p>
                  </div>
                )}
              </Card>
              {!sync.online && <Alert tone="orange" icon={CloudOff} title="You are offline">Your request will be saved on this device and sent automatically later.</Alert>}
              <Button type="submit" size="lg" icon={Send} loading={busy} className="w-full">{sync.online ? 'Submit request' : 'Save request offline'}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
