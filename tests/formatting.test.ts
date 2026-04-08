import { describe, it, expect } from 'vitest'
import { formatCurrency, formatInteger, formatCellValue } from '@/lib/formatting'

describe('formatCurrency', () => {
  it('formats with dollar sign and commas', () => {
    expect(formatCurrency(500000)).toBe('$500,000')
  })

  it('formats large numbers', () => {
    expect(formatCurrency(1250000)).toBe('$1,250,000')
  })

  it('returns em dash for null', () => {
    expect(formatCurrency(null)).toBe('—')
  })

  it('formats small numbers', () => {
    expect(formatCurrency(750)).toBe('$750')
  })
})

describe('formatInteger', () => {
  it('formats with commas', () => {
    expect(formatInteger(1200)).toBe('1,200')
  })

  it('returns em dash for null', () => {
    expect(formatInteger(null)).toBe('—')
  })
})

describe('formatCellValue', () => {
  it('formats currency columns', () => {
    expect(formatCellValue(500000, 'currency')).toBe('$500,000')
  })

  it('formats integer columns', () => {
    expect(formatCellValue(1200, 'integer')).toBe('1,200')
  })

  it('formats text columns', () => {
    expect(formatCellValue('Laval', 'text')).toBe('Laval')
  })

  it('returns em dash for null text', () => {
    expect(formatCellValue(null, 'text')).toBe('—')
  })

  it('formats link columns as URL text', () => {
    expect(formatCellValue('https://centris.ca/123', 'link')).toBe('https://centris.ca/123')
  })
})
