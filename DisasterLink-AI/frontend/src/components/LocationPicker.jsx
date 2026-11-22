import { Crosshair, MapPin } from 'lucide-react'
import { useState } from 'react'
import { Marker } from 'react-leaflet'
import { AREAS } from '../lib/constants'
import MapView, { FlyTo, pinIcon } from './MapView'
import { Button, Input, Select } from './ui'

/** GPS capture, area selection, manual coordinates or tap-on-map. value = {lat, lng, area, status, accuracy} */
export default function LocationPicker({ value, onChange, showMap = true }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const useGps = () => {
    if (!navigator.geolocation) { setMsg('Location is not supported on this device.'); return }
    setBusy(true); setMsg('')
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onChange({ ...value, lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), accuracy: p.coords.accuracy, status: 'captured' }); setMsg(`Location captured (±${Math.round(p.coords.accuracy)} m).`) },
      (e) => { setBusy(false); onChange({ ...value, status: e.code === 1 ? 'denied' : 'unavailable' }); setMsg(e.code === 1 ? 'Location permission denied. Choose your area or tap the map instead.' : 'Could not get location. Choose your area or tap the map.') },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  }
  const pos = value?.lat != null ? [value.lat, value.lng] : null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <Button type="button" variant="soft" icon={Crosshair} loading={busy} onClick={useGps}>Use my location</Button>
        <Select aria-label="Area" value={value?.area || ''} className="!w-auto"
          onChange={(e) => { const a = e.target.value; const c = AREAS[a]; onChange({ ...value, area: a, ...(c && value?.lat == null ? { lat: c[0], lng: c[1], status: 'area' } : {}) }) }}>
          <option value="">Select area…</option>
          {Object.keys(AREAS).map((a) => <option key={a}>{a}</option>)}
        </Select>
      </div>
      {msg && <p className="text-xs text-slate-600" role="status">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Input aria-label="Latitude" placeholder="Latitude e.g. 12.9815" inputMode="decimal" value={value?.lat ?? ''}
          onChange={(e) => onChange({ ...value, lat: e.target.value === '' ? null : Number(e.target.value), status: 'manual' })} />
        <Input aria-label="Longitude" placeholder="Longitude e.g. 80.2180" inputMode="decimal" value={value?.lng ?? ''}
          onChange={(e) => onChange({ ...value, lng: e.target.value === '' ? null : Number(e.target.value), status: 'manual' })} />
      </div>
      {showMap && (
        <div className="rounded-xl overflow-hidden border border-slate-200">
          <MapView height={220} zoom={pos ? 13 : 10} center={pos || undefined}
            onClick={(ll) => onChange({ ...value, lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6), status: 'map' })}>
            {pos && <Marker position={pos} icon={pinIcon('#2563eb', 22)} />}
            {pos && <FlyTo center={pos} />}
          </MapView>
          <p className="text-[11px] text-slate-500 px-3 py-1.5 bg-slate-50 flex items-center gap-1"><MapPin className="w-3 h-3" />Tap the map to set the exact location.</p>
        </div>
      )}
    </div>
  )
}
