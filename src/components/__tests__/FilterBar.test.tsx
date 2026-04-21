import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '../FilterBar'

describe('FilterBar flag status control', () => {
  it('renders three flag-status options as a radio group', () => {
    render(<FilterBar propertyTypes={[]} onFilterChange={() => {}} />)
    expect(screen.getByRole('radiogroup', { name: /Flag status/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /^All$/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Flagged only/ })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Hide flagged/ })).toBeInTheDocument()
  })

  it('defaults to flagStatus="all"', () => {
    render(<FilterBar propertyTypes={[]} onFilterChange={() => {}} />)
    expect(screen.getByRole('radio', { name: /^All$/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /Flagged only/ })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: /Hide flagged/ })).toHaveAttribute('aria-checked', 'false')
  })

  it('calls onFilterChange with flagStatus="only" when Flagged only is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar propertyTypes={[]} onFilterChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Flagged only/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flagStatus: 'only' }))
  })

  it('calls onFilterChange with flagStatus="hide" when Hide flagged is clicked', () => {
    const onChange = vi.fn()
    render(<FilterBar propertyTypes={[]} onFilterChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Hide flagged/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flagStatus: 'hide' }))
  })

  it('Clear button resets flagStatus to "all"', () => {
    const onChange = vi.fn()
    render(<FilterBar propertyTypes={[]} onFilterChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    fireEvent.click(screen.getByRole('radio', { name: /Flagged only/ }))
    fireEvent.click(screen.getByRole('button', { name: /^Clear$/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flagStatus: 'all' }))
  })
})
