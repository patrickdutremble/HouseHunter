import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RecentPage from '@/app/recent/page'
import { ThemeProvider } from '@/components/ThemeProvider'
import type { Listing } from '@/types/listing'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}))

let mockListings: Listing[] = []
const fetchListingsMock = vi.fn(async () => {})
const deleteListingMock = vi.fn(async () => true)

vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: mockListings,
    loading: false,
    error: null,
    fetchListings: fetchListingsMock,
    updateListing: vi.fn(),
    deleteListing: deleteListingMock,
    trashCount: 3,
  }),
}))

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: overrides.id ?? 'id',
    centris_link: null,
    broker_link: null,
    location: 'Laval',
    full_address: null,
    mls_number: null,
    property_type: null,
    price: 400000,
    taxes_yearly: null,
    common_fees_yearly: null,
    bedrooms: '2',
    liveable_area_sqft: 800,
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
    created_at: '2026-04-21T00:00:00Z',
    updated_at: '2026-04-21T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

describe('/recent page', () => {
  beforeEach(() => {
    pushMock.mockReset()
    fetchListingsMock.mockReset()
    fetchListingsMock.mockResolvedValue(undefined)
    deleteListingMock.mockReset()
    deleteListingMock.mockResolvedValue(true)
    mockListings = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the search bar and the empty-database state when there are no listings', () => {
    mockListings = []
    render(<RecentPage />, { wrapper: ThemeProvider })
    expect(screen.getByLabelText(/search listings/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/paste a centris url/i)).toBeNull()
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument()
  })

  it('filters cards by the search query across address and notes', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: '123 rue Main', notes: null }),
      makeListing({ id: 'b', full_address: '456 boulevard Cartier', notes: null }),
      makeListing({ id: 'c', full_address: '789 avenue Park', notes: 'near cartier park' }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.change(screen.getByLabelText(/search listings/i), { target: { value: 'cartier' } })
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
    expect(screen.getByText('456 boulevard Cartier')).toBeInTheDocument()
    expect(screen.getByText('789 avenue Park')).toBeInTheDocument()
  })

  it('restores the full list when the clear-search button is tapped', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: '123 rue Main' }),
      makeListing({ id: 'b', full_address: '456 boulevard Cartier' }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    const input = screen.getByLabelText(/search listings/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'cartier' } })
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(input.value).toBe('')
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
  })

  it('renders every listing, newest first', () => {
    mockListings = Array.from({ length: 12 }, (_, i) =>
      makeListing({ id: `x-${i}`, location: `City-${i}`, created_at: new Date(2026, 3, 21, i).toISOString() })
    )
    render(<RecentPage />, { wrapper: ThemeProvider })
    const cards = screen.getAllByTestId('listing-card-body')
    expect(cards.length).toBe(12)
    // Newest (City-11, created at hour 11) must be first.
    expect(cards[0]).toHaveTextContent('City-11')
    expect(cards[11]).toHaveTextContent('City-0')
  })

  it('trash link shows trashCount badge and targets /trash', () => {
    render(<RecentPage />, { wrapper: ThemeProvider })
    const trash = screen.getByRole('link', { name: /trash/i }) as HTMLAnchorElement
    expect(trash.getAttribute('href')).toBe('/trash')
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('surfaces error if card delete fails', async () => {
    mockListings = [makeListing({ id: 'card-1' })]
    deleteListingMock.mockResolvedValue(false)
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    await waitFor(() => expect(deleteListingMock).toHaveBeenCalledWith('card-1'))
    await waitFor(() => expect(screen.getByText(/couldn't delete/i)).toBeInTheDocument())
    confirmSpy.mockRestore()
  })

  it('shows only favorites when the star toggle is on, and all listings when off', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: 'Fav place', favorite: true }),
      makeListing({ id: 'b', full_address: 'Other place', favorite: false }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /show favorites only/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    expect(screen.getByText('Fav place')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show all listings/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
  })

  it('applies the search query and the favorites toggle together', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: '123 rue Cartier', favorite: true }),
      makeListing({ id: 'b', full_address: '456 rue Cartier', favorite: false }),
      makeListing({ id: 'c', full_address: '789 rue Main', favorite: true }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.change(screen.getByLabelText(/search listings/i), { target: { value: 'cartier' } })
    fireEvent.click(screen.getByRole('button', { name: /show favorites only/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    expect(screen.getByText('123 rue Cartier')).toBeInTheDocument()
  })

  it('shows the no-match state and its Clear button resets both filters', () => {
    mockListings = [makeListing({ id: 'a', full_address: '123 rue Main' })]
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.change(screen.getByLabelText(/search listings/i), { target: { value: 'zzzz' } })
    expect(screen.getByText(/no listings match/i)).toBeInTheDocument()
    expect(screen.queryByText(/no listings yet/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    expect((screen.getByLabelText(/search listings/i) as HTMLInputElement).value).toBe('')
  })

  it('shows the empty-database state, not the no-match state, when nothing is saved', () => {
    mockListings = []
    render(<RecentPage />, { wrapper: ThemeProvider })
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/no listings match/i)).toBeNull()
  })
})
