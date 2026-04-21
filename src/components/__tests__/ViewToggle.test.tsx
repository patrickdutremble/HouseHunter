import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ViewToggle } from '../ViewToggle'

describe('ViewToggle', () => {
  it('marks Table as active when current is "table"', () => {
    render(<ViewToggle current="table" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Table' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks Map as active when current is "map"', () => {
    render(<ViewToggle current="map" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange("map") when Map is clicked', () => {
    const onChange = vi.fn()
    render(<ViewToggle current="table" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Map' }))
    expect(onChange).toHaveBeenCalledWith('map')
  })

  it('calls onChange("table") when Table is clicked', () => {
    const onChange = vi.fn()
    render(<ViewToggle current="map" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(onChange).toHaveBeenCalledWith('table')
  })
})
