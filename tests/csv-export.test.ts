import { describe, it, expect } from 'vitest'
import { listingsToCSV } from '@/lib/csv-export'
import type { Listing } from '@/types/listing'

describe('listingsToCSV', () => {
  it('generates CSV header row', () => {
    const csv = listingsToCSV([])
    const firstLine = csv.split('\n')[0]
    expect(firstLine).toContain('Location')
    expect(firstLine).toContain('Price')
    expect(firstLine).toContain('MLS #')
  })

  it('generates data rows with proper escaping', () => {
    const listing: Partial<Listing> = {
      id: '1',
      location: 'Laval',
      price: 500000,
      mls_number: '12345678',
      notes: 'Has "nice" view, big yard',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const csv = listingsToCSV([listing as Listing])
    const lines = csv.split('\n')
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain('"Has ""nice"" view, big yard"')
  })

  it('handles null values as empty strings', () => {
    const listing: Partial<Listing> = {
      id: '1',
      location: null,
      price: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }
    const csv = listingsToCSV([listing as Listing])
    expect(csv).toContain(',,')
  })
})
