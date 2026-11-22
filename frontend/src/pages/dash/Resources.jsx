import { AlertTriangle, ArrowRight, Boxes, CalendarClock, Plus, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Alert, Badge, Button, CachedBanner, Card, CategoryBadge, EmptyState, ErrorState, Field, Input, Loading, Modal, PageHeader, Select, StatusBadge, Tabs } from '../../components/ui'
import { api, useApi } from '../../lib/api'
import { useAuth } from '../../lib/auth.jsx'
import { AREAS, CATEGORIES, RESOURCE_CATEGORIES } from '../../lib/constants'
import { fmtDate, timeAgo } from '../../lib/format'

function AddResource({ open, onClose, onSaved }) {
  const orgs = useApi('/api/resources/organizations', { skip: !open })
  const [f, setF] = useState({ name: '', category: 'food', quantity: 0, unit: 'units', expiry_date: '', location_name: '', area: '', organization_id: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const save = async () => {
    setErr('')
    if (f.name.trim().length < 2) return setErr('Enter a resource name.')
    if (!(Number(f.quantity) >= 0)) return setErr('Quantity must be 0 or more.')
    if (!f.area) return setErr('Select an area.')
    const c = AREAS[f.area]
    setBusy(true)
    try {
      await api('/api/resources', { method: 'POST', body: { ...f, quantity: Number(f.quantity), expiry_date: f.expiry_date ? new Date(f.expiry_date).toISOString() : null, organization_id: f.organization_id || null, lat: c[0] + (Math.random() - 0.5) * 0.01, lng: c[1] + (Math.random() - 0.5) * 0.01 } })
      onSaved(); onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal open={open} onClose={onClose} title="Add resource" footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={busy}>Add</Button></>}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2"><Field label="Name" required><Input value={f.name} onChange={set('name')} placeholder="e.g. Drinking water bottles (1L)" /></Field></div>
        <Field label="Category"><Select value={f.category} onChange={set('category')}>{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}</Select></Field>
        <Field label="Quantity"><Input type="number" min={0} value={f.quantity} onChange={set('quantity')} /></Field>
        <Field label="Unit"><Input value={f.unit} onChange={set('unit')} /></Field>
        <Field label="Expiry date"><Input type="date" value={f.expiry_date} onChange={set('expiry_date')} /></Field>
        <Field label="Area" required><Select value={f.area} onChange={set('area')}><option value="">Select…</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select></Field>
        <Field label="Storage location"><Input value={f.location_name} onChange={set('location_name')} /></Field>
        <div className="sm:col-span-2"><Field label="Organisation"><Select value={f.organization_id} onChange={set('organization_id')}><option value="">—</option>{(orgs.data || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field></div>
      </div>
      {err && <Alert tone="red" className="mt-3">{err}</Alert>}
    </Modal>
  )
}

function Adjust({ r, onSaved }) {
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const go = async () => { setErr(''); try { await api(`/api/resources/${r.id}`, { method: 'PATCH', body: { adjust: Number(v) } }); setV(''); onSaved() } catch (e) { setErr(e.message) } }
  return (
    <div className="flex items-center gap-1">
      <Input aria-label={`Adjust ${r.name}`} type="number" value={v} onChange={(e) => setV(e.target.value)} placeholder="±qty" className="!w-20 !py-1 !text-xs" />
      <Button size="sm" variant="secondary" onClick={go} disabled={!v || Number(v) === 0}>Apply</Button>
      {err && <span className="text-[11px] text-red-600">{err}</span>}
    </div>
  )
}

export default function Resources() {
  const { isStaff } = useAuth()
  const [tab, setTab] = useState('inventory')
  const [cat, setCat] = useState('')
  const [area, setArea] = useState('')
  const [add, setAdd] = useState(false)
  const inv = useApi(`/api/resources?${new URLSearchParams(Object.entries({ category: cat, area }).filter(([, v]) => v))}`, { cache: true })
  const ins = useApi('/api/resources/insights', { cache: true })
  const reload = () => { inv.reload(true); ins.reload(true) }

  return (
    <div>
      <PageHeader title="Resource Management" subtitle="Inventory with shortage identification, expiry alerts, excess detection and redistribution recommendations."
        actions={isStaff && <Button icon={Plus} onClick={() => setAdd(true)}>Add resource</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'inventory', label: 'Inventory', count: inv.data?.length }, { value: 'insights', label: 'Shortages & wastage', count: ins.data ? ins.data.shortages.length + ins.data.expiry_alerts.length : undefined }]} />
      {tab === 'inventory' ? (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <Select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} className="!w-auto"><option value="">All categories</option>{RESOURCE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORIES[c].label}</option>)}</Select>
            <Select aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)} className="!w-auto"><option value="">All areas</option>{Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}</Select>
          </div>
          <CachedBanner fromCache={inv.fromCache} savedAt={inv.savedAt} />
          <Card bodyClass="p-0">
            {inv.loading && !inv.data ? <Loading /> : inv.error ? <div className="p-5"><ErrorState error={inv.error} onRetry={inv.reload} /></div> : inv.data.length === 0 ? <EmptyState icon={Boxes} title="No resources" /> : (
              <div className="overflow-x-auto"><table className="table-base">
                <thead><tr><th>Resource</th><th>Category</th><th>Available</th><th>Reserved</th><th>Location</th><th>Expiry</th><th>Status</th><th>Updated</th>{isStaff && <th>Adjust</th>}</tr></thead>
                <tbody>{inv.data.map((r) => {
                  const days = r.expiry_date ? Math.floor((new Date(r.expiry_date) - Date.now()) / 86400000) : null
                  return (
                    <tr key={r.id}>
                      <td><p className="font-medium text-slate-800">{r.name}</p><p className="text-xs text-slate-500 font-mono">{r.id} · {r.organization || '—'}</p></td>
                      <td><CategoryBadge category={r.category} /></td>
                      <td className="tabular-nums font-medium">{r.available_quantity} <span className="text-xs text-slate-500 font-normal">{r.unit}</span></td>
                      <td className="tabular-nums text-slate-500">{r.reserved_quantity}</td>
                      <td className="text-xs">{r.area}<span className="block text-slate-500">{r.location_name}</span></td>
                      <td className="text-xs whitespace-nowrap">{r.expiry_date ? <span className={days < 0 ? 'text-red-600 font-semibold' : days <= 7 ? 'text-orange-600 font-semibold' : ''}>{days < 0 ? 'Expired' : `${days} d`}<span className="block text-slate-400 font-normal">{fmtDate(r.expiry_date).split(',')[0]}</span></span> : '—'}</td>
                      <td><StatusBadge status={r.availability} /></td>
                      <td className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(r.updated_at)}</td>
                      {isStaff && <td><Adjust r={r} onSaved={reload} /></td>}
                    </tr>)
                })}</tbody>
              </table></div>
            )}
          </Card>
        </>
      ) : ins.loading && !ins.data ? <Loading /> : ins.error ? <ErrorState error={ins.error} onRetry={ins.reload} /> : (
        <div className="space-y-6">
          <CachedBanner fromCache={ins.fromCache} savedAt={ins.savedAt} />
          <Card title="Verified shortages" icon={AlertTriangle} bodyClass="p-0">
            {ins.data.shortages.length === 0 ? <EmptyState title="No verified shortages" /> : (
              <table className="table-base"><thead><tr><th>Area</th><th>Category</th><th>Verified demand</th><th>Available</th><th>Gap</th><th>Coverage</th></tr></thead>
                <tbody>{ins.data.shortages.map((s) => <tr key={`${s.area}${s.category}`}><td>{s.area}</td><td><CategoryBadge category={s.category} /></td><td className="tabular-nums">{s.verified_demand}</td><td className="tabular-nums">{s.supply}</td><td className="tabular-nums font-semibold text-red-600">{s.gap}</td><td><Badge tone={s.status === 'critical_shortage' ? 'red' : 'orange'}>{Math.round((s.coverage || 0) * 100)}%</Badge></td></tr>)}</tbody></table>
            )}
          </Card>
          <div className="grid xl:grid-cols-2 gap-6">
            <Card title="Expiry alerts (≤ 7 days)" icon={CalendarClock} bodyClass="p-0">
              {ins.data.expiry_alerts.length === 0 ? <EmptyState title="No stock expiring soon" /> : (
                <ul className="divide-y divide-slate-100">{ins.data.expiry_alerts.map((e) => <li key={e.id} className="px-5 py-3 flex items-center justify-between text-sm"><span><span className="font-medium">{e.name}</span><span className="block text-xs text-slate-500">{e.quantity} {e.unit} · {e.area}</span></span><Badge tone={e.status === 'expired' ? 'red' : 'orange'}>{e.status === 'expired' ? 'Expired' : `${e.days_left} d left`}</Badge></li>)}</ul>
              )}
            </Card>
            <Card title="Excess inventory" icon={TrendingUp} bodyClass="p-0">
              {ins.data.excess.length === 0 ? <EmptyState title="No excess detected" /> : (
                <ul className="divide-y divide-slate-100">{ins.data.excess.map((e) => <li key={`${e.area}${e.category}`} className="px-5 py-3 flex items-center justify-between text-sm"><span>{e.area} · <CategoryBadge category={e.category} /></span><span className="text-xs text-slate-600">{e.supply} available vs {e.verified_demand} verified demand</span></li>)}</ul>
              )}
            </Card>
          </div>
          <Card title="Redistribution recommendations" subtitle="Advisory - move surplus to verified shortages to reduce wastage" bodyClass="p-0">
            {ins.data.redistribution.length === 0 ? <EmptyState title="No redistribution needed" /> : (
              <ul className="divide-y divide-slate-100">{ins.data.redistribution.map((r, i) => (
                <li key={i} className="px-5 py-3 text-sm"><div className="flex flex-wrap items-center gap-2 font-medium text-slate-800"><CategoryBadge category={r.category} /> {r.quantity} units: {r.from_area} <ArrowRight className="w-4 h-4 text-slate-400" /> {r.to_area}{r.distance_km && <span className="text-xs text-slate-500 font-normal">({r.distance_km} km)</span>}</div><p className="text-xs text-slate-500 mt-1">{r.reason}</p></li>
              ))}</ul>
            )}
          </Card>
        </div>
      )}
      <AddResource open={add} onClose={() => setAdd(false)} onSaved={reload} />
    </div>
  )
}
