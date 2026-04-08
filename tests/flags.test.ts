import { describe, it, expect } from 'vitest'
import { generateFlags, hasHighFees, hasNonStandardFoundation, hasNonStandardWater } from '@/lib/flags'

describe('hasHighFees', () => {
  it('returns true if yearly fees > $6,000 (i.e. >$500/mo)', () => {
    expect(hasHighFees(7200)).toBe(true)
  })

  it('returns false if yearly fees <= $6,000', () => {
    expect(hasHighFees(6000)).toBe(false)
  })

  it('returns false if null', () => {
    expect(hasHighFees(null)).toBe(false)
  })
})

describe('hasNonStandardFoundation', () => {
  it('detects stone foundation', () => {
    expect(hasNonStandardFoundation('Stone foundation, 2 storey')).toBe(true)
  })

  it('detects block foundation', () => {
    expect(hasNonStandardFoundation('Concrete block')).toBe(true)
  })

  it('returns false for concrete (poured)', () => {
    expect(hasNonStandardFoundation('Poured concrete')).toBe(false)
  })

  it('returns false for null', () => {
    expect(hasNonStandardFoundation(null)).toBe(false)
  })
})

describe('hasNonStandardWater', () => {
  it('detects well water', () => {
    expect(hasNonStandardWater('Well')).toBe(true)
  })

  it('detects septic system', () => {
    expect(hasNonStandardWater('Septic tank')).toBe(true)
  })

  it('returns false for municipal', () => {
    expect(hasNonStandardWater('Municipal water and sewer')).toBe(false)
  })

  it('returns false for null', () => {
    expect(hasNonStandardWater(null)).toBe(false)
  })
})

describe('generateFlags', () => {
  it('generates combined flag text', () => {
    const flags = generateFlags({
      common_fees_yearly: 7200,
      foundation: 'Stone',
      water_sewer: 'Well and septic',
    })
    expect(flags).toContain('High condo fees')
    expect(flags).toContain('foundation')
    expect(flags).toContain('water')
  })

  it('returns empty string when no flags', () => {
    const flags = generateFlags({
      common_fees_yearly: 3600,
      foundation: 'Poured concrete',
      water_sewer: 'Municipal',
    })
    expect(flags).toBe('')
  })
})
