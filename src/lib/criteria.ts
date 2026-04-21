export type CriterionKey =
  | 'no_above_neighbors'
  | 'school_within_20min'
  | 'pvm_within_1h'
  | 'three_bedrooms'
  | 'has_garage'

export interface CriterionDef {
  key: CriterionKey
  label: string
}

export const criteria: readonly CriterionDef[] = [
  { key: 'no_above_neighbors', label: 'No above neighbors' },
  { key: 'school_within_20min', label: '<20 min from school' },
  { key: 'pvm_within_1h',       label: '<1 hour from PVM' },
  { key: 'three_bedrooms',      label: '3 bedrooms' },
  { key: 'has_garage',          label: 'At least 1 garage' },
] as const

export function countChecked(
  value: Record<string, boolean> | null | undefined
): number {
  if (!value) return 0
  return criteria.reduce((n, c) => n + (value[c.key] ? 1 : 0), 0)
}

export const derivedCriterionKeys: readonly CriterionKey[] = [
  'school_within_20min',
  'pvm_within_1h',
  'three_bedrooms',
  'has_garage',
] as const

export function isDerivedCriterion(key: CriterionKey): boolean {
  return derivedCriterionKeys.includes(key)
}

interface DerivableListing {
  bedrooms: string | null
  parking: string | null
  commute_school_car: string | null
  commute_pvm_transit: string | null
  criteria: Record<string, boolean> | null
}

function parseLeadingInt(value: string | null): number | null {
  if (!value) return null
  const match = value.match(/-?\d+/)
  if (!match) return null
  const n = parseInt(match[0], 10)
  return Number.isFinite(n) ? n : null
}

function garageCount(parking: string | null): number {
  if (!parking) return 0
  const match = parking.match(/garage\s*\((\d+)\)/i)
  if (!match) return 0
  const n = parseInt(match[1], 10)
  return Number.isFinite(n) ? n : 0
}

export function deriveCriteria(
  listing: DerivableListing
): Record<CriterionKey, boolean> {
  const bedrooms = parseLeadingInt(listing.bedrooms)
  const schoolMin = parseLeadingInt(listing.commute_school_car)
  const pvmMin = parseLeadingInt(listing.commute_pvm_transit)

  return {
    no_above_neighbors: listing.criteria?.no_above_neighbors === true,
    school_within_20min: schoolMin !== null && schoolMin < 20,
    pvm_within_1h: pvmMin !== null && pvmMin < 60,
    three_bedrooms: bedrooms !== null && bedrooms >= 3,
    has_garage: garageCount(listing.parking) >= 1,
  }
}
