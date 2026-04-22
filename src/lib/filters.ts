import type { Listing } from '@/types/listing'

export type FlagStatus = 'all' | 'only' | 'hide'

export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
  minBeds: string
}

export const EMPTY_FILTERS: Filters = {
  type: '',
  minPrice: '',
  maxPrice: '',
  favoritesOnly: false,
  flagStatus: 'all',
  minBeds: '',
}

export function applyFilters(listings: Listing[], filters: Filters): Listing[] {
  return listings.filter(l => {
    if (filters.flagStatus === 'only' && !l.flagged_for_deletion) return false
    if (filters.flagStatus === 'hide' && l.flagged_for_deletion) return false
    if (filters.favoritesOnly && !l.favorite) return false
    if (filters.type && l.property_type !== filters.type) return false
    if (filters.minPrice) {
      const min = Number(filters.minPrice.replace(/[$,\s]/g, ''))
      if (!isNaN(min) && (l.price ?? 0) < min) return false
    }
    if (filters.maxPrice) {
      const max = Number(filters.maxPrice.replace(/[$,\s]/g, ''))
      if (!isNaN(max) && (l.price ?? Infinity) > max) return false
    }
    if (filters.minBeds) {
      const min = parseInt(filters.minBeds, 10)
      if (!isNaN(min)) {
        const beds = parseInt(l.bedrooms ?? '', 10)
        if (isNaN(beds) || beds < min) return false
      }
    }
    return true
  })
}
