import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RecentPage from '@/app/recent/page'
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

  it('renders the paste card and empty state when there are no listings', () => {
    mockListings = []
    render(<RecentPage />)
    expect(screen.getByPlaceholderText(/paste a centris url/i)).toBeInTheDocument()
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument()
  })

  it('renders at most 10 listing cards, newest first', () => {
    mockListings = Array.from({ length: 12 }, (_, i) =>
      makeListing({ id: `x-${i}`, location: `City-${i}`, created_at: new Date(2026, 3, 21, i).toISOString() })
    )
    render(<RecentPage />)
    const cards = screen.getAllByTestId('listing-card-body')
    expect(cards.length).toBe(10)
  })

  it('POSTs to /api/scrape-centris on Add, clears input on success', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: makeListing({ id: 'new-1' }) }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    const input = screen.getByPlaceholderText(/paste a centris url/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://centris.ca/new' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ url: 'https://centris.ca/new' })
    await waitFor(() => expect(screen.getByText(/added/i)).toBeInTheDocument())
    await waitFor(() => expect(fetchListingsMock).toHaveBeenCalled())
    expect(input.value).toBe('')
  })

  it('shows amber Already saved inline feedback on 409', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ listingId: 'x', error: 'Duplicate' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    fireEvent.change(screen.getByPlaceholderText(/paste a centris url/i), { target: { value: 'https://centris.ca/d' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/already saved/i)).toBeInTheDocument())
  })

  it('shows red error message on 500', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Boom' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    fireEvent.change(screen.getByPlaceholderText(/paste a centris url/i), { target: { value: 'https://centris.ca/bad' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/boom/i)).toBeInTheDocument())
  })

  it('trash link shows trashCount badge and targets /trash', () => {
    render(<RecentPage />)
    const trash = screen.getByRole('link', { name: /trash/i }) as HTMLAnchorElement
    expect(trash.getAttribute('href')).toBe('/trash')
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('clears the success banner when the user edits the URL input', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: makeListing({ id: 'new' }) }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    const input = screen.getByPlaceholderText(/paste a centris/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://www.centris.ca/x' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/added/i)).toBeInTheDocument())
    fireEvent.change(input, { target: { value: 'https://www.centris.ca/y' } })
    expect(screen.queryByText(/added/i)).not.toBeInTheDocument()
  })

  it('shows a server error message when the response is not JSON', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token <') },
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    fireEvent.change(screen.getByPlaceholderText(/paste a centris/i), { target: { value: 'https://www.centris.ca/x' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/server error \(502\)/i)).toBeInTheDocument())
  })
})
