import { CheckCircle2, ClipboardList, Plus, Truck, Users } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, Button, CachedBanner, Card, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Tabs, Textarea } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { AREAS, ASSIST_TYPES } from '../../lib/constants'
import { timeAgo } from '../../lib/format'

function AssignModal({ open, onClose, volunteers, onSaved }) {
  const [f, setF] = useState({ volunteer_id: '', task_type: 'general', reference_id: '', description: '' })
  const [err, setErr] = useState('')
  const save = async () => {
    setErr('')
    if (!f.volunteer_id || f.description.trim().length < 3) return setErr('Choose a volunteer and describe the task.')
    try { await api('/api/volunteers/assignments', { method: 'POST', body: { ...f, reference_id: f.reference_id || null } }); onSaved(); onClose() } catch (e) { setErr(e.message) }
  }
  return (
    <Modal open={open} onClose={onClose} title="New assignment" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Assign</Button></>}>
      <div className="space-y-3">
        <Field label="Volunteer"><Select value={f.volunteer_id} onChange={(e) => setF({ ...f, volunteer_id: e.target.value })}><option value="">Select…</option>{volunteers.filter((v) => v.approval_status === 'approved').map((v) => <option key={v.id} value={v.id}>{v.name} · {v.service_area} · {v.availability}</option>)}</Select></Field>
        <Field label="Task type"><Select value={f.task_type} onChange={(e) => setF({ ...f, task_type: e.target.value })}><option value="general">General</option><option value="request">Emergency request</option><option value="welfare_check">Welfare check</option><option value="match_delivery">Resource delivery</option></Select></Field>
        <Field label="Reference ID (optional)" hint="e.g. REQ-SIM005, VP-SIM04, MATCH-…"><Input value={f.reference_id} onChange={(e) => setF({ ...f, reference_id: e.target.value })} /></Field>
        <Field label="Description"><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {err && <Alert tone="red">{err}</Alert>}
      </div>
    </Modal>
  )
}

export default function Volunteers() {
  const { isStaff, user, role } = useAuth()
  const [tab, setTab] = useState(role === 'volunteer' ? 'assignments' : 'volunteers')
  const [area, setArea] = useState('')
  const vols = useApi(`/api/volunteers${area ? `?area=${encodeURIComponent(area)}` : ''}`, { cache: true })
  const asg = useApi('/api/volunteers/assignments', { cache: true })
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState(null)
  const reload = () => { vols.reload(true); asg.reload(true) }
  const patchVol = async (id, body) => { setMsg(null); try { await api(`/api/volunteers/${id}`, { method: 'PATCH', body }); reload() } catch (e) { setMsg({ tone: 'red', text: e.message }) } }
  const patchAsg = async (id, status) => { setMsg(null); try { await api(`/api/volunteers/assignments/${id}`, { method: 'PATCH', body: { status } }); reload() } catch (e) { setMsg({ tone: 'red', text: e.message }) } }
  const me = (vols.data || []).find((v) => v.id === user?.volunteer_id)

  return (
    <div>
      <PageHeader title="Community Volunteer Network" subtitle="Volunteer and organisation registrations with coordinator-controlled assignments." actions={isStaff && <Button icon={Plus} onClick={() => setOpen(true)}>New assignment</Button>} />
      {role === 'volunteer' && me && (
        <Card className="mb-5" bodyClass="p-4 flex flex-wrap items-center gap-4 justify-between">
          <div><p className="font-semibold text-navy-800">{me.name} <span className="font-mono text-xs text-slate-500">{me.id}</span></p><p className="text-xs text-slate-500">{me.service_area} · {me.organization}</p></div>
          <div className="flex items-center gap-2"><span className="text-sm text-slate-600">My availability</span><Select value={me.availability} onChange={(e) => patchVol(me.id, { availability: e.target.value })} className="!w-auto"><option value="available">Available</option><option value="busy">Busy</option><option value="offline">Offline</option></Select></div>
        </Card>
      )}
      {msg && <Alert tone={msg.tone} className="mb-4">{msg.text}</Alert>}
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'volunteers', label: 'Volunteers', count: vols.data?.length }, { value: 'assignments', label: role === 'volunteer' ? 'My assignments' : 'Assignments', count: asg.data?.length }]} />
      <CachedBanner fromCache={vols.fromCache} savedAt={vols.savedAt} />
      {tab === 'volunteers' ? (
        <>
          <Select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className="!w-auto mb-4"><option value="">All areas</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select>
          <Card bodyClass="p-0">
            {vols.loading && !vols.data ? <Loading /> : vols.error ? <div className="p-5"><ErrorState error={vols.error} onRetry={vols.reload} /></div> : vols.data.length === 0 ? <EmptyState icon={Users} title="No volunteers" /> : (
              <div className="overflow-x-auto"><table className="table-base">
                <thead><tr><th>Volunteer</th><th>Organisation</th><th>Assistance</th><th>Area</th><th>Skills</th><th>Availability</th><th>Approval</th>{isStaff && <th />}</tr></thead>
                <tbody>{vols.data.map((v) => (
                  <tr key={v.id}>
                    <td><p className="font-medium text-slate-800">{v.name}</p><p className="text-xs text-slate-500 font-mono">{v.id} · {v.phone}</p></td>
                    <td className="text-xs">{v.organization || 'Independent'}</td>
                    <td><div className="flex flex-wrap gap-1 max-w-[200px]">{v.assistance_types.map((t) => <Badge key={t} tone="blue">{ASSIST_TYPES[t] || t}</Badge>)}</div></td>
                    <td>{v.service_area}</td>
                    <td className="text-xs text-slate-600 max-w-[180px]">{v.skills}{v.has_vehicle && <span className="flex items-center gap-1 text-cyan-700 mt-1"><Truck className="w-3 h-3" />Vehicle</span>}</td>
                    <td><StatusBadge status={v.availability} /></td>
                    <td><Badge tone={v.approval_status === 'approved' ? 'green' : v.approval_status === 'pending' ? 'orange' : 'red'}>{v.approval_status}</Badge></td>
                    {isStaff && <td>{v.approval_status === 'pending' && <div className="flex gap-1"><Button size="sm" variant="success" onClick={() => patchVol(v.id, { approval_status: 'approved' })}>Approve</Button><Button size="sm" variant="ghost" onClick={() => patchVol(v.id, { approval_status: 'rejected' })}>Reject</Button></div>}</td>}
                  </tr>))}</tbody>
              </table></div>
            )}
          </Card>
        </>
      ) : (
        <Card bodyClass="p-0">
          {asg.loading && !asg.data ? <Loading /> : asg.error ? <div className="p-5"><ErrorState error={asg.error} onRetry={asg.reload} /></div> : asg.data.length === 0 ? <EmptyState icon={ClipboardList} title="No assignments" /> : (
            <ul className="divide-y divide-slate-100">
              {asg.data.map((a) => (
                <li key={a.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
                  <div><div className="flex items-center gap-2"><span className="font-mono text-xs text-slate-500">{a.id}</span><StatusBadge status={a.status} /><Badge>{a.task_type.replace('_', ' ')}</Badge>{a.reference_id && <span className="font-mono text-xs text-blue-600">{a.reference_id}</span>}</div>
                    <p className="text-sm text-slate-800 mt-1">{a.description}</p><p className="text-xs text-slate-500">{a.volunteer_name} · assigned by {a.assigned_by} · {timeAgo(a.created_at)}</p></div>
                  {['assigned', 'accepted'].includes(a.status) && (
                    <div className="flex gap-2 shrink-0">
                      {a.status === 'assigned' && <Button size="sm" variant="secondary" onClick={() => patchAsg(a.id, 'accepted')}>Accept</Button>}
                      <Button size="sm" variant="success" icon={CheckCircle2} onClick={() => patchAsg(a.id, 'completed')}>Complete</Button>
                      {isStaff && <Button size="sm" variant="ghost" onClick={() => patchAsg(a.id, 'cancelled')}>Cancel</Button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <AssignModal open={open} onClose={() => setOpen(false)} volunteers={vols.data || []} onSaved={reload} />
    </div>
  )
}
