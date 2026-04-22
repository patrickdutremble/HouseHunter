import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterPanel } from '../FilterPanel'
import { EMPTY_FILTERS } from '@/lib/filters'

describe('FilterPanel', () => {
  it('renders all filter groups', () => {
    render(<FilterPanel propertyTypes={['Condo']} filters={EMPTY_FILTERS} onChange={() => {}} />)
    expect(screen.getByText(/^Property$/)).toBeInTheDocument()
    expect(screen.getByText(/^Price$/)).toBeInTheDocument()
    expect(screen.getByText(/^Beds$/)).toBeInTheDocument()
    expect(screen.getByText(/^Commute$/)).toBeInTheDocument()
    expect(screen.getByText(/^Costs$/)).toBeInTheDocument()
    expect(screen.getByText(/^Features$/)).toBeInTheDocument()
  })

  it('changing minBeds emits updated filters', () => {
    const onChange = vi.fn()
    render(<FilterPanel propertyTypes={[]} filters={EMPTY_FILTERS} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Min beds/i), { target: { value: '3' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minBeds: '3' }))
  })

  it('enabling the school-commute checkbox reveals the slider', () => {
    const onChange = vi.fn()
    render(<FilterPanel propertyTypes={[]} filters={EMPTY_FILTERS} onChange={onChange} />)
    expect(screen.queryByLabelText(/Max school commute/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Limit school commute/i))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxCommuteSchool: '60' }))
  })

  it('disabling the school-commute checkbox clears its value', () => {
    const onChange = vi.fn()
    render(<FilterPanel
      propertyTypes={[]}
      filters={{ ...EMPTY_FILTERS, maxCommuteSchool: '30' }}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByLabelText(/Limit school commute/i))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxCommuteSchool: '' }))
  })

  it('hasGarage toggle flips the flag', () => {
    const onChange = vi.fn()
    render(<FilterPanel propertyTypes={[]} filters={EMPTY_FILTERS} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText(/At least 1 garage/i))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hasGarage: true }))
  })

  it('Clear all resets to EMPTY_FILTERS', () => {
    const onChange = vi.fn()
    render(<FilterPanel
      propertyTypes={[]}
      filters={{ ...EMPTY_FILTERS, minBeds: '3', hasGarage: true }}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }))
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_FILTERS)
  })
})
