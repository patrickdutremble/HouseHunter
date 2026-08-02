import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListingsTable } from '../ListingsTable'
import type { Listing } from '@/types/listing'

const BASE: Listing = {
  id: '1',
  centris_link: null,
  broker_link: null,
  location: 'Laval',
  full_address: null,
  mls_number: null,
  property_type: 'Condo',
  price: 100000,
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

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
})

function row(id: string): Listing {
  return { ...BASE, id, location: `L-${id}` }
}

function renderTable(listings: Listing[], overrides: Record<string, unknown> = {}) {
  return render(
    <ListingsTable
      listings={listings}
      sort={[]}
      onToggleSort={() => {}}
      hasAnyListings={listings.length > 0}
      selectedId={null}
      onSelect={() => {}}
      onUpdate={() => {}}
      compareIds={new Set()}
      onToggleCompare={() => {}}
      {...overrides}
    />,
  )
}

describe('ListingsTable', () => {
  it('renders the listings it is given', () => {
    renderTable([row('a'), row('b')])
    expect(screen.getByText('L-a')).toBeInTheDocument()
    expect(screen.getByText('L-b')).toBeInTheDocument()
  })

  it('does not render the filter bar (filters live in the page toolbar now)', () => {
    renderTable([row('a')])
    expect(screen.queryByRole('radiogroup', { name: /Flag status/ })).not.toBeInTheDocument()
  })

  it('shows the filtered-empty message when given no rows but listings exist', () => {
    renderTable([], { hasAnyListings: true })
    expect(screen.getByText(/No listings match your filters/i)).toBeInTheDocument()
  })

  it('shows the no-listings message when there are none at all', () => {
    renderTable([], { hasAnyListings: false })
    expect(screen.getByText(/No listings yet/i)).toBeInTheDocument()
  })
})
