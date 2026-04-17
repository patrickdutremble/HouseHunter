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
    status: null,
    favorite: false,
    image_url: null,
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

  it('renders 3/5 when three criteria are checked', () => {
    renderRow(makeListing({
      criteria: {
        no_above_neighbors: true,
        school_within_20min: true,
        pvm_within_1h: true,
      },
    }))
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('renders 5/5 when all criteria are checked', () => {
    renderRow(makeListing({
      criteria: {
        no_above_neighbors: true,
        school_within_20min: true,
        pvm_within_1h: true,
        three_bedrooms: true,
        has_garage: true,
      },
    }))
    expect(screen.getByText('5/5')).toBeInTheDocument()
  })
})
