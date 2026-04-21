import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableRow } from '../TableRow'
import type { Listing } from '@/types/listing'

const BASE: Listing = {
  id: '1',
  centris_link: 'https://x/1',
  broker_link: null,
  location: 'Laval',
  full_address: '123 rue Example, Laval',
  mls_number: null,
  property_type: 'Condo',
  price: 100000,
  taxes_yearly: null,
  common_fees_yearly: null,
  bedrooms: null,
  liveable_area_sqft: null,
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
  image_url: null,
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

function renderRow(listing: Listing, opts: { isFocused?: boolean; isSelected?: boolean } = {}) {
  return render(
    <table><tbody>
      <TableRow
        listing={listing}
        isSelected={opts.isSelected ?? false}
        isFocused={opts.isFocused ?? false}
        onSelect={() => {}}
        onUpdate={() => {}}
        isCompared={false}
        onToggleCompare={() => {}}
      />
    </tbody></table>,
  )
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

describe('TableRow', () => {
  it('renders no Unavailable pill when active', () => {
    renderRow(BASE)
    expect(screen.queryByTestId('unavailable-pill')).toBeNull()
  })

  it('renders Unavailable pill and applies opacity-50 when unavailable', () => {
    const { container } = renderRow({ ...BASE, status: 'unavailable' })
    expect(screen.getByTestId('unavailable-pill')).toBeTruthy()
    const tr = container.querySelector('tr')
    expect(tr?.className).toContain('opacity-50')
  })

  it('renders green price drop badge within 30d', () => {
    renderRow({
      ...BASE,
      price: 90000,
      previous_price: 100000,
      price_changed_at: new Date().toISOString(),
    })
    const badge = screen.getByTestId('price-change-badge')
    expect(badge.textContent).toContain('\u2193')
    expect(badge.textContent).toContain('$10k')
    expect(badge.className).toContain('text-green-700')
  })

  it('renders amber price rise badge within 30d', () => {
    renderRow({
      ...BASE,
      price: 110000,
      previous_price: 100000,
      price_changed_at: new Date().toISOString(),
    })
    const badge = screen.getByTestId('price-change-badge')
    expect(badge.textContent).toContain('\u2191')
    expect(badge.className).toContain('text-amber-700')
  })

  it('hides price-change badge after 30d', () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    renderRow({
      ...BASE,
      price: 90000,
      previous_price: 100000,
      price_changed_at: old,
    })
    expect(screen.queryByTestId('price-change-badge')).toBeNull()
  })

  it('applies a focus ring class when isFocused is true', () => {
    renderRow({ ...BASE, id: 'f1' }, { isFocused: true })
    const row = screen.getByRole('row')
    expect(row.className).toMatch(/ring-2/)
    expect(row.className).toMatch(/ring-blue-400/)
  })

  it('does not apply the focus ring when isFocused is false', () => {
    renderRow({ ...BASE, id: 'f2' }, { isFocused: false })
    const row = screen.getByRole('row')
    expect(row.className).not.toMatch(/ring-blue-400/)
  })
})
