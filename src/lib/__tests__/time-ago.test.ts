import { describe, expect, it } from 'vitest'
import { timeAgo } from '../time-ago'

const NOW = new Date('2026-04-21T12:00:00Z').getTime()

describe('timeAgo', () => {
  it('returns "just now" for under a minute', () => {
    expect(timeAgo(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now')
  })
  it('returns minutes', () => {
    expect(timeAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5m ago')
  })
  it('returns hours', () => {
    expect(timeAgo(new Date(NOW - 3 * 60 * 60_000).toISOString(), NOW)).toBe('3h ago')
  })
  it('returns days', () => {
    expect(timeAgo(new Date(NOW - 2 * 24 * 60 * 60_000).toISOString(), NOW)).toBe('2d ago')
  })
  it('returns null for null input', () => {
    expect(timeAgo(null, NOW)).toBeNull()
  })
})
