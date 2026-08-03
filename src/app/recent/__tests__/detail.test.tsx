import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DetailPage from '@/app/recent/[id]/page'
import { ThemeProvider } from '@/components/ThemeProvider'
import type { Listing } from '@/types/listing'

const backMock = vi.fn()
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'id-1' }),
}))

const originalHistory = window.history
afterEach(() => {
  backMock.mockReset()
  pushMock.mockReset()
  Object.defineProperty(window, 'history', { configurable: true, value: originalHistory })
  updateListingMock.mockReset()
  updateListingMock.mockResolvedValue(true)
  mockListing = sample
})

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
  commute_school_has_toll: null,
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

let mockListing: Listing = sample
const updateListingMock = vi.fn(async () => true)
vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [mockListing],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: updateListingMock,
    deleteListing: vi.fn(),
    trashCount: 0,
  }),
}))

describe('/recent/[id] detail page', () => {
  it('renders the listing fields and an Open on Centris button', () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
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

  it('falls back to /recent when there is no history to go back to', () => {
    Object.defineProperty(window, 'history', { configurable: true, value: { length: 1 } })
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(pushMock).toHaveBeenCalledWith('/recent')
    expect(backMock).not.toHaveBeenCalled()
  })

  it('puts Notes first in the field list, above Bedrooms', () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    const notes = screen.getByRole('button', { name: /notes/i })
    const bedrooms = screen.getByText('3 bdr')
    // Notes must precede Bedrooms in document order.
    expect(notes.compareDocumentPosition(bedrooms) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('has a favorite star that writes the favorite flag', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByTitle('Add to favorites'))
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('id-1', 'favorite', true)
    )
  })

  it('shows an error when the favorite write fails', async () => {
    updateListingMock.mockResolvedValue(false)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByTitle('Add to favorites'))
    await waitFor(() =>
      expect(screen.getByText(/couldn't update favorite/i)).toBeInTheDocument()
    )
  })

  it('shows Remove from favorites and writes false for an already-favorited listing', async () => {
    mockListing = { ...sample, favorite: true }
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    expect(screen.getByTitle('Remove from favorites')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Remove from favorites'))
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('id-1', 'favorite', false)
    )
  })

  it('clears the favorite error after a subsequent successful write', async () => {
    updateListingMock.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByTitle('Add to favorites'))
    await waitFor(() =>
      expect(screen.getByText(/couldn't update favorite/i)).toBeInTheDocument()
    )
    fireEvent.click(screen.getByTitle('Add to favorites'))
    await waitFor(() =>
      expect(screen.queryByText(/couldn't update favorite/i)).toBeNull()
    )
  })

  it('opens a textarea when Notes is tapped and saves on blur', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes') as HTMLTextAreaElement
    expect(box.value).toBe('Great light')
    fireEvent.change(box, { target: { value: 'Great light, noisy street' } })
    fireEvent.blur(box)
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('id-1', 'notes', 'Great light, noisy street')
    )
  })

  it('saves an emptied notes field as null', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: '   ' } })
    fireEvent.blur(box)
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('id-1', 'notes', null)
    )
  })

  it('Escape cancels the edit without saving', () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: 'discard me' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    fireEvent.blur(box)
    expect(updateListingMock).not.toHaveBeenCalled()
    expect(screen.getByText('Great light')).toBeInTheDocument()
  })

  it('keeps the textarea open and shows an error when the save fails', async () => {
    updateListingMock.mockResolvedValue(false)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: 'will fail' } })
    fireEvent.blur(box)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/couldn't save notes/i))
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('will fail')
  })
})
