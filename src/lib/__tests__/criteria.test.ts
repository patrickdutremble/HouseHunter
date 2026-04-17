import { describe, it, expect } from 'vitest'
import { criteria, countChecked } from '../criteria'

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
