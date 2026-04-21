import { describe, it, expect } from 'vitest'
import { criteria, countChecked, deriveCriteria, isDerivedCriterion } from '../criteria'

function makeDerivable(overrides: Partial<Parameters<typeof deriveCriteria>[0]> = {}) {
  return {
    bedrooms: null,
    parking: null,
    commute_school_car: null,
    commute_pvm_transit: null,
    criteria: null,
    ...overrides,
  }
}

describe('criteria config', () => {
  it('contains the 5 initial criteria with unique keys', () => {
    expect(criteria.length).toBe(5)
    const keys = criteria.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every criterion has a non-empty label', () => {
    for (const c of criteria) {
      expect(c.label.length).toBeGreaterThan(0)
    }
  })
})

describe('countChecked', () => {
  it('returns 0 when value is null', () => {
    expect(countChecked(null)).toBe(0)
  })

  it('returns 0 when value is undefined', () => {
    expect(countChecked(undefined)).toBe(0)
  })

  it('returns 0 when value is an empty object', () => {
    expect(countChecked({})).toBe(0)
  })

  it('returns the number of true entries that match a known criterion key', () => {
    const value = {
      no_above_neighbors: true,
      school_within_20min: true,
      pvm_within_1h: false,
    }
    expect(countChecked(value)).toBe(2)
  })

  it('ignores keys that are not in the config', () => {
    const value = { unknown_key: true, no_above_neighbors: true }
    expect(countChecked(value)).toBe(1)
  })

  it('ignores entries that are explicitly false', () => {
    const value = {
      no_above_neighbors: false,
      school_within_20min: false,
    }
    expect(countChecked(value)).toBe(0)
  })
})

describe('isDerivedCriterion', () => {
  it('marks the 4 auto-derived criteria as derived', () => {
    expect(isDerivedCriterion('school_within_20min')).toBe(true)
    expect(isDerivedCriterion('pvm_within_1h')).toBe(true)
    expect(isDerivedCriterion('three_bedrooms')).toBe(true)
    expect(isDerivedCriterion('has_garage')).toBe(true)
  })

  it('treats no_above_neighbors as manual', () => {
    expect(isDerivedCriterion('no_above_neighbors')).toBe(false)
  })
})

describe('deriveCriteria', () => {
  it('returns all false when all fields are null', () => {
    const result = deriveCriteria(makeDerivable())
    expect(result).toEqual({
      no_above_neighbors: false,
      school_within_20min: false,
      pvm_within_1h: false,
      three_bedrooms: false,
      has_garage: false,
    })
  })

  it('three_bedrooms is true when bedrooms is 3 or more', () => {
    expect(deriveCriteria(makeDerivable({ bedrooms: '3' })).three_bedrooms).toBe(true)
    expect(deriveCriteria(makeDerivable({ bedrooms: '4' })).three_bedrooms).toBe(true)
    expect(deriveCriteria(makeDerivable({ bedrooms: '2' })).three_bedrooms).toBe(false)
    expect(deriveCriteria(makeDerivable({ bedrooms: '' })).three_bedrooms).toBe(false)
    expect(deriveCriteria(makeDerivable({ bedrooms: 'n/a' })).three_bedrooms).toBe(false)
  })

  it('school_within_20min is true when school commute is strictly less than 20 min', () => {
    expect(deriveCriteria(makeDerivable({ commute_school_car: '13 min' })).school_within_20min).toBe(true)
    expect(deriveCriteria(makeDerivable({ commute_school_car: '19 min' })).school_within_20min).toBe(true)
    expect(deriveCriteria(makeDerivable({ commute_school_car: '20 min' })).school_within_20min).toBe(false)
    expect(deriveCriteria(makeDerivable({ commute_school_car: '25 min' })).school_within_20min).toBe(false)
  })

  it('pvm_within_1h is true when PVM commute is strictly less than 60 min', () => {
    expect(deriveCriteria(makeDerivable({ commute_pvm_transit: '44 min' })).pvm_within_1h).toBe(true)
    expect(deriveCriteria(makeDerivable({ commute_pvm_transit: '59 min' })).pvm_within_1h).toBe(true)
    expect(deriveCriteria(makeDerivable({ commute_pvm_transit: '60 min' })).pvm_within_1h).toBe(false)
    expect(deriveCriteria(makeDerivable({ commute_pvm_transit: '80 min' })).pvm_within_1h).toBe(false)
  })

  it('has_garage is true when parking mentions "Garage (n)" with n >= 1', () => {
    expect(deriveCriteria(makeDerivable({ parking: 'Garage (1)' })).has_garage).toBe(true)
    expect(deriveCriteria(makeDerivable({ parking: 'Garage (2)' })).has_garage).toBe(true)
    expect(deriveCriteria(makeDerivable({ parking: 'Driveway (2), Garage (1)' })).has_garage).toBe(true)
    expect(deriveCriteria(makeDerivable({ parking: 'Driveway (2)' })).has_garage).toBe(false)
    expect(deriveCriteria(makeDerivable({ parking: 'Carport (1)' })).has_garage).toBe(false)
  })

  it('no_above_neighbors reflects the stored criteria value', () => {
    expect(deriveCriteria(makeDerivable({ criteria: { no_above_neighbors: true } })).no_above_neighbors).toBe(true)
    expect(deriveCriteria(makeDerivable({ criteria: { no_above_neighbors: false } })).no_above_neighbors).toBe(false)
    expect(deriveCriteria(makeDerivable({ criteria: null })).no_above_neighbors).toBe(false)
  })

  it('ignores stored criteria values for derived keys', () => {
    const result = deriveCriteria(makeDerivable({
      bedrooms: '2',
      criteria: { three_bedrooms: true },
    }))
    expect(result.three_bedrooms).toBe(false)
  })
})
