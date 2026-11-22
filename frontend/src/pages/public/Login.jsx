import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, Field, Input } from '../../components/ui'
import { useAuth } from '../../lib/auth.jsx'

// Documented demo accounts for local academic demonstration only (also listed in README.md).
const DEMO = [
  ['admin', 'Admin@2026', 'Administrator'], ['coordinator', 'Coord@2026', 'Relief Coordinator'],
  ['volunteer', 'Volunteer@2026', 'Volunteer'], ['public', 'Public@2026', 'Public User'],
]

export default function Login() {
  const { login, user, isOps } = useAuth()
  const [u, setU] = useState('')
  const [p, setP] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const loc = useLocation()
  if (user) return <Navigate to={isOps ? (loc.state?.from || '/app') : '/track'} replace />

  const submit = async (e) => {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const me = await login(u.trim(), p)
      nav(['admin', 'coordinator', 'volunteer'].includes(me.role) ? (loc.state?.from || '/app') : '/track')
    } catch (e2) { setErr(e2.message) } finally { setBusy(false) }
  }
  return (
    <div className="bg-canvas min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-bold tracking-tight">Sign in</h1>
          <p className="text-sm text-slate-500 mt-1">Operations dashboard for coordinators, administrators and volunteers.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Username" htmlFor="u"><Input id="u" value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></Field>
            <Field label="Password" htmlFor="p"><Input id="p" type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></Field>
            {err && <Alert tone="red">{err}</Alert>}
            <Button type="submit" icon={LogIn} loading={busy} className="w-full" size="lg">Sign in</Button>
          </form>
        </div>
        <div className="card p-5 mt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Demo accounts (local demonstration only)</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {DEMO.map(([un, pw, r]) => (
              <button key={un} onClick={() => { setU(un); setP(pw) }} className="text-left rounded-lg border border-slate-200 px-3 py-2 hover:border-blue-300 hover:bg-blue-50/40">
                <p className="text-sm font-medium text-slate-800">{r}</p><p className="text-xs text-slate-500 font-mono">{un} / {pw}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
