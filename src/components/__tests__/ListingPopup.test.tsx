import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ListingPopup } from '../ListingPopup'
import type { Listing } from '@/types/listing'

function make(partial: Partial<Listing> = {}): Listing {
  return {
    id: 'abc',
    centris_link: null,
    broker_link: null,
    location: 'Mascouche',
    full_address: '123 Rue Test, Mascouche',
    mls_number: null,
    property_type: 'Maison',
    price: 489000,
    taxes_yearly: null,
    common_fees_yearly: null,
    bedrooms: '3',
    liveable_area_sqft: null,
    price_per_sqft: null,
    parking: null,
    year_built: null,
    hydro_yearly: null,
    downpayment: null,
    monthly_mortgage: null,
    total_monthly_cost: null,
    commute_school_car: '15 min',
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
    image_url: 'https://example.com/house.jpg',
    latitude: 45.7,
    longitude: -73.6,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    criteria: null,
    ...partial,
  }
}

describe('ListingPopup', () => {
  it('renders price, address, bedrooms, and school commute', () => {
    render(<ListingPopup listing={make()} onSelect={() => {}} />)
    expect(screen.getByText('$489k')).toBeInTheDocument()
    expect(screen.getByText('123 Rue Test, Mascouche')).toBeInTheDocument()
    expect(screen.getByText(/3 bed/i)).toBeInTheDocument()
    expect(screen.getByText(/15 min/i)).toBeInTheDocument()
  })

  it('renders the thumbnail image when image_url is set', () => {
    render(<ListingPopup listing={make()} onSelect={() => {}} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(decodeURIComponent(img.src)).toContain('https://example.com/house.jpg')
  })

  it('calls onSelect with the listing id when "See full details" is clicked', () => {
    const onSelect = vi.fn()
    render(<ListingPopup listing={make({ id: 'xyz' })} onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /see full details/i }))
    expect(onSelect).toHaveBeenCalledWith('xyz')
  })
})
