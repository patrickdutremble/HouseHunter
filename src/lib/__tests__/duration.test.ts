import { describe, it, expect } from 'vitest'
import { parseDurationToMinutes } from '@/lib/duration'

describe('parseDurationToMinutes', () => {
  it('parses the stored "N min" format', () => {
    expect(parseDurationToMinutes('9 min')).toBe(9)
    expect(parseDurationToMinutes('32 min')).toBe(32)
  })

  it('parses hours and combined hours/minutes', () => {
    expect(parseDurationToMinutes('1 hour')).toBe(60)
    expect(parseDurationToMinutes('1 hour 15 mins')).toBe(75)
  })

  it('parses the H:MM display format defensively', () => {
    expect(parseDurationToMinutes('0:09')).toBe(9)
    expect(parseDurationToMinutes('1:15')).toBe(75)
  })

  it('parses a bare integer as minutes', () => {
    expect(parseDurationToMinutes('9')).toBe(9)
  })

  it('returns null for blank or non-numeric values', () => {
    expect(parseDurationToMinutes(null)).toBeNull()
    expect(parseDurationToMinutes(undefined)).toBeNull()
    expect(parseDurationToMinutes('')).toBeNull()
    expect(parseDurationToMinutes('   ')).toBeNull()
    expect(parseDurationToMinutes('unknown')).toBeNull()
  })
})
