import { motion } from 'framer-motion'
import { CheckCircle2, CloudOff, Loader2, MapPin, MicOff, Volume2, VolumeX, XCircle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import MediaCapture from '../../components/MediaCapture'
import { Alert, Badge, Button, cx } from '../../components/ui'
import { api } from '../../lib/api'
import { CATEGORIES } from '../../lib/constants'
import { mediaPut, outboxGet, outboxPut, uuid } from '../../lib/db'
import { speak, stopSpeaking, ttsSupported } from '../../lib/speech'
import { useSync } from '../../lib/sync.jsx'

const SOS_CATS = ['rescue', 'medicine', 'water', 'food', 'shelter', 'transport']
const NEEDS = ['Wheelchair user', 'Cannot speak', 'Blind / low vision', 'Deaf / hard of hearing', 'Elderly', 'Needs medical device']
const COUNTDOWN = 3
const INSTRUCTIONS = 'Emergency SOS. Press the large red button, or press Enter or Space, to send an alert. ' +
  'You will have three seconds to cancel. Your location will be shared if you allow it. Recording is optional.'

function getLocation(timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ location_status: 'unavailable' })
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy_m: p.coords.accuracy, location_status: 'captured' }),
      (e) => resolve({ location_status: e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable' }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30000 },
    )
  })
}

export default function SOS() {
  const sync = useSync()
  const [phase, setPhase] = useState('idle') // idle | countdown | sending | sent
  const [count, setCount] = useState(COUNTDOWN)
  const [silent, setSilent] = useState(false)
  const [cats, setCats] = useState([])
  const [needs, setNeeds] = useState([])
  const [clientId, setClientId] = useState(null)
  const [detailMsg, setDetailMsg] = useState('')
  const [mediaKind, setMediaKind] = useState(null)
  const locPromise = useRef(null)
  const btn = useRef(null)
  const timer = useRef(null)

  const item = useMemo(() => sync.items.find((i) => i.client_id === clientId), [sync.items, clientId])
  const itemMedia = sync.media.filter((m) => m.owner_client_id === clientId)

  useEffect(() => { btn.current?.focus() }, [])
  useEffect(() => () => { clearInterval(timer.current); stopSpeaking() }, [])

  const say = (t) => { if (!silent) speak(t) }

  const press = () => {
    if (phase !== 'idle') return
    if (navigator.vibrate && !silent) navigator.vibrate(200)
    locPromise.current = getLocation()
    setPhase('countdown'); setCount(COUNTDOWN)
    say('Sending SOS in three seconds. Press cancel to stop.')
    let c = COUNTDOWN
    timer.current = setInterval(() => {
      c -= 1; setCount(c)
      if (c <= 0) { clearInterval(timer.current); send() }
    }, 1000)
  }
  const cancel = () => { clearInterval(timer.current); setPhase('idle'); say('SOS cancelled.'); btn.current?.focus() }

  const send = async () => {
    setPhase('sending')
    const loc = await locPromise.current
    const id = uuid()
    setClientId(id)
    const payload = { client_id: id, category: cats[0] || 'rescue', categories: cats.length ? cats : ['rescue'], silent,
      accessibility_needs: needs, message: '', device_created_at: new Date().toISOString(), ...loc }
    const stored = await sync.enqueue('sos', payload)
    setPhase('sent')
    if (stored?.status === 'synced') say(`SOS delivered. Your SOS number is ${stored.server_id.split('').join(' ')}. Help is being coordinated.`)
    else say('You are offline. Your SOS is saved on this device and will be sent automatically when connection returns.')
  }

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape' && phase === 'countdown') cancel()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const toggle = (arr, set, v) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const addCategory = async (c) => {
    setDetailMsg('')
    const it = await outboxGet(clientId)
    if (!it) return
    const base = it.payload.categories?.length ? it.payload.categories : cats
    const next = base.includes(c) ? base : [...base, c]
    setCats(next)
    if (it.status !== 'synced') {
      await outboxPut({ ...it, payload: { ...it.payload, categories: next, category: next[0] } })
      await sync.refresh()
      setDetailMsg(`Added "${CATEGORIES[c].label}" - saved on device, will be sent with the SOS.`)
    } else {
      try {
        await api(`/api/sos/${it.server_id}/details`, { method: 'PATCH', auth: false, body: { client_id: clientId, categories: next } })
        setDetailMsg(`Added "${CATEGORIES[c].label}" - delivered to server.`)
      } catch (e) {
        setDetailMsg(`Could not add "${CATEGORIES[c].label}": ${e.message}`)
      }
    }
  }

  const onRecorded = async (blob, duration, mime) => {
    await mediaPut({ client_id: uuid(), owner_client_id: clientId, owner_type: 'sos', kind: mediaKind, blob, mime, size: blob.size,
      duration_s: duration, status: 'pending', created_at: new Date().toISOString() })
    await sync.refresh()
    if (navigator.onLine) sync.syncNow()
  }

  const loc = item?.payload
  return (
    <div className="bg-white">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-navy-800 tracking-tight">Emergency SOS</h1>
            <p className="mt-2 text-lg text-slate-600">One press sends an alert to relief coordinators. No login needed.</p>
          </div>
          {ttsSupported && (
            <Button variant="secondary" icon={Volume2} onClick={() => speak(INSTRUCTIONS)} aria-label="Read instructions aloud">Read aloud</Button>
          )}
        </div>

        {phase === 'idle' && (
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => setSilent(!silent)} aria-pressed={silent}
              className={cx('inline-flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-semibold transition',
                silent ? 'border-navy-700 bg-navy-800 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50')}>
              {silent ? <VolumeX className="w-5 h-5" /> : <MicOff className="w-5 h-5" />} Silent SOS {silent ? 'ON' : 'OFF'}
            </button>
            <p className="text-sm text-slate-500 self-center max-w-sm">Silent SOS sends without sounds, voice or vibration - and needs no camera or microphone.</p>
          </div>
        )}

        {/* The SOS button */}
        <div className="mt-8 flex flex-col items-center">
          {phase === 'idle' && (
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-red-500/30 sos-ring" aria-hidden />
              <button ref={btn} onClick={press}
                className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition text-white shadow-[0_12px_40px_rgba(220,38,38,0.45)] focus-visible:outline-[6px] focus-visible:outline-red-300"
                aria-label="Send emergency SOS. Press Enter or Space.">
                <span className="block text-6xl sm:text-7xl font-black tracking-wider">SOS</span>
                <span className="block mt-2 text-lg font-semibold opacity-95">Press for help</span>
              </button>
            </div>
          )}
          {phase === 'countdown' && (
            <div className="flex flex-col items-center" role="alert" aria-live="assertive">
              <motion.div key={count} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="w-64 h-64 rounded-full bg-red-600 text-white flex flex-col items-center justify-center shadow-xl">
                <span className="text-8xl font-black tabular-nums">{count}</span>
                <span className="text-lg font-semibold">Sending SOS…</span>
              </motion.div>
              <Button variant="secondary" size="lg" icon={XCircle} onClick={cancel} className="mt-6 !text-lg !px-8 !py-4" autoFocus>Cancel (Esc)</Button>
              <p className="mt-3 text-sm text-slate-500 flex items-center gap-1"><MapPin className="w-4 h-4" />Getting your location if permitted…</p>
            </div>
          )}
          {phase === 'sending' && (
            <div className="w-64 h-64 rounded-full border-8 border-red-100 flex flex-col items-center justify-center" role="status">
              <Loader2 className="w-12 h-12 text-red-600 animate-spin" />
              <p className="mt-3 text-lg font-semibold text-navy-800">Saving &amp; sending…</p>
            </div>
          )}
        </div>

        {/* Optional pre-selection */}
        {phase === 'idle' && (
          <div className="mt-10 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">What do you need? <span className="font-normal text-slate-500 text-base">(optional)</span></h2>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SOS_CATS.map((c) => {
                  const C = CATEGORIES[c]; const on = cats.includes(c)
                  return (
                    <button key={c} onClick={() => toggle(cats, setCats, c)} aria-pressed={on}
                      className={cx('flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-left text-base font-semibold transition min-h-[64px]',
                        on ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 hover:border-slate-300 text-slate-700')}>
                      <C.icon className="w-6 h-6 shrink-0" style={{ color: C.color }} aria-hidden />{C.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Accessibility needs <span className="font-normal text-slate-500 text-base">(optional)</span></h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {NEEDS.map((n) => (
                  <button key={n} onClick={() => toggle(needs, setNeeds, n)} aria-pressed={needs.includes(n)}
                    className={cx('rounded-full border-2 px-4 py-2.5 text-sm font-semibold', needs.includes(n) ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200 text-slate-700 hover:border-slate-300')}>{n}</button>
                ))}
              </div>
            </div>
            <Alert tone="gray">Keyboard &amp; switch access: the SOS button is focused when the page opens - a single switch mapped to Enter or Space will trigger it. Press Escape to cancel during the countdown.</Alert>
          </div>
        )}

        {/* Result + follow-up */}
        {phase === 'sent' && item && (
          <div className="mt-2 space-y-6">
            {item.status === 'synced' ? (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6" role="alert">
                <div className="flex items-center gap-3"><CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  <h2 className="text-2xl font-bold text-emerald-800">SOS delivered to the server</h2></div>
                <p className="mt-3 text-lg text-emerald-900">Your SOS number: <strong className="font-mono">{item.server_id}</strong></p>
                <p className="text-emerald-800 mt-1">Coordinators can now see your alert. Stay where you are safe if you can.</p>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-orange-300 bg-orange-50 p-6" role="alert">
                <div className="flex items-center gap-3"><CloudOff className="w-8 h-8 text-orange-600" />
                  <h2 className="text-2xl font-bold text-orange-800">Saved on this device – NOT yet delivered</h2></div>
                <p className="mt-3 text-orange-900 text-lg">{sync.online ? 'The server could not be reached.' : 'You are offline.'} Your SOS will be sent automatically when the connection returns. Keep this page or app open if possible.</p>
                <p className="text-sm text-orange-800 mt-2">Device reference: <span className="font-mono">{item.client_id.slice(0, 8)}</span> · Status: {item.status}{item.last_error ? ` · ${item.last_error}` : ''}</p>
                <Button variant="secondary" className="mt-4" onClick={() => sync.syncNow()} loading={sync.syncing} disabled={!sync.online}>Try sending now</Button>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="card p-4"><p className="text-slate-500 text-xs">Location</p>
                <p className="font-medium text-slate-800 mt-1">{loc?.location_status === 'captured' ? `${loc.lat}, ${loc.lng} (±${Math.round(loc.accuracy_m || 0)} m)` : `Not shared (${loc?.location_status})`}</p></div>
              <div className="card p-4"><p className="text-slate-500 text-xs">Mode</p>
                <p className="font-medium text-slate-800 mt-1">{silent ? 'Silent SOS' : 'Standard SOS'}{needs.length ? ` · ${needs.join(', ')}` : ''}</p></div>
            </div>

            <div>
              <h2 className="text-lg font-semibold">Tell us more (tap any)</h2>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {SOS_CATS.map((c) => {
                  const C = CATEGORIES[c]; const on = (item.payload.categories || []).includes(c) || cats.includes(c)
                  return (
                    <button key={c} onClick={() => addCategory(c)} disabled={on}
                      className={cx('flex items-center gap-3 rounded-xl border-2 px-4 py-4 text-base font-semibold min-h-[64px]', on ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 hover:border-slate-300')}>
                      <C.icon className="w-6 h-6" style={{ color: C.color }} aria-hidden />{C.label}{on && ' ✓'}
                    </button>
                  )
                })}
              </div>
              {detailMsg && <p className="mt-2 text-sm text-slate-700" role="status">{detailMsg}</p>}
            </div>

            {!silent && (
              <div>
                <h2 className="text-lg font-semibold">Optional recording</h2>
                <p className="text-sm text-slate-500">A short video or voice message can help coordinators understand your situation.</p>
                <div className="mt-3 flex gap-2">
                  <Button variant={mediaKind === 'video' ? 'primary' : 'secondary'} onClick={() => setMediaKind('video')}>Video</Button>
                  <Button variant={mediaKind === 'audio' ? 'primary' : 'secondary'} onClick={() => setMediaKind('audio')}>Voice only</Button>
                </div>
                {mediaKind && <div className="mt-3"><MediaCapture key={mediaKind} kind={mediaKind} maxSeconds={30} onRecorded={onRecorded} /></div>}
              </div>
            )}
            {itemMedia.length > 0 && (
              <div className="card p-4">
                <p className="text-sm font-semibold text-navy-800 mb-2">Attachments</p>
                <ul className="space-y-1.5 text-sm">
                  {itemMedia.map((m) => (
                    <li key={m.client_id} className="flex items-center justify-between gap-2">
                      <span>{m.kind} · {Math.round(m.size / 1024)} KB · {m.duration_s}s</span>
                      {m.status === 'uploaded' ? <Badge tone="green">Uploaded</Badge>
                        : m.status === 'failed' ? <Badge tone="orange">Upload failed – will retry</Badge>
                        : <Badge tone="gray">Saved on device – waiting to upload</Badge>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Link to="/track" className="text-blue-700 font-medium hover:underline">Track this SOS →</Link>
              <Link to="/communicate" className="text-blue-700 font-medium hover:underline">Communication cards →</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
