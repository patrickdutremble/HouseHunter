import { describe, it, expect } from 'vitest'
import { formatCellValue } from '@/lib/formatting'

describe('formatCellValue — duration', () => {
  it('renders the stored "N min" format as H:MM', () => {
    expect(formatCellValue('9 min', 'duration')).toBe('0:09')
    expect(formatCellValue('75 min', 'duration')).toBe('1:15')
  })

  it('renders an already-H:MM value correctly (regression for 0:09 -> 0:00)', () => {
    expect(formatCellValue('0:09', 'duration')).toBe('0:09')
  })

  it('renders blank values as an em dash', () => {
    expect(formatCellValue(null, 'duration')).toBe('—')
    expect(formatCellValue('', 'duration')).toBe('—')
  })

  it('passes through non-numeric text unchanged', () => {
    expect(formatCellValue('unknown', 'duration')).toBe('unknown')
  })
})
