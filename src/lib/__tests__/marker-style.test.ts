import { describe, it, expect } from 'vitest'
import { getPillClasses, formatPillPrice, getDotColor } from '../marker-style'
import { SCHOOL_COORDS } from '../map-config'

// A point ~N km due east of the school at this latitude.
function pointKmEast(km: number): { latitude: number; longitude: number } {
  const [lat, lon] = SCHOOL_COORDS
  const degPerKm = 1 / (111.32 * Math.cos((lat * Math.PI) / 180))
  return { latitude: lat, longitude: lon + km * degPerKm }
}

describe('getDotColor', () => {
  it('returns teal for points within the inner zone', () => {
    const p = pointKmEast(5)
    expect(getDotColor(p.latitude, p.longitude)).toBe('teal')
  })
  it('returns yellow for points between the inner and outer zone', () => {
    const p = pointKmEast(12)
    expect(getDotColor(p.latitude, p.longitude)).toBe('yellow')
  })
  it('returns null for points outside the outer zone', () => {
    const p = pointKmEast(20)
    expect(getDotColor(p.latitude, p.longitude)).toBeNull()
  })
  it('returns null when coordinates are missing', () => {
    expect(getDotColor(null, null)).toBeNull()
    expect(getDotColor(45, null)).toBeNull()
  })
})

describe('getPillClasses', () => {
  it('returns far-from-school classes with no dot', () => {
    const p = pointKmEast(20)
    const c = getPillClasses({ favorite: false, latitude: p.latitude, longitude: p.longitude })
    expect(c.pill).toContain('bg-white')
    expect(c.pill).toContain('border-slate-400')
    expect(c.text).toContain('text-slate-900')
    expect(c.dotColor).toBeNull()
  })
  it('adds a teal dot when inside the inner zone', () => {
    const p = pointKmEast(5)
    const c = getPillClasses({ favorite: false, latitude: p.latitude, longitude: p.longitude })
    expect(c.dotColor).toBe('teal')
  })
  it('adds a yellow dot when between inner and outer zones', () => {
    const p = pointKmEast(12)
    const c = getPillClasses({ favorite: false, latitude: p.latitude, longitude: p.longitude })
    expect(c.dotColor).toBe('yellow')
  })
  it('uses amber fill and white text for favorites', () => {
    const p = pointKmEast(20)
    const c = getPillClasses({ favorite: true, latitude: p.latitude, longitude: p.longitude })
    expect(c.pill).toContain('bg-amber-500')
    expect(c.pill).toContain('border-amber-500')
    expect(c.text).toContain('text-white')
    expect(c.dotColor).toBeNull()
  })
  it('combines amber fill with a teal dot for a close favorite', () => {
    const p = pointKmEast(5)
    const c = getPillClasses({ favorite: true, latitude: p.latitude, longitude: p.longitude })
    expect(c.pill).toContain('bg-amber-500')
    expect(c.text).toContain('text-white')
    expect(c.dotColor).toBe('teal')
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
