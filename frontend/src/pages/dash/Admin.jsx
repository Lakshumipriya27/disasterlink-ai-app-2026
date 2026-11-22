import { Database, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, Button, Card, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, Tabs } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { cacheClear } from '../../lib/db'
import { fmtDate } from '../../lib/format'

export default function Admin() {
  const { user } = useAuth()
  const [tab, setTab] = useState('system')
  const ov = useApi('/api/admin/overview')
  const sc = useApi('/api/admin/scenario')
  const act = useApi('/api/admin/activity?limit=150', { skip: tab !== 'activity' })
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const [nu, setNu] = useState({ username: '', full_name: '', password: '', role: 'coordinator' })

  const reset = async () => {
    setBusy('reset'); setMsg(null)
    try { const r = await api('/api/admin/reset-demo', { method: 'POST', timeout: 60000 }); await cacheClear(); setMsg({ tone: 'green', text: `Demo data reset: ${Object.entries(r.counts).map(([k, v]) => `${v} ${k}`).join(', ')}. Please sign in again.` }); setConfirm(false) }
    catch (e) { setMsg({ tone: 'red', text: e.message }) } finally { setBusy('') }
  }
  const createUser = async () => { setMsg(null); try { await api('/api/admin/users', { method: 'POST', body: nu }); setNu({ username: '', full_name: '', password: '', role: 'coordinator' }); setMsg({ tone: 'green', text: 'User created' }); ov.reload(true) } catch (e) { setMsg({ tone: 'red', text: e.message }) } }
  const patchUser = async (id, body) => { setMsg(null); try { await api(`/api/admin/users/${id}`, { method: 'PATCH', body }); ov.reload(true) } catch (e) { setMsg({ tone: 'red', text: e.message }) } }
  const setSeverity = async (area, severity) => { try { await api('/api/admin/scenario/zone', { method: 'PATCH', body: { area, severity } }); sc.reload(true) } catch (e) { setMsg({ tone: 'red', text: e.message }) } }

  return (
    <div>
      <PageHeader title="Admin Settings" subtitle="System status, users, simulated scenario controls and audit log." />
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'system', label: 'System' }, { value: 'users', label: 'Users' }, { value: 'scenario', label: 'Scenario' }, { value: 'activity', label: 'Activity log' }]} />
      {ov.loading && !ov.data ? <Loading /> : ov.error ? <ErrorState error={ov.error} onRetry={ov.reload} /> : tab === 'system' ? (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card title="System" icon={Database} bodyClass="p-5 text-sm space-y-2">
            <p>Version: <strong>{ov.data.version}</strong></p><p>Database: <strong>{ov.data.database}</strong></p><p>Max upload: <strong>{ov.data.max_upload_mb} MB</strong></p>
            <p>External AI: <Badge tone={ov.data.ai.active ? 'green' : 'gray'}>{ov.data.ai.active ? `active (${ov.data.ai.model})` : 'disabled - local engine only'}</Badge></p>
            <p className="text-xs text-slate-500">API documentation: <a className="text-blue-600 hover:underline" href="http://localhost:8000/docs" target="_blank" rel="noreferrer">http://localhost:8000/docs</a></p>
          </Card>
          <Card title="Reset demo data" icon={RotateCcw} bodyClass="p-5 text-sm space-y-3">
            <p className="text-slate-600">Deletes ALL data (including anything you added) and reloads the SIMULATED Chennai flood scenario. Users are re-created with the documented demo passwords.</p>
            <Button variant="danger" icon={RotateCcw} onClick={() => setConfirm(true)}>Reset demo data…</Button>
          </Card>
        </div>
      ) : tab === 'users' ? (
        <div className="grid xl:grid-cols-3 gap-6">
          <Card title="Users" className="xl:col-span-2" bodyClass="p-0">
            <table className="table-base"><thead><tr><th>User</th><th>Role</th><th>Status</th><th /></tr></thead>
              <tbody>{ov.data.users.map((u) => (
                <tr key={u.id}><td><p className="font-medium">{u.full_name}</p><p className="text-xs text-slate-500 font-mono">{u.username}{u.is_demo && ' · demo'}</p></td>
                  <td><Select aria-label="Role" value={u.role} disabled={u.id === user.id} onChange={(e) => patchUser(u.id, { role: e.target.value })} className="!w-auto !py-1"><option value="admin">Administrator</option><option value="coordinator">Coordinator</option><option value="volunteer">Volunteer</option><option value="public">Public</option></Select></td>
                  <td><Badge tone={u.is_active ? 'green' : 'gray'}>{u.is_active ? 'Active' : 'Disabled'}</Badge></td>
                  <td>{u.id !== user.id && <Button size="sm" variant="ghost" onClick={() => patchUser(u.id, { is_active: !u.is_active })}>{u.is_active ? 'Disable' : 'Enable'}</Button>}</td></tr>
              ))}</tbody></table>
          </Card>
          <Card title="Create user" icon={UserPlus}>
            <div className="space-y-3">
              <Field label="Username"><Input value={nu.username} onChange={(e) => setNu({ ...nu, username: e.target.value })} /></Field>
              <Field label="Full name"><Input value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} /></Field>
              <Field label="Password" hint="At least 8 characters. Stored as a bcrypt hash."><Input type="password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} /></Field>
              <Field label="Role"><Select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}><option value="coordinator">Coordinator</option><option value="volunteer">Volunteer</option><option value="admin">Administrator</option><option value="public">Public</option></Select></Field>
              <Button icon={ShieldCheck} onClick={createUser}>Create</Button>
            </div>
          </Card>
        </div>
      ) : tab === 'scenario' ? (
        !sc.data ? <Loading /> : (
          <Card title={sc.data.name} subtitle={sc.data.description}>
            <p className="text-sm text-slate-600 mb-4">Adjust simulated severity to see how unreported-need detection and impact intelligence respond.</p>
            <div className="space-y-4">{sc.data.impact_zones.map((z) => (
              <div key={z.area} className="grid sm:grid-cols-[160px_1fr_60px] items-center gap-3">
                <span className="text-sm font-medium">{z.area}</span>
                <input type="range" min={0} max={1} step={0.05} defaultValue={z.severity} onMouseUp={(e) => setSeverity(z.area, Number(e.target.value))} onKeyUp={(e) => setSeverity(z.area, Number(e.target.value))} onTouchEnd={(e) => setSeverity(z.area, Number(e.target.value))} aria-label={`${z.area} severity`} className="accent-blue-600" />
                <span className="text-sm tabular-nums text-slate-600">{Math.round(z.severity * 100)}%</span>
              </div>
            ))}</div>
          </Card>
        )
      ) : (
        <Card bodyClass="p-0">{!act.data ? <Loading /> : (
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto scrollbar-thin"><table className="table-base"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>{act.data.map((a) => <tr key={a.id}><td className="text-xs whitespace-nowrap">{fmtDate(a.created_at)}</td><td className="text-xs">{a.actor}</td><td className="text-xs font-medium">{a.action}</td><td className="text-xs font-mono">{a.entity_type} {a.entity_id}</td><td className="text-xs text-slate-500 max-w-md truncate">{a.details}</td></tr>)}</tbody></table></div>
        )}</Card>
      )}
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Reset all demo data?" footer={<><Button variant="secondary" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" loading={busy === 'reset'} onClick={reset}>Yes, delete and reseed</Button></>}>
        <p className="text-sm text-slate-600">This permanently deletes every request, SOS alert, attachment, resource, match and user, then reloads the simulated scenario. It cannot be undone.</p>
      </Modal>
    </div>
  )
}
