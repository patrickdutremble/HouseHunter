import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListingCard } from '@/components/ListingCard'
import type { Listing } from '@/types/listing'

const sample: Listing = {
  id: 'id-1',
  centris_link: 'https://centris.ca/x',
  broker_link: null,
  location: 'Montréal',
  full_address: '123 rue Main',
  mls_number: null,
  property_type: null,
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
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  updated_at: '2026-04-21T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

describe('ListingCard', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders address, price, bedrooms, sqft, commute, and relative timestamp', () => {
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('123 rue Main')).toBeInTheDocument()
    expect(screen.getByText(/500,000/)).toBeInTheDocument()
    expect(screen.getByText(/3 bdr/)).toBeInTheDocument()
    expect(screen.getByText(/950 sqft/)).toBeInTheDocument()
    expect(screen.getByText(/20 min/)).toBeInTheDocument()
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('renders image when image_url is set', () => {
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={() => {}} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(decodeURIComponent(img.src)).toContain('https://example.com/h.jpg')
  })

  it('renders placeholder when image_url is null', () => {
    const { container } = render(
      <ListingCard listing={{ ...sample, image_url: null }} onTap={() => {}} onDelete={() => {}} />
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('calls onTap when card body is clicked', () => {
    const onTap = vi.fn()
    render(<ListingCard listing={sample} onTap={onTap} onDelete={() => {}} />)
    fireEvent.click(screen.getByTestId('listing-card-body'))
    expect(onTap).toHaveBeenCalledWith('id-1')
  })

  it('opens the menu when three-dot is tapped, and delete triggers onDelete after confirm', () => {
    const onDelete = vi.fn()
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    const del = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(del)
    expect(window.confirm).toHaveBeenCalledWith('Move to trash?')
    expect(onDelete).toHaveBeenCalledWith('id-1')
  })

  it('does not call onDelete if user cancels the confirm', () => {
    ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)
    const onDelete = vi.fn()
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('menu has an Open on Centris link pointing at centris_link', () => {
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    const link = screen.getByRole('link', { name: /open on centris/i }) as HTMLAnchorElement
    expect(link.href).toBe('https://centris.ca/x')
    expect(link.target).toBe('_blank')
  })
})
