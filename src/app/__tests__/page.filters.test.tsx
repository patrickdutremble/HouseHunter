import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Listing } from '@/types/listing'

// view is read from useSearchParams; make it controllable per test.
let view = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(view ? `view=${view}` : ''),
}))

// Replace the leaflet-backed map with a stub that just lists what it receives,
// so we can assert which listings reach the map view.
vi.mock('@/components/MapView', () => ({
  default: ({ listings }: { listings: Listing[] }) => (
    <div data-testid="map">
      {listings.map(l => (
        <span key={l.id}>{l.location}</span>
      ))}
    </div>
  ),
}))

const BASE: Listing = {
  id: '1', centris_link: null, broker_link: null, location: null, full_address: null,
  mls_number: null, property_type: null, price: null, taxes_yearly: null,
  common_fees_yearly: null, bedrooms: null, liveable_area_sqft: null, price_per_sqft: null,
  parking: null, year_built: null, hydro_yearly: null, downpayment: null,
  monthly_mortgage: null, total_monthly_cost: null, commute_school_car: null,
  commute_school_has_toll: null, commute_pvm_transit: null, notes: null,
  personal_rating: null, status: 'active', status_checked_at: null, previous_price: null,
  price_changed_at: null, favorite: false, flagged_for_deletion: false, image_url: null,
  latitude: null, longitude: null, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', deleted_at: null, criteria: null,
}
const verdun: Listing = { ...BASE, id: 'v', location: 'Verdun', flagged_for_deletion: false }
const rosemont: Listing = { ...BASE, id: 'r', location: 'Rosemont', flagged_for_deletion: true }

vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [verdun, rosemont],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    beginBulkSoftDelete: vi.fn(),
    trashCount: 0,
  }),
}))

import HomePage from '@/app/page'
import { ThemeProvider } from '@/components/ThemeProvider'

function mockDesktop() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
}

function renderPage() {
  return render(<HomePage />, { wrapper: ThemeProvider })
}

describe('/ filters apply to both views', () => {
  beforeEach(() => { mockDesktop() })
  afterEach(() => { view = ''; vi.restoreAllMocks() })

  it('applies filters to the table view', () => {
    view = ''
    renderPage()
    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.getByText('Rosemont')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /Hide flagged/ }))

    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.queryByText('Rosemont')).toBeNull()
  })

  it('applies filters to the map view', async () => {
    view = 'map'
    renderPage()
    const map = await screen.findByTestId('map')
    expect(within(map).getByText('Verdun')).toBeTruthy()
    expect(within(map).getByText('Rosemont')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /Hide flagged/ }))

    expect(within(map).getByText('Verdun')).toBeTruthy()
    expect(within(map).queryByText('Rosemont')).toBeNull()
  })

  it('hides the sort button on the map view', async () => {
    view = 'map'
    renderPage()
    await screen.findByTestId('map')
    expect(screen.queryByRole('button', { name: /^Sort$/ })).toBeNull()
  })
})
