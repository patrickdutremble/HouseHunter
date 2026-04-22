import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SharePage from '@/app/share/page'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}))

const deleteListingMock = vi.fn(async () => true)
vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: deleteListingMock,
    trashCount: 0,
  }),
}))

let mockSearchParams = new URLSearchParams()

function setParams(qs: string) {
  mockSearchParams = new URLSearchParams(qs)
}

describe('/share page', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    deleteListingMock.mockReset()
    deleteListingMock.mockResolvedValue(true)
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('redirects to /recent when no url query param is present', () => {
    setParams('')
    render(<SharePage />)
    expect(replaceMock).toHaveBeenCalledWith('/recent')
  })

  it('posts to /api/scrape-centris and renders success card on 200', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fnew')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: { id: 'new-1', location: 'Laval', price: 500000, image_url: null, full_address: null, bedrooms: '2', liveable_area_sqft: 800, commute_school_car: null, commute_pvm_transit: null } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/scrape-centris')
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://centris.ca/new' })
    await waitFor(() => expect(screen.getByText(/added/i)).toBeInTheDocument())
    expect(screen.getByText(/Laval/)).toBeInTheDocument()
  })

  it('renders duplicate card on 409', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fdup')
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ listingId: 'dup-1', error: 'Duplicate' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(screen.getByText(/already saved/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })

  it('renders error card on 500', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fbad')
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Boom' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(screen.getByText(/couldn't read/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paste manually/i })).toBeInTheDocument()
  })

  it('falls back to text param if url is missing', async () => {
    setParams('text=https%3A%2F%2Fcentris.ca%2Ffrom-text')
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ listing: { id: 'x', price: 1, location: 'A', image_url: null, full_address: null, bedrooms: null, liveable_area_sqft: null, commute_school_car: null, commute_pvm_transit: null } }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://centris.ca/from-text' })
  })

  it('calls deleteListing when Undo is tapped, then redirects to /recent', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fnew')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: { id: 'new-1', price: 1, location: 'A', image_url: null, full_address: null, bedrooms: null, liveable_area_sqft: null, commute_school_car: null, commute_pvm_transit: null } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    const undo = await screen.findByRole('button', { name: /undo/i })
    fireEvent.click(undo)
    await waitFor(() => expect(deleteListingMock).toHaveBeenCalledWith('new-1'))
  })

  it('shows error state if undo fails', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fnew')
    deleteListingMock.mockResolvedValue(false)
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: { id: 'new-1', price: 1, location: 'A', image_url: null, full_address: null, bedrooms: null, liveable_area_sqft: null, commute_school_car: null, commute_pvm_transit: null } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    const undo = await screen.findByRole('button', { name: /undo/i })
    fireEvent.click(undo)
    await waitFor(() => expect(screen.getByText(/couldn't undo/i)).toBeInTheDocument())
  })
})
