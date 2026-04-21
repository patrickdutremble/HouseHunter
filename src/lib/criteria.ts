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
