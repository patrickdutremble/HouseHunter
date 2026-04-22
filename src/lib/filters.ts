import type { Listing } from '@/types/listing'

export type FlagStatus = 'all' | 'only' | 'hide'

export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
  minBeds: string
  maxCommuteSchool: string
  maxCommutePvm: string
  maxMonthlyCost: string
  hasGarage: boolean
}

export const EMPTY_FILTERS: Filters = {
  type: '',
  minPrice: '',
  maxPrice: '',
  favoritesOnly: false,
  flagStatus: 'all',
  minBeds: '',
  maxCommuteSchool: '',
  maxCommutePvm: '',
  maxMonthlyCost: '',
  hasGarage: false,
}

function parseCommuteMinutes(s: string | null): number | null {
  if (!s) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}

const GARAGE_RE = /\b\d+\s*garage/i

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
    if (filters.maxCommuteSchool) {
      const max = parseInt(filters.maxCommuteSchool, 10)
      if (!isNaN(max)) {
        const mins = parseCommuteMinutes(l.commute_school_car)
        if (mins == null || mins > max) return false
      }
    }
    if (filters.maxCommutePvm) {
      const max = parseInt(filters.maxCommutePvm, 10)
      if (!isNaN(max)) {
        const mins = parseCommuteMinutes(l.commute_pvm_transit)
        if (mins == null || mins > max) return false
      }
    }
    if (filters.maxMonthlyCost) {
      const max = Number(filters.maxMonthlyCost.replace(/[$,\s]/g, ''))
      if (!isNaN(max)) {
        if (l.total_monthly_cost == null || l.total_monthly_cost > max) return false
      }
    }
    if (filters.hasGarage) {
      if (!GARAGE_RE.test(l.parking ?? '')) return false
    }
    return true
  })
}
