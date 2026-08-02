import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Listing } from '@/types/listing'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
const verdun: Listing = { ...BASE, id: 'v', location: 'Verdun' }
const rosemont: Listing = { ...BASE, id: 'r', location: 'Rosemont' }

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

describe('/ search bar', () => {
  beforeEach(() => { mockDesktop() })
  afterEach(() => { vi.restoreAllMocks() })

  it('shows a search box and no URL/Paste/Add controls', () => {
    renderPage()
    expect(screen.getByPlaceholderText('Search address or notes…')).toBeTruthy()
    expect(document.querySelector('input[type="url"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Paste from clipboard' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Add$/ })).toBeNull()
  })

  it('filters the table as the user types', () => {
    renderPage()
    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.getByText('Rosemont')).toBeTruthy()

    const box = screen.getByPlaceholderText('Search address or notes…')
    fireEvent.change(box, { target: { value: 'verd' } })

    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.queryByText('Rosemont')).toBeNull()
  })

  it('clears the query when Escape is pressed', () => {
    renderPage()
    const box = screen.getByPlaceholderText('Search address or notes…')
    fireEvent.change(box, { target: { value: 'verd' } })
    expect(screen.queryByText('Rosemont')).toBeNull()

    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.getByText('Rosemont')).toBeTruthy()
    expect((box as HTMLInputElement).value).toBe('')
  })

  it('shows a no-match message when nothing matches', () => {
    renderPage()
    const box = screen.getByPlaceholderText('Search address or notes…')
    fireEvent.change(box, { target: { value: 'zzzzz' } })
    expect(screen.getByText(/No listings match/i)).toBeTruthy()
  })
})
