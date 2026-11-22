import { motion } from 'framer-motion'
import { Accessibility, ArrowRight, Brain, CloudOff, GitMerge, HandHeart, MapPinned, Radar, ShieldCheck, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'

const FEATURES = [
  { icon: Siren, title: 'One-touch accessible SOS', text: 'A single press - or a single switch - sends an alert with location, optional video or voice, and a silent mode.' },
  { icon: CloudOff, title: 'Works offline', text: 'Requests are saved on your device and synchronised automatically when connectivity returns, without duplicates.' },
  { icon: Brain, title: 'Explainable AI triage', text: 'Local NLP classifies needs, spots duplicates and suggests urgency - always showing why, always advisory.' },
  { icon: GitMerge, title: 'Need-aware matching', text: 'Compares verified demand with supplies by location to reveal shortages and recommend allocations for approval.' },
  { icon: Radar, title: 'Unreported need detection', text: 'Highlights areas where people may need help but few requests have arrived - and recommends welfare checks.' },
  { icon: Accessibility, title: 'Inclusive by design', text: 'Large targets, screen-reader labels, text-to-speech, communication cards and a consent-based support registry.' },
]

export default function Landing() {
  return (
    <div>
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.07),transparent_55%)]" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-semibold ring-1 ring-blue-100">
              <ShieldCheck className="w-3.5 h-3.5" /> Intelligent · Inclusive · Offline-first
            </span>
            <h1 className="mt-5 text-4xl lg:text-5xl font-bold tracking-tight text-navy-800 leading-[1.1]">
              Every need matters.<br /><span className="text-blue-600">Every life deserves help.</span>
            </h1>
            <p className="mt-5 text-lg text-slate-600 max-w-xl">DisasterLink AI connects affected people, volunteers and relief coordinators - so urgent needs are seen, resources reach the right places, and nobody is left out because they could not ask.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/sos" className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 text-base font-semibold shadow-sm"><Siren className="w-5 h-5" />Emergency SOS</Link>
              <Link to="/request" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 text-base font-semibold shadow-sm">Request help <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/volunteer" className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50"><HandHeart className="w-5 h-5" />Volunteer</Link>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="card p-6 lg:p-8">
            <p className="text-sm font-semibold text-navy-800">How it works</p>
            <ol className="mt-4 space-y-5">
              {[
                ['Ask for help - online or offline', 'Use SOS or the request form. No login. Offline requests wait safely on your device.'],
                ['AI organises incoming needs', 'Requests are categorised, de-duplicated and given an explained urgency suggestion.'],
                ['Coordinators verify and decide', 'Humans review every recommendation, approve resource matches and dispatch help.'],
                ['Track progress', 'Use your request ID to see verification and assistance status.'],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="w-8 h-8 shrink-0 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <div><p className="font-semibold text-slate-800">{t}</p><p className="text-sm text-slate-500 mt-0.5">{d}</p></div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 border-t border-slate-100 pt-4"><MapPinned className="w-4 h-4 text-cyan-600" />Demonstration uses a SIMULATED Chennai flood scenario.</div>
          </motion.div>
        </div>
      </section>
      <section className="bg-canvas">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">Built for real emergencies</h2>
          <p className="text-slate-500 mt-1">Every feature is designed around unreliable connectivity, accessibility and human oversight.</p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="card p-6">
                <span className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><f.icon className="w-5 h-5" /></span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid md:grid-cols-3 gap-5">
            <Link to="/shelter-finder" className="card p-5 hover:shadow-lift transition"><p className="font-semibold">Find a suitable shelter →</p><p className="text-sm text-slate-500 mt-1">Matched to accessibility, family and medical needs.</p></Link>
            <Link to="/register-support" className="card p-5 hover:shadow-lift transition"><p className="font-semibold">Register for extra support →</p><p className="text-sm text-slate-500 mt-1">Consent-based registry for elderly and disabled residents.</p></Link>
            <Link to="/family" className="card p-5 hover:shadow-lift transition"><p className="font-semibold">Family reconnection →</p><p className="text-sm text-slate-500 mt-1">Private, coordinator-verified missing-person matching.</p></Link>
          </div>
        </div>
      </section>
    </div>
  )
}
