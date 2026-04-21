'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Listing } from '@/types/listing'
import {
  SCHOOL_COORDS,
  INNER_COMMUTE_ZONE_KM,
  OUTER_COMMUTE_ZONE_KM,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
} from '@/lib/map-config'
import { ListingMarker } from './ListingMarker'

interface MapViewProps {
  listings: Listing[]
  onSelect: (id: string) => void
}

const schoolIcon = L.divIcon({
  className: 'map-school-pin',
  html: `
    <div class="relative flex items-center justify-center w-9 h-9 rounded-full bg-teal-600 border-2 border-white shadow-lg text-white">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path d="M10 2 1 6l9 4 9-4-9-4z"/>
        <path d="M4 8.5V13c0 1.1 2.7 2 6 2s6-.9 6-2V8.5l-6 2.7-6-2.7z"/>
      </svg>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
})

function FitBounds({ listings }: { listings: Listing[] }) {
  const map = useMap()
  // Key on the set of listing IDs so the fit only runs when listings are
  // loaded, added, or removed — not on every parent re-render (e.g. opening
  // the detail panel, which would otherwise snap the map back to fit bounds).
  const idsKey = listings.map((l) => l.id).join(',')

  useEffect(() => {
    const pts: [number, number][] = [SCHOOL_COORDS]
    for (const l of listings) {
      if (l.latitude != null && l.longitude != null) pts.push([l.latitude, l.longitude])
    }
    if (pts.length <= 1) {
      map.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM)
      return
    }
    const bounds = L.latLngBounds(pts.map(([lat, lon]) => L.latLng(lat, lon)))
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
    // listings content is captured via idsKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, map])

  return null
}

export default function MapView({ listings, onSelect }: MapViewProps) {
  const withCoords = listings.filter(
    (l) => l.latitude != null && l.longitude != null
  )
  const missing = listings.length - withCoords.length

  return (
    <div className="relative h-full w-full">
      <MapContainer
        center={DEFAULT_MAP_CENTER}
        zoom={DEFAULT_MAP_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={SCHOOL_COORDS}
          radius={OUTER_COMMUTE_ZONE_KM * 1000}
          pathOptions={{
            color: '#eab308',
            weight: 1,
            fillColor: '#eab308',
            fillOpacity: 0.13,
          }}
        />
        <Circle
          center={SCHOOL_COORDS}
          radius={INNER_COMMUTE_ZONE_KM * 1000}
          pathOptions={{
            color: '#14b8a6',
            weight: 1,
            fillColor: '#14b8a6',
            fillOpacity: 0.13,
          }}
        />
        <Marker position={SCHOOL_COORDS} icon={schoolIcon} />
        {withCoords.map((listing) => (
          <ListingMarker key={listing.id} listing={listing} onSelect={onSelect} />
        ))}
        <FitBounds listings={withCoords} />
      </MapContainer>

      {missing > 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] px-3 py-1.5 text-xs text-slate-600 bg-white/90 border border-slate-200 rounded-lg shadow-sm">
          {missing === 1
            ? '1 listing without coordinates — not shown on map'
            : `${missing} listings without coordinates — not shown on map`}
        </div>
      )}
    </div>
  )
}
