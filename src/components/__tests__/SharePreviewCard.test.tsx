import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SharePreviewCard } from '@/components/SharePreviewCard'
import type { Listing } from '@/types/listing'

const baseListing: Listing = {
  id: 'abc-123',
  centris_link: 'https://centris.ca/abc',
  broker_link: null,
  location: 'Montréal',
  full_address: '123 Main St',
  mls_number: null,
  property_type: 'Condo',
  price: 450000,
  taxes_yearly: null,
  common_fees_yearly: null,
  bedrooms: '3',
  liveable_area_sqft: 900,
  price_per_sqft: null,
  parking: null,
  year_built: null,
  hydro_yearly: null,
  downpayment: null,
  monthly_mortgage: null,
  total_monthly_cost: null,
  commute_school_car: '18 min',
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
  image_url: 'https://example.com/h.jpg',
  latitude: null,
  longitude: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

describe('SharePreviewCard', () => {
  it('renders success state with Added badge and Undo button', () => {
    const onUndo = vi.fn()
    render(<SharePreviewCard variant="success" listing={baseListing} onUndo={onUndo} onDone={() => {}} />)
    expect(screen.getByText(/added/i)).toBeInTheDocument()
    expect(screen.getByText(/Montréal/)).toBeInTheDocument()
    expect(screen.getByText(/450,000|450000|\$450/)).toBeInTheDocument()
    const undo = screen.getByRole('button', { name: /undo/i })
    fireEvent.click(undo)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('renders duplicate state with Already saved badge and Done button, no Undo', () => {
    const onDone = vi.fn()
    render(<SharePreviewCard variant="duplicate" listing={baseListing} onUndo={() => {}} onDone={onDone} />)
    expect(screen.getByText(/already saved/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('renders error state with Try again and Paste manually buttons', () => {
    const onRetry = vi.fn()
    const onManual = vi.fn()
    render(
      <SharePreviewCard
        variant="error"
        url="https://centris.ca/broken"
        message="Couldn't read this listing"
        onRetry={onRetry}
        onManual={onManual}
      />
    )
    expect(screen.getByText(/couldn't read this listing/i)).toBeInTheDocument()
    expect(screen.getByText('https://centris.ca/broken')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /paste manually/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onManual).toHaveBeenCalledTimes(1)
  })

  it('renders loading skeleton when variant is loading', () => {
    const { container } = render(<SharePreviewCard variant="loading" />)
    expect(container.querySelector('[data-testid="share-skeleton"]')).not.toBeNull()
  })
})
