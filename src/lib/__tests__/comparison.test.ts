import { describe, it, expect } from 'vitest'
import { getBestValues } from '../comparison'
import type { Listing } from '@/types/listing'

function makeListing(overrides: Partial<Listing>): Listing {
  return {
    id: 'default',
    centris_link: null,
    broker_link: null,
    location: null,
    full_address: null,
    mls_number: null,
    property_type: null,
    price: null,
    taxes_yearly: null,
    common_fees_yearly: null,
    bedrooms: null,
    liveable_area_sqft: null,
    price_per_sqft: null,
    parking: null,
    year_built: null,
    hydro_yearly: null,
    downpayment: null,
    monthly_mortgage: null,
    total_monthly_cost: null,
    commute_school_car: null,
    commute_pvm_transit: null,
    notes: null,
    personal_rating: null,
    status: null,
    favorite: false,
    image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

describe('getBestValues', () => {
  it('picks lowest price', () => {
    const listings = [
      makeListing({ id: 'a', price: 500000 }),
      makeListing({ id: 'b', price: 300000 }),
      makeListing({ id: 'c', price: 400000 }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set(['b']))
  })

  it('picks highest bedrooms (parses "2+1" as 3)', () => {
    const listings = [
      makeListing({ id: 'a', bedrooms: '2+1' }),
      makeListing({ id: 'b', bedrooms: '4' }),
      makeListing({ id: 'c', bedrooms: '3' }),
    ]
    const best = getBestValues(listings)
    expect(best.bedrooms).toEqual(new Set(['b']))
  })

  it('handles ties — both get highlighted', () => {
    const listings = [
      makeListing({ id: 'a', price: 300000 }),
      makeListing({ id: 'b', price: 300000 }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set(['a', 'b']))
  })

  it('ignores nulls', () => {
    const listings = [
      makeListing({ id: 'a', price: null }),
      makeListing({ id: 'b', price: 400000 }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set())
  })

  it('does not highlight when only one listing has a value', () => {
    const listings = [
      makeListing({ id: 'a', price: 400000 }),
      makeListing({ id: 'b', price: null }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set())
  })

  it('picks newest year_built', () => {
    const listings = [
      makeListing({ id: 'a', year_built: 1990 }),
      makeListing({ id: 'b', year_built: 2020 }),
    ]
    const best = getBestValues(listings)
    expect(best.year_built).toEqual(new Set(['b']))
  })

  it('picks largest liveable_area_sqft', () => {
    const listings = [
      makeListing({ id: 'a', liveable_area_sqft: 800 }),
      makeListing({ id: 'b', liveable_area_sqft: 1200 }),
    ]
    const best = getBestValues(listings)
    expect(best.liveable_area_sqft).toEqual(new Set(['b']))
  })

  it('picks shortest commute (parses "1:15" as 75 minutes)', () => {
    const listings = [
      makeListing({ id: 'a', commute_school_car: '0:45' }),
      makeListing({ id: 'b', commute_school_car: '1:15' }),
    ]
    const best = getBestValues(listings)
    expect(best.commute_school_car).toEqual(new Set(['a']))
  })

  it('picks most parking spaces', () => {
    const listings = [
      makeListing({ id: 'a', parking: '1' }),
      makeListing({ id: 'b', parking: '2' }),
    ]
    const best = getBestValues(listings)
    expect(best.parking).toEqual(new Set(['b']))
  })
})

describe('getBestValues — criteria', () => {
  it('picks listing with highest criteria_count', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { no_above_neighbors: true, three_bedrooms: true } }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: true, three_bedrooms: true, has_garage: true } }),
      makeListing({ id: 'c', criteria: { no_above_neighbors: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.criteria_count).toEqual(new Set(['b']))
  })

  it('treats missing criteria as zero checked', () => {
    const listings = [
      makeListing({ id: 'a', criteria: null }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.criteria_count).toEqual(new Set(['b']))
  })

  it('ties on criteria_count highlight all tied listings', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { no_above_neighbors: true, three_bedrooms: true } }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: true, has_garage: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.criteria_count).toEqual(new Set(['a', 'b']))
  })

  it('per-criterion: highlights listings with criterion checked when others do not', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { no_above_neighbors: true } }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: false } }),
      makeListing({ id: 'c', criteria: null }),
    ]
    const best = getBestValues(listings)
    expect(best.no_above_neighbors).toEqual(new Set(['a']))
  })

  it('per-criterion: no highlight when all listings have the criterion checked', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { has_garage: true } }),
      makeListing({ id: 'b', criteria: { has_garage: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.has_garage).toEqual(new Set())
  })

  it('per-criterion: no highlight when no listing has the criterion checked', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { has_garage: false } }),
      makeListing({ id: 'b', criteria: null }),
    ]
    const best = getBestValues(listings)
    expect(best.has_garage).toEqual(new Set())
  })
})
