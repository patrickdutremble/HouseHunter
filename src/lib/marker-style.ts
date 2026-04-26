import {
  SCHOOL_COORDS,
  INNER_COMMUTE_ZONE_KM,
  OUTER_COMMUTE_ZONE_KM,
  distanceKm,
} from './map-config'

export interface PillInputs {
  favorite: boolean
  latitude: number | null
  longitude: number | null
}

export type DotColor = 'teal' | 'yellow' | null

export interface PillClasses {
  pill: string
  text: string
  dotColor: DotColor
}

export function getDotColor(
  latitude: number | null,
  longitude: number | null
): DotColor {
  if (latitude == null || longitude == null) return null
  const km = distanceKm(SCHOOL_COORDS, [latitude, longitude])
  if (km <= INNER_COMMUTE_ZONE_KM) return 'teal'
  if (km <= OUTER_COMMUTE_ZONE_KM) return 'yellow'
  return null
}

export function getPillClasses(listing: PillInputs): PillClasses {
  const dotColor = getDotColor(listing.latitude, listing.longitude)
  if (listing.favorite) {
    return {
      pill: 'bg-amber-500 border-2 border-amber-500',
      text: 'text-white',
      dotColor,
    }
  }
  return {
    pill: 'bg-surface border-2 border-border-strong',
    text: 'text-fg',
    dotColor,
  }
}

export function formatPillPrice(price: number | null): string {
  if (price == null) return '$—'
  if (price < 1_000_000 && price < 999_500) {
    return `$${Math.round(price / 1000)}k`
  }
  const millions = price / 1_000_000
  return `$${millions.toFixed(1)}m`
}
