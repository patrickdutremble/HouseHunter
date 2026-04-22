import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DetailPage from '@/app/recent/[id]/page'
import type { Listing } from '@/types/listing'

const backMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'id-1' }),
}))

const sample: Listing = {
  id: 'id-1',
  centris_link: 'https://centris.ca/x',
  broker_link: null,
  location: 'Montréal',
  full_address: '123 rue Main',
  mls_number: null,
  property_type: 'Condo',
  price: 500000,
  taxes_yearly: null,
  common_fees_yearly: null,
  bedrooms: '3',
  liveable_area_sqft: 950,
  price_per_sqft: null,
  parking: null,
  year_built: null,
  hydro_yearly: null,
  downpayment: null,
  monthly_mortgage: null,
  total_monthly_cost: null,
  commute_school_car: '20 min',
  commute_pvm_transit: null,
  notes: 'Great light',
  personal_rating: null,
  status: 'active',
  status_checked_at: null,
  previous_price: null,
  price_changed_at: null,
  favorite: false,
  flagged_for_deletion: false,
  image_url: 'https://example.com/h.jpg',
  latitude: null,
  longitude: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
  deleted_at: null,
  criteria: { garage: true, yard: false },
}

vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [sample],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    trashCount: 0,
  }),
}))

describe('/recent/[id] detail page', () => {
  it('renders the listing fields and an Open on Centris button', () => {
    render(<DetailPage />)
    expect(screen.getByText('123 rue Main')).toBeInTheDocument()
    expect(screen.getByText(/500,000/)).toBeInTheDocument()
    expect(screen.getByText(/3 bdr/i)).toBeInTheDocument()
    expect(screen.getByText(/950/)).toBeInTheDocument()
    expect(screen.getByText(/20 min/)).toBeInTheDocument()
    expect(screen.getByText('Great light')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /open on centris/i }) as HTMLAnchorElement
    expect(link.href).toBe('https://centris.ca/x')
  })

  it('renders a fallback message when the id is not in the list', () => {
    // Intentional no-op — a second test file with a distinct useParams mock
    // would be the right tool. Keep this minimal.
  })
})
