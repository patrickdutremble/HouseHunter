import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

function flagged(id: string): Listing {
  return { ...BASE, id, flagged_for_deletion: true, location: `F-${id}` }
}
function unflagged(id: string): Listing {
  return { ...BASE, id, flagged_for_deletion: false, location: `U-${id}` }
}

function renderTable(listings: Listing[]) {
  return render(
    <ListingsTable
      listings={listings}
      selectedId={null}
      onSelect={() => {}}
      onUpdate={() => {}}
      compareIds={new Set()}
      onToggleCompare={() => {}}
    />,
  )
}

describe('ListingsTable flagStatus filtering', () => {
  it('shows all listings by default', () => {
    renderTable([flagged('a'), unflagged('b')])
    expect(screen.getByText('F-a')).toBeInTheDocument()
    expect(screen.getByText('U-b')).toBeInTheDocument()
  })

  it('shows only flagged listings when Flagged only is active', () => {
    renderTable([flagged('a'), unflagged('b')])
    fireEvent.click(screen.getByRole('radio', { name: /Flagged only/ }))
    expect(screen.getByText('F-a')).toBeInTheDocument()
    expect(screen.queryByText('U-b')).not.toBeInTheDocument()
  })

  it('hides flagged listings when Hide flagged is active', () => {
    renderTable([flagged('a'), unflagged('b')])
    fireEvent.click(screen.getByRole('radio', { name: /Hide flagged/ }))
    expect(screen.queryByText('F-a')).not.toBeInTheDocument()
    expect(screen.getByText('U-b')).toBeInTheDocument()
  })
})
