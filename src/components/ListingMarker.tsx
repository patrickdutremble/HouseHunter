'use client'

import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import type { Listing } from '@/types/listing'
import { getPillClasses, formatPillPrice } from '@/lib/marker-style'
import { ListingPopup } from './ListingPopup'

interface ListingMarkerProps {
  listing: Listing
  onSelect: (id: string) => void
}

function buildPillIcon(listing: Listing): L.DivIcon {
  const { pill, text, showDot } = getPillClasses(listing)
  const priceText = formatPillPrice(listing.price)

  const dotHtml = showDot
    ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-teal-500 border border-white"></span>'
    : ''

  const html = `
    <div class="relative inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${pill}">
      <span class="${text}">${priceText}</span>
      ${dotHtml}
    </div>
  `

  return L.divIcon({
    className: 'map-price-pill',
    html,
    iconSize: undefined as unknown as L.PointExpression,
    iconAnchor: [30, 16],
    popupAnchor: [0, -16],
  })
}

export function ListingMarker({ listing, onSelect }: ListingMarkerProps) {
  if (listing.latitude == null || listing.longitude == null) return null
  const icon = buildPillIcon(listing)
  return (
    <Marker position={[listing.latitude, listing.longitude]} icon={icon}>
      <Popup>
        <ListingPopup listing={listing} onSelect={onSelect} />
      </Popup>
    </Marker>
  )
}
