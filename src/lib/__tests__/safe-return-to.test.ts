import { describe, it, expect } from 'vitest'
import { safeReturnTo } from '@/lib/safe-return-to'

describe('safeReturnTo', () => {
  it('returns "/" for null', () => {
    expect(safeReturnTo(null)).toBe('/')
  })

  it('returns "/" for undefined', () => {
    expect(safeReturnTo(undefined)).toBe('/')
  })

  it('returns "/" for empty string', () => {
    expect(safeReturnTo('')).toBe('/')
  })

  it('returns the path when it starts with a single "/"', () => {
    expect(safeReturnTo('/')).toBe('/')
    expect(safeReturnTo('/recent')).toBe('/recent')
    expect(safeReturnTo('/add-listing?url=https%3A%2F%2Fcentris.ca%2F123')).toBe(
      '/add-listing?url=https%3A%2F%2Fcentris.ca%2F123'
    )
  })

  it('returns "/" for protocol-relative URLs (open-redirect attack)', () => {
    expect(safeReturnTo('//evil.com')).toBe('/')
    expect(safeReturnTo('//evil.com/path')).toBe('/')
  })

  it('returns "/" for absolute URLs', () => {
    expect(safeReturnTo('https://evil.com')).toBe('/')
    expect(safeReturnTo('http://example.com/path')).toBe('/')
  })

  it('returns "/" for paths that do not start with "/"', () => {
    expect(safeReturnTo('recent')).toBe('/')
    expect(safeReturnTo('javascript:alert(1)')).toBe('/')
  })
})
