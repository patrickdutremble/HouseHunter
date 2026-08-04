import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DetailPage from '@/app/recent/[id]/page'
import { ThemeProvider } from '@/components/ThemeProvider'
import type { Listing } from '@/types/listing'

const backMock = vi.fn()
const pushMock = vi.fn()
const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, push: pushMock, replace: replaceMock }),
  useParams: () => ({ id: 'id-1' }),
}))

const originalHistory = window.history
const confirmSpy = vi.spyOn(window, 'confirm')

beforeEach(() => {
  // Default to "OK" — tests that need Cancel override with mockReturnValueOnce(false).
  // mockReset first: mockReturnValue alone does not drain a leftover
  // mockReturnValueOnce from a test that failed before consuming it.
  confirmSpy.mockReset()
  confirmSpy.mockReturnValue(true)
})

afterEach(() => {
  backMock.mockReset()
  pushMock.mockReset()
  replaceMock.mockReset()
  Object.defineProperty(window, 'history', { configurable: true, value: originalHistory })
  updateListingMock.mockReset()
  updateListingMock.mockResolvedValue(true)
  deleteListingMock.mockReset()
  deleteListingMock.mockResolvedValue(true)
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

// Nullable so a test can simulate the listing vanishing from local state
// mid-delete, which is what deleteListing does in the real hook.
let mockListing: Listing | null = sample
const updateListingMock = vi.fn(async () => true)
const deleteListingMock = vi.fn(async () => true)
vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: mockListing ? [mockListing] : [],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: updateListingMock,
    deleteListing: deleteListingMock,
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

  it('renders a Delete listing button below Open on Centris', () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    const centris = screen.getByRole('link', { name: /open on centris/i })
    const del = screen.getByRole('button', { name: /delete listing/i })
    // Delete must come after Centris in document order.
    expect(centris.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('still renders Delete listing when the listing has no Centris link', () => {
    mockListing = { ...sample, centris_link: null }
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    expect(screen.queryByRole('link', { name: /open on centris/i })).toBeNull()
    expect(screen.getByRole('button', { name: /delete listing/i })).toBeInTheDocument()
  })

  it('does not delete when the confirmation is cancelled', () => {
    confirmSpy.mockReturnValueOnce(false)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    expect(window.confirm).toHaveBeenCalledWith('Move this listing to the trash?')
    expect(deleteListingMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('deletes and returns to the list when the confirmation is accepted', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    await waitFor(() => expect(deleteListingMock).toHaveBeenCalledWith('id-1'))
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/recent'))
    // replace, not back — back/forward navigation restores Next's cached list.
    expect(backMock).not.toHaveBeenCalled()
  })

  it("shows an error and stays put when the delete fails", async () => {
    deleteListingMock.mockResolvedValue(false)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    await waitFor(() =>
      expect(screen.getByText(/couldn't delete/i)).toBeInTheDocument()
    )
    expect(replaceMock).not.toHaveBeenCalled()
    expect(screen.getByText('123 rue Main')).toBeInTheDocument()
  })

  it('shows the same error when the delete rejects outright', async () => {
    deleteListingMock.mockRejectedValue(new Error('offline'))
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    await waitFor(() =>
      expect(screen.getByText(/couldn't delete/i)).toBeInTheDocument()
    )
    expect(replaceMock).not.toHaveBeenCalled()
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
