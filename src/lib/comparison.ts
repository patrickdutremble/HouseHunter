import { criteria, countChecked, deriveCriteria, type CriterionKey } from '@/lib/criteria'
import type { Listing } from '@/types/listing'

export type BestMap = {
  price: Set<string>
  bedrooms: Set<string>
  liveable_area_sqft: Set<string>
  price_per_sqft: Set<string>
  parking: Set<string>
  year_built: Set<string>
  taxes_yearly: Set<string>
  common_fees_yearly: Set<string>
  hydro_yearly: Set<string>
  downpayment: Set<string>
  monthly_mortgage: Set<string>
  total_monthly_cost: Set<string>
  commute_school_car: Set<string>
  commute_pvm_transit: Set<string>
  criteria_count: Set<string>
} & Record<CriterionKey, Set<string>>

/** Parse bedroom strings like "2+1" into a number (3). */
function parseBedrooms(value: string | null): number | null {
  if (value === null) return null
  const parts = value.split('+').map(s => parseInt(s.trim(), 10))
  if (parts.some(isNaN)) return null
  return parts.reduce((a, b) => a + b, 0)
}

/** Parse "H:MM" duration strings into total minutes. */
function parseDuration(value: string | null): number | null {
  if (value === null || value === '') return null
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

/** Parse parking string into a number. */
function parseParking(value: string | null): number | null {
  if (value === null) return null
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}

type Direction = 'min' | 'max'

function findBest(
  listings: Listing[],
  extract: (l: Listing) => number | null,
  direction: Direction,
): Set<string> {
  const entries: { id: string; value: number }[] = []
  for (const l of listings) {
    const v = extract(l)
    if (v !== null) entries.push({ id: l.id, value: v })
  }
  if (entries.length < 2) return new Set()

  const bestValue = direction === 'min'
    ? Math.min(...entries.map(e => e.value))
    : Math.max(...entries.map(e => e.value))

  return new Set(entries.filter(e => e.value === bestValue).map(e => e.id))
}

/**
 * Highlight listings where a criterion is checked, but only when at least one
 * other listing does not have it checked. If all listings agree (all checked
 * or all unchecked/missing), nothing is highlighted.
 */
function findBestBinary(
  listings: Listing[],
  criterionKey: CriterionKey,
): Set<string> {
  if (listings.length < 2) return new Set()

  const checkedIds: string[] = []
  let anyUnchecked = false

  for (const l of listings) {
    const isChecked = deriveCriteria(l)[criterionKey]
    if (isChecked) {
      checkedIds.push(l.id)
    } else {
      anyUnchecked = true
    }
  }

  if (checkedIds.length === 0 || !anyUnchecked) return new Set()
  return new Set(checkedIds)
}

export function getBestValues(listings: Listing[]): BestMap {
  const base = {
    price: findBest(listings, l => l.price, 'min'),
    bedrooms: findBest(listings, l => parseBedrooms(l.bedrooms), 'max'),
    liveable_area_sqft: findBest(listings, l => l.liveable_area_sqft, 'max'),
    price_per_sqft: findBest(listings, l => l.price_per_sqft, 'min'),
    parking: findBest(listings, l => parseParking(l.parking), 'max'),
    year_built: findBest(listings, l => l.year_built, 'max'),
    taxes_yearly: findBest(listings, l => l.taxes_yearly, 'min'),
    common_fees_yearly: findBest(listings, l => l.common_fees_yearly, 'min'),
    hydro_yearly: findBest(listings, l => l.hydro_yearly, 'min'),
    downpayment: findBest(listings, l => l.downpayment, 'min'),
    monthly_mortgage: findBest(listings, l => l.monthly_mortgage, 'min'),
    total_monthly_cost: findBest(listings, l => l.total_monthly_cost, 'min'),
    commute_school_car: findBest(listings, l => parseDuration(l.commute_school_car), 'min'),
    commute_pvm_transit: findBest(listings, l => parseDuration(l.commute_pvm_transit), 'min'),
    criteria_count: findBest(listings, l => countChecked(deriveCriteria(l)), 'max'),
  } as BestMap

  for (const c of criteria) {
    base[c.key] = findBestBinary(listings, c.key)
  }

  return base
}
