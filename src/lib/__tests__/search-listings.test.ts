import { describe, it, expect } from 'vitest'
import { filterListings } from '../search-listings'
import type { Listing } from '@/types/listing'

const BASE: Listing = {
  id: '1',
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
  commute_school_has_toll: null,
  commute_pvm_transit: null,
  notes: null,
  personal_rating: null,
  status: 'active',
  status_checked_at: null,
  previous_price: null,
  price_changed_at: null,
  favorite: false,
  flagged_for_deletion: false,
  image_url: null,
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

const verdun: Listing = { ...BASE, id: 'v', location: 'Verdun', full_address: '123 Rue Wellington, Verdun' }
const rosemont: Listing = { ...BASE, id: 'r', location: 'Rosemont', notes: 'great garage and yard' }

describe('filterListings', () => {
  it('returns all listings for an empty or whitespace query', () => {
    expect(filterListings([verdun, rosemont], '')).toEqual([verdun, rosemont])
    expect(filterListings([verdun, rosemont], '   ')).toEqual([verdun, rosemont])
  })

  it('matches on location substring', () => {
    expect(filterListings([verdun, rosemont], 'verd')).toEqual([verdun])
  })

  it('matches on full_address substring', () => {
    expect(filterListings([verdun, rosemont], 'wellington')).toEqual([verdun])
  })

  it('matches on notes substring', () => {
    expect(filterListings([verdun, rosemont], 'garage')).toEqual([rosemont])
  })

  it('is case-insensitive', () => {
    expect(filterListings([verdun, rosemont], 'ROSE')).toEqual([rosemont])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterListings([verdun, rosemont], 'zzz')).toEqual([])
  })

  it('treats null fields as non-matching, not errors', () => {
    expect(filterListings([BASE], 'anything')).toEqual([])
  })
})
