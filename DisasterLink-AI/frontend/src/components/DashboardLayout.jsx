import {
  Activity, BarChart3, Bell, Boxes, Brain, CloudOff, GitMerge, HeartHandshake, Home, LayoutDashboard, ListChecks, LogOut,
  Map, Menu, Radar, Settings, ShieldAlert, Siren, Users, X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth.jsx'
import { timeAgo } from '../lib/format'
import { ConnectivityPill } from './Connectivity'
import Logo from './Logo'
import { Loading, cx } from './ui'

const S = ['admin', 'coordinator']
const O = ['admin', 'coordinator', 'volunteer']
export const NAV = [
  { group: 'Operations', items: [
    { to: '/app', label: 'Command Center', icon: LayoutDashboard, roles: O, end: true },
    { to: '/app/map', label: 'Disaster Map', icon: Map, roles: O },
    { to: '/app/requests', label: 'Emergency Requests', icon: ListChecks, roles: O },
    { to: '/app/sos', label: 'SOS Monitoring', icon: Siren, roles: O },
  ] },
  { group: 'Intelligence', items: [
    { to: '/app/ai', label: 'AI Intelligence', icon: Brain, roles: O },
    { to: '/app/unreported', label: 'Unreported Needs', icon: Radar, roles: O },
    { to: '/app/analytics', label: 'Analytics & Impact', icon: BarChart3, roles: O },
  ] },
  { group: 'Resources', items: [
    { to: '/app/resources', label: 'Resource Management', icon: Boxes, roles: O },
    { to: '/app/matching', label: 'Smart Matching', icon: GitMerge, roles: O },
    { to: '/app/shelters', label: 'Shelter Management', icon: Home, roles: O },
  ] },
  { group: 'People', items: [
    { to: '/app/vulnerable', label: 'Vulnerable Registry', icon: ShieldAlert, roles: S },
    { to: '/app/family', label: 'Family Reconnection', icon: HeartHandshake, roles: S },
    { to: '/app/volunteers', label: 'Volunteers', icon: Users, roles: O },
  ] },
  { group: 'System', items: [
    { to: '/app/offline', label: 'Offline Center', icon: CloudOff, roles: O },
    { to: '/app/admin', label: 'Admin Settings', icon: Settings, roles: ['admin'] },
  ] },
]

function Notifications() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const load = () => api('/api/notifications').then(setItems).catch(() => {})
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [])
  const unread = items.filter((n) => !n.is_read).length
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-slate-100" aria-label={`Notifications (${unread} unread)`}>
        <Bell className="w-5 h-5 text-slate-600" />
        {unread > 0 && <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[90vw] card shadow-lift z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-navy-800">Notifications</p>
            <button className="text-xs text-blue-600 hover:underline" onClick={async () => { await api('/api/notifications/read-all', { method: 'POST' }).catch(() => {}); load() }}>Mark all read</button>
          </div>
          <ul className="max-h-96 overflow-y-auto scrollbar-thin divide-y divide-slate-100">
            {items.length === 0 && <li className="px-4 py-6 text-center text-sm text-slate-500">No notifications</li>}
            {items.slice(0, 30).map((n) => (
              <li key={n.id} className={cx('px-4 py-3 text-sm', !n.is_read && 'bg-blue-50/40')}>
                <div className="flex items-start gap-2">
                  <span className={cx('mt-1.5 w-2 h-2 rounded-full shrink-0', n.severity === 'critical' ? 'bg-red-500' : n.severity === 'warning' ? 'bg-orange-500' : 'bg-blue-500')} />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{n.title}</p>
                    {n.message && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</p>}
                    <p className="text-[11px] text-slate-400 mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function DashboardLayout() {
  const { user, ready, logout, role, isOps } = useAuth()
  const [mobile, setMobile] = useState(false)
  const loc = useLocation()
  const nav = useNavigate()
  useEffect(() => setMobile(false), [loc.pathname])
  if (!ready) return <Loading label="Loading session…" className="min-h-screen" />
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!isOps) return <Navigate to="/track" replace />

  const allowed = NAV.flatMap((g) => g.items).find((i) => (i.end ? loc.pathname === i.to : loc.pathname.startsWith(i.to)))
  const forbidden = allowed && !allowed.roles.includes(role)

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="h-16 flex items-center px-5 border-b border-slate-100"><Logo to="/app" /></div>
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5" aria-label="Dashboard">
        {NAV.map((g) => {
          const items = g.items.filter((i) => i.roles.includes(role))
          if (!items.length) return null
          return (
            <div key={g.group}>
              <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.group}</p>
              <div className="space-y-0.5">
                {items.map((i) => (
                  <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
                    <i.icon className="w-4 h-4" aria-hidden />{i.label}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <Link to="/" className="nav-link"><Activity className="w-4 h-4" />Public site</Link>
        <div className="mt-2 flex items-center gap-3 px-3 py-2">
          <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold flex items-center justify-center">{user.full_name?.[0] || 'U'}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{user.full_name}</p>
            <p className="text-xs text-slate-500 capitalize">{role}</p>
          </div>
          <button onClick={async () => { await logout(); nav('/login') }} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="Log out" title="Log out"><LogOut className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30">{sidebar}</aside>
      {mobile && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-72 bg-white h-full shadow-xl">{sidebar}</div>
          <button className="flex-1 bg-slate-900/30" aria-label="Close menu" onClick={() => setMobile(false)} />
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 lg:px-8">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setMobile(true)} aria-label="Open menu"><Menu className="w-5 h-5" /></button>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 px-2.5 py-1 font-semibold">SIMULATED SCENARIO</span>
            Chennai Northeast Monsoon Flood
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ConnectivityPill />
            <Notifications />
          </div>
        </header>
        <main className="px-4 lg:px-8 py-6 max-w-[1500px]">
          {forbidden ? (
            <div className="card p-10 text-center">
              <X className="w-6 h-6 text-red-500 mx-auto" />
              <p className="mt-2 font-medium text-slate-800">Access restricted</p>
              <p className="text-sm text-slate-500">Your role ({role}) does not have access to this page.</p>
            </div>
          ) : <Outlet />}
        </main>
      </div>
    </div>
  )
}
