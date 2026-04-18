import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { DetailPanel } from '../DetailPanel'
import type { Listing } from '@/types/listing'

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'test-id',
    centris_link: null,
    broker_link: null,
    location: 'Test Location',
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
    commute_pvm_transit: null,
    notes: null,
    personal_rating: null,
    status: null,
    favorite: false,
    image_url: null,
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

describe('DetailPanel — Good-to-have criteria section', () => {
  it('renders the section header', () => {
    render(
      <DetailPanel
        listing={makeListing()}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByText(/Good-to-have criteria/i)).toBeInTheDocument()
  })

  it('renders all 5 criteria labels as checkboxes', () => {
    render(
      <DetailPanel
        listing={makeListing()}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByLabelText('No above neighbors')).toBeInTheDocument()
    expect(screen.getByLabelText('<20 min from school')).toBeInTheDocument()
    expect(screen.getByLabelText('<1 hour from PVM')).toBeInTheDocument()
    expect(screen.getByLabelText('3 bedrooms')).toBeInTheDocument()
    expect(screen.getByLabelText('At least 1 garage')).toBeInTheDocument()
  })

  it('shows checkboxes as checked based on the criteria object', () => {
    render(
      <DetailPanel
        listing={makeListing({ criteria: { no_above_neighbors: true } })}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByLabelText('No above neighbors')).toBeChecked()
    expect(screen.getByLabelText('3 bedrooms')).not.toBeChecked()
  })

  it('treats null criteria as all unchecked', () => {
    render(
      <DetailPanel
        listing={makeListing({ criteria: null })}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByLabelText('No above neighbors')).not.toBeChecked()
  })

  it('calls onUpdate with the merged criteria object when a checkbox is toggled on', () => {
    const onUpdate = vi.fn()
    render(
      <DetailPanel
        listing={makeListing({ criteria: { school_within_20min: true } })}
        onClose={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('No above neighbors'))
    expect(onUpdate).toHaveBeenCalledWith('test-id', 'criteria', {
      school_within_20min: true,
      no_above_neighbors: true,
    })
  })

  it('calls onUpdate with the criterion set to false when a checked box is toggled off', () => {
    const onUpdate = vi.fn()
    render(
      <DetailPanel
        listing={makeListing({ criteria: { no_above_neighbors: true } })}
        onClose={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('No above neighbors'))
    expect(onUpdate).toHaveBeenCalledWith('test-id', 'criteria', {
      no_above_neighbors: false,
    })
  })

  it('merges rapid consecutive clicks without losing prior updates', () => {
    const onUpdate = vi.fn()
    render(
      <DetailPanel
        listing={makeListing({ criteria: null })}
        onClose={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    // Two clicks in quick succession — listing prop does not change between them
    // (simulates the real app, where parent state update is async)
    fireEvent.click(screen.getByLabelText('No above neighbors'))
    fireEvent.click(screen.getByLabelText('3 bedrooms'))

    expect(onUpdate).toHaveBeenNthCalledWith(1, 'test-id', 'criteria', {
      no_above_neighbors: true,
    })
    expect(onUpdate).toHaveBeenNthCalledWith(2, 'test-id', 'criteria', {
      no_above_neighbors: true,
      three_bedrooms: true,
    })
  })

  it('resets pending state when switching to a different listing', () => {
    const onUpdate = vi.fn()
    const { rerender } = render(
      <DetailPanel
        listing={makeListing({ id: 'a', criteria: null })}
        onClose={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('No above neighbors'))
    // Switch to different listing whose criteria is empty
    rerender(
      <DetailPanel
        listing={makeListing({ id: 'b', criteria: null })}
        onClose={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('3 bedrooms'))
    // Second call should reflect listing 'b's fresh state, NOT merge with 'a's pending
    expect(onUpdate).toHaveBeenLastCalledWith('b', 'criteria', {
      three_bedrooms: true,
    })
  })
})
