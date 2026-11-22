import {
  Accessibility, Apple, Droplets, Ear, ExternalLink, Hand, HeartPulse, Home, Mic, MicOff, PenLine, Phone, ShieldCheck,
  Square, Volume2, X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Select, Textarea, cx } from '../../components/ui'
import { listen, speak, sttSupported, ttsSupported } from '../../lib/speech'

const CARDS = [
  { icon: Hand, en: 'I need help', ta: 'எனக்கு உதவி தேவை', color: '#dc2626' },
  { icon: MicOff, en: 'I cannot speak', ta: 'என்னால் பேச முடியாது', color: '#1e3a6e' },
  { icon: Ear, en: 'I cannot hear. Please write it down', ta: 'எனக்கு காது கேட்காது. தயவுசெய்து எழுதிக் காட்டுங்கள்', color: '#1e3a6e' },
  { icon: Droplets, en: 'I need drinking water', ta: 'எனக்கு குடிநீர் தேவை', color: '#0891b2' },
  { icon: Apple, en: 'I need food', ta: 'எனக்கு உணவு தேவை', color: '#d97706' },
  { icon: HeartPulse, en: 'I need medicine', ta: 'எனக்கு மருந்து தேவை', color: '#dc2626' },
  { icon: HeartPulse, en: 'I am injured', ta: 'எனக்கு காயம் ஏற்பட்டுள்ளது', color: '#b91c1c' },
  { icon: Accessibility, en: 'I use a wheelchair', ta: 'நான் சக்கர நாற்காலி பயன்படுத்துகிறேன்', color: '#2563eb' },
  { icon: Home, en: 'Where is the shelter?', ta: 'தங்குமிடம் எங்கே?', color: '#7c3aed' },
  { icon: Phone, en: 'Please call my family', ta: 'என் குடும்பத்தை அழைக்கவும்', color: '#0f766e' },
  { icon: ShieldCheck, en: 'I am safe', ta: 'நான் பாதுகாப்பாக இருக்கிறேன்', color: '#059669' },
  { icon: PenLine, en: 'Please write your answer', ta: 'உங்கள் பதிலை எழுதுங்கள்', color: '#475569' },
]

const RESOURCES = [
  { name: 'Indian Sign Language Research and Training Centre (ISLRTC)', url: 'https://islrtc.nic.in/', note: 'Government of India - official ISL dictionary and learning material.' },
]

export default function Communicate() {
  const [lang, setLang] = useState('en')
  const [show, setShow] = useState(null)
  const [text, setText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [sttErr, setSttErr] = useState('')
  const r = useRef(null)
  useEffect(() => () => r.current?.stop(), [])

  const say = (c) => { setShow(c); speak(lang === 'ta' ? c.ta : c.en, { lang: lang === 'ta' ? 'ta-IN' : 'en-IN' }) }
  const toggleListen = () => {
    if (listening) { r.current?.stop(); return }
    setSttErr(''); setTranscript('')
    r.current = listen({ lang: lang === 'ta' ? 'ta-IN' : 'en-IN', onResult: (t) => setTranscript(t), onEnd: () => setListening(false), onError: (m) => { setSttErr(m); setListening(false) } })
    if (r.current) setListening(true)
  }

  return (
    <div className="bg-canvas">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accessible Communication Center</h1>
            <p className="mt-2 text-slate-600 max-w-2xl">Tap a card to show it in large text and read it aloud. Use speech-to-text so a person who is deaf can read what a rescuer says.</p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="lang" className="text-sm text-slate-600">Language</label>
            <Select id="lang" value={lang} onChange={(e) => setLang(e.target.value)} className="!w-auto"><option value="en">English</option><option value="ta">தமிழ் (Tamil)</option></Select>
          </div>
        </div>
        {!ttsSupported && <Alert tone="orange" className="mt-4">Text-to-speech is not supported in this browser. Cards can still be shown in large text.</Alert>}

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {CARDS.map((c) => (
            <button key={c.en} onClick={() => say(c)} className="card p-5 text-left hover:shadow-lift hover:border-blue-200 transition min-h-[130px] flex flex-col">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: `${c.color}14`, color: c.color }}><c.icon className="w-6 h-6" aria-hidden /></span>
              <span className="mt-3 text-lg font-semibold text-navy-800 leading-snug">{lang === 'ta' ? c.ta : c.en}</span>
              {lang === 'ta' && <span className="text-xs text-slate-500 mt-1">{c.en}</span>}
            </button>
          ))}
        </div>

        <div className="mt-10 grid lg:grid-cols-2 gap-6">
          <Card title="Type and speak" subtitle="Type any message; it will be read aloud." icon={Volume2}>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" aria-label="Message to speak" />
            <div className="mt-3 flex gap-2">
              <Button icon={Volume2} disabled={!text.trim() || !ttsSupported} onClick={() => speak(text, { lang: lang === 'ta' ? 'ta-IN' : 'en-IN' })}>Speak</Button>
              <Button variant="secondary" disabled={!text.trim()} onClick={() => setShow({ en: text, ta: text, color: '#1e3a6e' })}>Show large</Button>
            </div>
          </Card>
          <Card title="Speech to text" subtitle="Let someone speak - their words appear here in large text." icon={Mic}>
            {!sttSupported ? (
              <Alert tone="gray">Speech recognition is not available in this browser (try Chrome or Edge). In Chrome it also requires an internet connection.</Alert>
            ) : (
              <>
                <Button variant={listening ? 'danger' : 'primary'} icon={listening ? Square : Mic} onClick={toggleListen}>{listening ? 'Stop listening' : 'Start listening'}</Button>
                <div className="mt-4 min-h-[96px] rounded-xl bg-slate-50 border border-slate-200 p-4 text-2xl font-semibold text-navy-800" aria-live="polite">{transcript || <span className="text-base font-normal text-slate-400">Transcript appears here…</span>}</div>
                {sttErr && <p className="text-sm text-orange-700 mt-2">{sttErr}</p>}
              </>
            )}
          </Card>
        </div>

        <Card title="Sign language resources" subtitle="Verified external learning resources. This platform does not perform automatic sign-language recognition." className="mt-6" icon={Hand}>
          <ul className="space-y-3">
            {RESOURCES.map((x) => (
              <li key={x.url}><a href={x.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-blue-700 hover:underline">{x.name}<ExternalLink className="w-3.5 h-3.5" /></a><p className="text-sm text-slate-500">{x.note}</p></li>
            ))}
          </ul>
          <p className="text-xs text-slate-500 mt-4">Tip for responders: face the person, keep your mouth visible, use the communication cards above, and write down key instructions.</p>
        </Card>
      </div>

      {show && (
        <div className="fixed inset-0 z-[1200] bg-white flex flex-col items-center justify-center p-6 text-center" role="dialog" aria-modal="true" aria-label="Message shown in large text">
          <button onClick={() => setShow(null)} className="absolute top-4 right-4 p-3 rounded-full hover:bg-slate-100" aria-label="Close" autoFocus><X className="w-7 h-7" /></button>
          <p className={cx('font-bold leading-tight text-navy-900', (lang === 'ta' ? show.ta : show.en).length > 30 ? 'text-5xl' : 'text-6xl md:text-7xl')} style={{ color: show.color }}>{lang === 'ta' ? show.ta : show.en}</p>
          {lang === 'ta' && show.en !== show.ta && <p className="mt-6 text-3xl text-slate-500">{show.en}</p>}
          {ttsSupported && <Button className="mt-10" size="lg" variant="secondary" icon={Volume2} onClick={() => speak(lang === 'ta' ? show.ta : show.en, { lang: lang === 'ta' ? 'ta-IN' : 'en-IN' })}>Read aloud again</Button>}
        </div>
      )}
    </div>
  )
}
