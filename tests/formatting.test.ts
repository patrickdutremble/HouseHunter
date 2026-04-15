import { describe, it, expect } from 'vitest'
import { formatCellValue } from '@/lib/formatting'

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
