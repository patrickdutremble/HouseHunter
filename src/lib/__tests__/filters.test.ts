import { describe, it, expect } from 'vitest'
import { applyFilters, EMPTY_FILTERS } from '@/lib/filters'
import type { Listing } from '@/types/listing'

function mk(partial: Partial<Listing> = {}): Listing {
  return {
    id: 'x', centris_link: null, broker_link: null, location: null,
    full_address: null, mls_number: null, property_type: null,
    price: null, taxes_yearly: null, common_fees_yearly: null,
    bedrooms: null, liveable_area_sqft: null, price_per_sqft: null,
    parking: null, year_built: null, hydro_yearly: null,
    downpayment: null, monthly_mortgage: null, total_monthly_cost: null,
    commute_school_car: null, commute_school_has_toll: null,
    commute_pvm_transit: null, notes: null, personal_rating: null,
    status: 'active', status_checked_at: null, previous_price: null,
    price_changed_at: null, favorite: false, flagged_for_deletion: false,
    image_url: null, latitude: null, longitude: null,
    created_at: '2026-04-01', updated_at: '2026-04-01',
    deleted_at: null, criteria: null,
    ...partial,
  }
}

describe('applyFilters — existing behavior', () => {
  it('EMPTY_FILTERS returns all listings unchanged', () => {
    const listings = [mk({ id: 'a' }), mk({ id: 'b' })]
    expect(applyFilters(listings, EMPTY_FILTERS)).toEqual(listings)
  })

  it('filters by property type', () => {
    const ls = [mk({ id: 'a', property_type: 'Condo' }), mk({ id: 'b', property_type: 'House' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, type: 'Condo' })).toHaveLength(1)
  })

  it('filters by minPrice (keeps rows at or above; drops null/below)', () => {
    const ls = [mk({ id: 'a', price: 500000 }), mk({ id: 'b', price: 1000000 }), mk({ id: 'c', price: null })]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minPrice: '600000' })
    expect(out.map(l => l.id)).toEqual(['b'])
  })

  it('filters by maxPrice (null price passes through as +∞ → excluded)', () => {
    const ls = [mk({ id: 'a', price: 500000 }), mk({ id: 'b', price: 1000000 }), mk({ id: 'c', price: null })]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxPrice: '800000' })
    expect(out.map(l => l.id)).toEqual(['a'])
  })

  it('strips $ and commas from price inputs', () => {
    const ls = [mk({ id: 'a', price: 500000 })]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minPrice: '$400,000' })
    expect(out).toHaveLength(1)
  })

  it('filters by favoritesOnly', () => {
    const ls = [mk({ id: 'a', favorite: true }), mk({ id: 'b', favorite: false })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, favoritesOnly: true }).map(l => l.id)).toEqual(['a'])
  })

  it('filters by flagStatus=only and hide', () => {
    const ls = [mk({ id: 'a', flagged_for_deletion: true }), mk({ id: 'b', flagged_for_deletion: false })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, flagStatus: 'only' }).map(l => l.id)).toEqual(['a'])
    expect(applyFilters(ls, { ...EMPTY_FILTERS, flagStatus: 'hide' }).map(l => l.id)).toEqual(['b'])
  })
})

describe('applyFilters — minBeds', () => {
  it('includes rows where bedrooms parses >= min', () => {
    const ls = [
      mk({ id: 'a', bedrooms: '2' }),
      mk({ id: 'b', bedrooms: '3' }),
      mk({ id: 'c', bedrooms: '4' }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '3' })
    expect(out.map(l => l.id)).toEqual(['b', 'c'])
  })

  it('treats "3+1" legacy value as 3 (parseInt)', () => {
    const ls = [mk({ id: 'a', bedrooms: '3+1' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '3' })).toHaveLength(1)
    expect(applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '4' })).toHaveLength(0)
  })

  it('excludes rows with null/unparseable bedrooms when active', () => {
    const ls = [
      mk({ id: 'a', bedrooms: null }),
      mk({ id: 'b', bedrooms: 'studio' }),
      mk({ id: 'c', bedrooms: '3' }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '1' })
    expect(out.map(l => l.id)).toEqual(['c'])
  })

  it('empty minBeds = no filtering', () => {
    const ls = [mk({ id: 'a', bedrooms: null })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '' })).toHaveLength(1)
  })
})
