import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableRow } from '../TableRow'
import type { Listing } from '@/types/listing'

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'test-id',
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
    status: 'active',
    status_checked_at: null,
    previous_price: null,
    price_changed_at: null,
    favorite: false,
    flagged_for_deletion: false,
    image_url: null,
    latitude: null,
    longitude: null,
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

function renderRow(listing: Listing) {
  return render(
    <table>
      <tbody>
        <TableRow
          listing={listing}
          isSelected={false}
          onSelect={() => {}}
          onUpdate={() => {}}
          isCompared={false}
          onToggleCompare={() => {}}
        />
      </tbody>
    </table>
  )
}

describe('Criteria count cell', () => {
  it('renders 0/5 when criteria is null', () => {
    renderRow(makeListing({ criteria: null }))
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('renders 0/5 when criteria is empty object', () => {
    renderRow(makeListing({ criteria: {} }))
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('renders 3/5 when three criteria are met (manual + derived)', () => {
    renderRow(makeListing({
      commute_school_car: '15 min',
      commute_pvm_transit: '45 min',
      criteria: { no_above_neighbors: true },
    }))
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('renders 5/5 when all criteria are met', () => {
    renderRow(makeListing({
      bedrooms: '3',
      parking: 'Garage (1)',
      commute_school_car: '15 min',
      commute_pvm_transit: '45 min',
      criteria: { no_above_neighbors: true },
    }))
    expect(screen.getByText('5/5')).toBeInTheDocument()
  })

  it('derives three_bedrooms from the bedrooms field', () => {
    renderRow(makeListing({ bedrooms: '3' }))
    expect(screen.getByText('1/5')).toBeInTheDocument()
  })

  it('derives has_garage from the parking field', () => {
    renderRow(makeListing({ parking: 'Driveway (2), Garage (1)' }))
    expect(screen.getByText('1/5')).toBeInTheDocument()
  })
})
