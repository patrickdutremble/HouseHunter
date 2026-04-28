import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import type { Listing } from '@/types/listing'

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === 'ids' ? 'id-a,id-b' : null),
  }),
}))

const { updateSpy } = vi.hoisted(() => ({ updateSpy: vi.fn() }))

function makeListing(overrides: Partial<Listing>): Listing {
  return {
    id: 'default',
    centris_link: null,
    broker_link: null,
    location: null,
    full_address: null,
    mls_number: null,
    property_type: null,
    price: null,
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
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

const seedListings: Listing[] = [
  makeListing({ id: 'id-a', location: 'A', bedrooms: '3' }),
  makeListing({ id: 'id-b', location: 'B' }),
]

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        in: () => ({
          is: () =>
            Promise.resolve({
              data: seedListings,
              error: null,
            }),
        }),
      }),
      update: (payload: { criteria: Record<string, boolean> }) => {
        updateSpy(payload)
        return {
          eq: () => Promise.resolve({ data: null, error: null }),
        }
      },
    }),
  }),
}))

import ComparePage from '../page'
import { ThemeProvider } from '@/components/ThemeProvider'

beforeEach(() => {
  updateSpy.mockClear()
})

describe('ComparePage — criteria toggles', () => {
  it('persists toggles on the editable criterion to Supabase', async () => {
    render(<ThemeProvider><ComparePage /></ThemeProvider>)

    const noAbove = await screen.findAllByRole('checkbox', {
      name: 'No above neighbors',
    })

    fireEvent.click(noAbove[0])

    await waitFor(() => expect(updateSpy).toHaveBeenCalledTimes(1))
    expect(updateSpy).toHaveBeenCalledWith({
      criteria: { no_above_neighbors: true },
    })
  })

  it('does not persist or toggle clicks on derived (disabled) criteria', async () => {
    render(<ThemeProvider><ComparePage /></ThemeProvider>)

    const threeBed = await screen.findAllByRole('checkbox', { name: '3 bedrooms' })
    expect(threeBed[0]).toBeDisabled()
    // listing id-a has bedrooms '3' so its checkbox is checked; id-b is unchecked
    expect(threeBed[0]).toBeChecked()
    expect(threeBed[1]).not.toBeChecked()

    fireEvent.click(threeBed[0])
    fireEvent.click(threeBed[1])

    expect(updateSpy).not.toHaveBeenCalled()
  })
})
