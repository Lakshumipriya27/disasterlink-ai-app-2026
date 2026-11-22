import { Lock, Plus, ShieldAlert, UserCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LocationPicker from '../../components/LocationPicker'
import { Alert, Badge, Button, CachedBanner, Card, Check, EmptyState, ErrorState, Field, Input, KeyValue, Loading, Modal, PageHeader, Select, Tabs, Textarea } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { AREAS, VP_CATEGORIES } from '../../lib/constants'
import { fmtDate, timeAgo } from '../../lib/format'

const OUTCOME_TONE = { safe: 'green', needs_assistance: 'red', no_response: 'orange', relocated: 'blue' }

function PersonModal({ person, onClose, onSaved }) {
  const [chk, setChk] = useState({ method: 'phone', outcome: 'safe', notes: '' })
  const [arr, setArr] = useState('')
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState(null)
  const [confirmW, setConfirmW] = useState(false)
  useEffect(() => { setArr(person?.assistance_arrangement || ''); setMsg(null); setConfirmW(false) }, [person?.id]) // eslint-disable-line
  if (!person) return null
  const act = async (k, fn, ok) => { setBusy(k); setMsg(null); try { await fn(); setMsg({ tone: 'green', text: ok }); onSaved() } catch (e) { setMsg({ tone: 'red', text: e.message }) } finally { setBusy('') } }
  return (
    <Modal open={!!person} onClose={onClose} title={`${person.display_name} · ${person.id}`} wide>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">{person.categories.map((c) => <Badge key={c} tone="navy">{VP_CATEGORIES[c] || c}</Badge>)}{person.is_simulated && <Badge tone="purple">SIMULATED</Badge>}</div>
        <Alert tone="gray" icon={Lock}>Restricted information. Registration means this person may need extra support - it does not mean they are currently in danger.</Alert>
        <KeyValue items={[['Area', person.area], ['Address hint', person.address_hint], ['Phone', person.contact_phone || '—'], ['Emergency contact', person.emergency_contact || '—'],
          ['Household size', person.household_size], ['Consent', `${person.consent_status} (${fmtDate(person.consent_date)})`], ['Last verified', fmtDate(person.last_verified)],
          ['Assistance requirements', person.assistance_requirements], ['Accessibility requirements', person.accessibility_requirements]]} />
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-navy-800">Record welfare check</p>
            <Select aria-label="Method" value={chk.method} onChange={(e) => setChk({ ...chk, method: e.target.value })}><option value="phone">Phone call</option><option value="visit">Home visit</option><option value="neighbour">Via neighbour</option><option value="volunteer">Volunteer visit</option></Select>
            <Select aria-label="Outcome" value={chk.outcome} onChange={(e) => setChk({ ...chk, outcome: e.target.value })}><option value="safe">Safe</option><option value="needs_assistance">Needs assistance</option><option value="no_response">No response</option><option value="relocated">Relocated</option></Select>
            <Textarea rows={2} aria-label="Notes" placeholder="Notes" value={chk.notes} onChange={(e) => setChk({ ...chk, notes: e.target.value })} />
            <Button size="sm" icon={UserCheck} loading={busy === 'c'} onClick={() => act('c', () => api(`/api/vulnerable/${person.id}/welfare-checks`, { method: 'POST', body: chk }), 'Welfare check recorded')}>Save check</Button>
          </div>
          <div className="rounded-xl border border-slate-200 p-4 space-y-2">
            <p className="text-sm font-semibold text-navy-800">Assistance arrangement</p>
            <Textarea rows={4} aria-label="Arrangement" value={arr} onChange={(e) => setArr(e.target.value)} placeholder="e.g. Accessible van booked; Accessible Relief Centre reserved" />
            <div className="flex gap-2">
              <Button size="sm" loading={busy === 'a'} onClick={() => act('a', () => api(`/api/vulnerable/${person.id}`, { method: 'PATCH', body: { assistance_arrangement: arr } }), 'Arrangement saved')}>Save</Button>
              <Button size="sm" variant="ghost" loading={busy === 'mv'} onClick={() => act('mv', () => api(`/api/vulnerable/${person.id}`, { method: 'PATCH', body: { mark_verified: true } }), 'Marked as verified today')}>Mark details verified</Button>
            </div>
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-navy-800 mb-2">Welfare-check history</p>
          {person.welfare_checks.length === 0 ? <p className="text-sm text-slate-500">No welfare checks recorded.</p> : (
            <ul className="divide-y divide-slate-100 text-sm">{person.welfare_checks.map((w) => <li key={w.id} className="py-2 flex justify-between gap-3"><span><Badge tone={OUTCOME_TONE[w.outcome]}>{w.outcome.replace('_', ' ')}</Badge> <span className="text-slate-600">via {w.method} by {w.performed_by}</span>{w.notes && <span className="block text-xs text-slate-500">{w.notes}</span>}</span><span className="text-xs text-slate-400 whitespace-nowrap">{fmtDate(w.attempted_at)}</span></li>)}</ul>
          )}
        </div>
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="border-t border-slate-100 pt-4">
          {!confirmW ? <Button variant="ghost" className="!text-red-600" onClick={() => setConfirmW(true)}>Withdraw consent & erase personal details</Button> : (
            <Alert tone="red" title="Withdraw consent?">Personal details will be erased and the person removed from the active registry. This cannot be undone.
              <div className="mt-2 flex gap-2"><Button size="sm" variant="danger" loading={busy === 'w'} onClick={() => act('w', async () => { await api(`/api/vulnerable/${person.id}/withdraw-consent`, { method: 'POST' }); onClose() }, 'Consent withdrawn')}>Confirm withdrawal</Button><Button size="sm" variant="secondary" onClick={() => setConfirmW(false)}>Cancel</Button></div>
            </Alert>
          )}
        </div>
      </div>
    </Modal>
  )
}

function AddModal({ open, onClose, onSaved }) {
  const [f, setF] = useState({ display_name: '', contact_phone: '', categories: [], assistance_requirements: '', accessibility_requirements: '', household_size: 1, emergency_contact: '', consent: false })
  const [loc, setLoc] = useState({ lat: null, lng: null, area: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setErr(''); if (!f.consent) return setErr('Record the person’s consent first.')
    setBusy(true)
    try { await api('/api/vulnerable', { method: 'POST', body: { ...f, household_size: Number(f.household_size) || 1, lat: loc.lat, lng: loc.lng, area: loc.area } }); onSaved(); onClose() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Register person (with consent)" wide footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Save</Button></>}>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Name" required><Input value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></Field>
        <Field label="Phone"><Input value={f.contact_phone} onChange={(e) => setF({ ...f, contact_phone: e.target.value })} /></Field>
        <Field label="Household size"><Input type="number" min={1} value={f.household_size} onChange={(e) => setF({ ...f, household_size: e.target.value })} /></Field>
        <Field label="Emergency contact"><Input value={f.emergency_contact} onChange={(e) => setF({ ...f, emergency_contact: e.target.value })} /></Field>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 mt-4">{Object.entries(VP_CATEGORIES).map(([k, l]) => <Check key={k} id={`a-${k}`} label={l} checked={f.categories.includes(k)} onChange={() => setF({ ...f, categories: f.categories.includes(k) ? f.categories.filter((x) => x !== k) : [...f.categories, k] })} />)}</div>
      <div className="grid gap-3 mt-4">
        <Field label="Assistance requirements"><Textarea rows={2} value={f.assistance_requirements} onChange={(e) => setF({ ...f, assistance_requirements: e.target.value })} /></Field>
        <Field label="Accessibility requirements"><Textarea rows={2} value={f.accessibility_requirements} onChange={(e) => setF({ ...f, accessibility_requirements: e.target.value })} /></Field>
        <LocationPicker value={loc} onChange={setLoc} showMap={false} />
        <Check id="a-consent" checked={f.consent} onChange={(v) => setF({ ...f, consent: v })} label="The person has given informed consent to be registered" />
        {err && <Alert tone="red">{err}</Alert>}
      </div>
    </Modal>
  )
}

export default function Vulnerable() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState('affected')
  const [area, setArea] = useState(params.get('area') || '')
  const [cat, setCat] = useState('')
  const affected = useApi('/api/vulnerable/in-affected-areas', { cache: true })
  const all = useApi(`/api/vulnerable?${new URLSearchParams(Object.entries({ area, category: cat }).filter(([, v]) => v))}`, { cache: true })
  const [selId, setSelId] = useState(null)
  const [add, setAdd] = useState(false)
  const src = tab === 'affected' ? affected : all
  let rows = tab === 'affected' ? (affected.data?.people || []) : (all.data || [])
  if (tab === 'affected' && area) rows = rows.filter((r) => r.area === area)
  const sel = rows.find((r) => r.id === selId) || null
  const reloadAll = () => { affected.reload(true); all.reload(true) }

  return (
    <div>
      <PageHeader title="Vulnerable People Assistance Registry" subtitle="Consent-based registry for coordinators. Personal details are restricted to administrators and coordinators."
        actions={<Button icon={Plus} onClick={() => setAdd(true)}>Register person</Button>} />
      <Alert tone="blue" icon={ShieldAlert} className="mb-5">Registration does not mean a person is in danger. Use this registry to plan welfare checks, accessible transport and suitable shelter.</Alert>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'affected', label: 'In potentially affected areas', count: affected.data?.people?.length }, { value: 'all', label: 'Full registry', count: all.data?.length }]} />
      <div className="flex flex-wrap gap-2 mb-4">
        <Select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className="!w-auto"><option value="">All areas</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select>
        {tab === 'all' && <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto"><option value="">All support needs</option>{Object.entries(VP_CATEGORIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>}
      </div>
      <CachedBanner fromCache={src.fromCache} savedAt={src.savedAt} />
      <Card bodyClass="p-0">
        {src.loading && !src.data ? <Loading /> : src.error ? <div className="p-5"><ErrorState error={src.error} onRetry={src.reload} /></div> : rows.length === 0 ? <EmptyState title="No registered people in this view" /> : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead><tr><th>Person</th><th>Area</th><th>Support needs</th><th>Requirements</th><th>Last welfare check</th>{tab === 'affected' && <th>Zone severity</th>}</tr></thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="cursor-pointer" onClick={() => setSelId(p.id)}>
                    <td><p className="font-medium text-slate-800">{p.display_name}</p><p className="text-xs text-slate-500 font-mono">{p.id}{p.is_simulated && <span className="text-violet-600 font-sans font-semibold ml-1">SIMULATED</span>}</p></td>
                    <td>{p.area}</td>
                    <td><div className="flex flex-wrap gap-1 max-w-[220px]">{p.categories.map((c) => <Badge key={c} tone="navy">{VP_CATEGORIES[c] || c}</Badge>)}</div></td>
                    <td className="text-xs text-slate-600 max-w-xs">{p.assistance_requirements}{p.assistance_arrangement && <span className="block text-emerald-700 mt-1">Arranged: {p.assistance_arrangement}</span>}</td>
                    <td>{p.last_check ? <><Badge tone={OUTCOME_TONE[p.last_check.outcome]}>{p.last_check.outcome.replace('_', ' ')}</Badge><span className="block text-xs text-slate-500 mt-1">{timeAgo(p.last_check.attempted_at)}</span></> : <Badge tone="orange">Never checked</Badge>}</td>
                    {tab === 'affected' && <td className="tabular-nums">{p.zone_severity != null ? `${Math.round(p.zone_severity * 100)}%` : '—'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <PersonModal person={sel} onClose={() => setSelId(null)} onSaved={reloadAll} />
      <AddModal open={add} onClose={() => setAdd(false)} onSaved={reloadAll} />
    </div>
  )
}
