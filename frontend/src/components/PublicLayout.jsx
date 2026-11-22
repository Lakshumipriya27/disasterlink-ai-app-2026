import { LayoutDashboard, LogIn, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import { ConnectivityPill } from './Connectivity'
import Logo from './Logo'
import { cx } from './ui'

const LINKS = [
  ['/sos', 'Emergency SOS'], ['/request', 'Request Help'], ['/track', 'Track Request'], ['/shelter-finder', 'Find Shelter'],
  ['/communicate', 'Communication'], ['/volunteer', 'Volunteer'],
]

export default function PublicLayout() {
  const { user, isOps } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-blue-600 text-white px-3 py-2 rounded-lg z-50">Skip to content</a>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-6">
          <Logo />
          <nav className="hidden xl:flex items-center gap-1" aria-label="Main">
            {LINKS.map(([to, l]) => (
              <NavLink key={to} to={to} className={({ isActive }) => cx("px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap",
                to === '/sos' ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:text-navy-800 hover:bg-slate-50',
                isActive && (to === '/sos' ? 'bg-red-50' : 'bg-slate-100 text-navy-800'))}>{l}</NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block"><ConnectivityPill /></div>
            {user && isOps ? (
              <Link to="/app" className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-navy-800 text-white px-3 py-2 text-sm font-medium hover:bg-navy-900"><LayoutDashboard className="w-4 h-4" />Dashboard</Link>
            ) : !user ? (
              <Link to="/login" className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"><LogIn className="w-4 h-4" />Staff login</Link>
            ) : null}
            <button className="xl:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
              {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="xl:hidden border-t border-slate-100 px-4 py-3 grid gap-1 bg-white" aria-label="Mobile">
            {LINKS.map(([to, l]) => (
              <NavLink key={to} to={to} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50">{l}</NavLink>
            ))}
            <NavLink to="/relay" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Offline relay</NavLink>
            <NavLink to={user && isOps ? '/app' : '/login'} onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-lg text-sm font-medium text-blue-700 hover:bg-blue-50">{user && isOps ? 'Dashboard' : 'Staff login'}</NavLink>
            <div className="pt-2"><ConnectivityPill /></div>
          </nav>
        )}
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 py-8 grid gap-6 md:grid-cols-3 text-sm">
          <div>
            <Logo />
            <p className="mt-3 text-slate-500 text-xs leading-relaxed">Every Need Matters. Every Life Deserves Help.<br />An academic project. Demonstration data is SIMULATED.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-slate-600">
            <Link to="/register-support" className="hover:text-blue-700">Register for extra support</Link>
            <Link to="/family" className="hover:text-blue-700">Report missing person</Link>
            <Link to="/relay" className="hover:text-blue-700">Offline relay (store &amp; forward)</Link>
            <Link to="/track" className="hover:text-blue-700">Track a request</Link>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">In a life-threatening emergency, also call the national emergency number <strong className="text-slate-700">112</strong>. AI recommendations on this platform are advisory; trained coordinators make all decisions.</p>
        </div>
      </footer>
    </div>
  )
}
