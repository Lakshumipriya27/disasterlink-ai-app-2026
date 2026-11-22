import L from 'leaflet'
import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { CHENNAI_CENTER } from '../lib/constants'
import { useSync } from '../lib/sync.jsx'

export function pinIcon(color, size = 22, text = '') {
  return L.divIcon({
    className: '',
    html: `<div class="dl-pin" style="background:${color};width:${size}px;height:${size}px;font-size:${Math.round(size * 0.45)}px">${text}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2],
  })
}

export async function cachedTileCount() {
  if (!('caches' in window)) return null
  try {
    const keys = await caches.keys()
    if (!keys.includes('osm-tiles')) return 0
    const c = await caches.open('osm-tiles')
    return (await c.keys()).length
  } catch { return null }
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng) })
  return null
}
export function FlyTo({ center, zoom }) {
  const map = useMap()
  useEffect(() => { if (center) map.flyTo(center, zoom || map.getZoom(), { duration: 0.6 }) }, [center, zoom, map])
  return null
}

export function OfflineMapNotice() {
  const { online } = useSync()
  const [count, setCount] = useState(null)
  useEffect(() => { cachedTileCount().then(setCount) }, [online])
  if (online) return null
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[500] rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-xs px-3 py-2 shadow-card max-w-[90%] text-center">
      Offline: showing map tiles previously cached on this device{count !== null ? ` (${count} tiles)` : ''}. Areas you have not viewed before will appear blank.
    </div>
  )
}

export default function MapView({ children, center = CHENNAI_CENTER, zoom = 11, height = 520, onClick, className = '' }) {
  return (
    <div className={`relative ${className}`} style={{ height }}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full" style={{ height: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        {onClick && <ClickHandler onClick={onClick} />}
        {children}
      </MapContainer>
      <OfflineMapNotice />
    </div>
  )
}
