import { describe, it, expect } from 'vitest'
import { getPillClasses, formatPillPrice, isCloseToSchool } from '../marker-style'

describe('isCloseToSchool', () => {
  it('returns true when commute_school_car is under 20 minutes', () => {
    expect(isCloseToSchool('15 min')).toBe(true)
    expect(isCloseToSchool('19 min')).toBe(true)
  })
  it('returns false at or above 20 minutes', () => {
    expect(isCloseToSchool('20 min')).toBe(false)
    expect(isCloseToSchool('45 min')).toBe(false)
  })
  it('returns false when commute is null or unparseable', () => {
    expect(isCloseToSchool(null)).toBe(false)
    expect(isCloseToSchool('')).toBe(false)
    expect(isCloseToSchool('unknown')).toBe(false)
  })
})

describe('getPillClasses', () => {
  it('returns the regular far-from-school classes', () => {
    const c = getPillClasses({ favorite: false, commute_school_car: '30 min' })
    expect(c.pill).toContain('bg-white')
    expect(c.pill).toContain('border-slate-400')
    expect(c.text).toContain('text-slate-900')
    expect(c.showDot).toBe(false)
  })
  it('adds the teal corner dot when close to school', () => {
    const c = getPillClasses({ favorite: false, commute_school_car: '15 min' })
    expect(c.showDot).toBe(true)
  })
  it('uses amber fill and white text for favorites', () => {
    const c = getPillClasses({ favorite: true, commute_school_car: '30 min' })
    expect(c.pill).toContain('bg-amber-500')
    expect(c.pill).toContain('border-amber-500')
    expect(c.text).toContain('text-white')
    expect(c.showDot).toBe(false)
  })
  it('combines amber fill with the dot for a close favorite', () => {
    const c = getPillClasses({ favorite: true, commute_school_car: '15 min' })
    expect(c.pill).toContain('bg-amber-500')
    expect(c.text).toContain('text-white')
    expect(c.showDot).toBe(true)
  })
})

describe('formatPillPrice', () => {
  it('formats thousands as $NNNk', () => {
    expect(formatPillPrice(489000)).toBe('$489k')
    expect(formatPillPrice(999999)).toBe('$1.0m')
  })
  it('formats millions as $N.Nm', () => {
    expect(formatPillPrice(1250000)).toBe('$1.3m')
    expect(formatPillPrice(2000000)).toBe('$2.0m')
  })
  it('returns a dash for null', () => {
    expect(formatPillPrice(null)).toBe('$—')
  })
})
