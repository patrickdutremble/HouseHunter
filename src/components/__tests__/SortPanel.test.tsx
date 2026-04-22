import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SortPanel } from '../SortPanel'

describe('SortPanel', () => {
  it('shows "No sort" message when empty', () => {
    render(<SortPanel sort={[]} onChange={() => {}} />)
    expect(screen.getByText(/No sort/i)).toBeInTheDocument()
  })

  it('lists each active sort level in order', () => {
    render(<SortPanel
      sort={[
        { column: 'price', direction: 'asc' },
        { column: 'liveable_area_sqft', direction: 'desc' },
      ]}
      onChange={() => {}}
    />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Price')
    expect(items[1].textContent).toContain('Area (sqft)')
  })

  it('flips direction when ↑/↓ button is clicked', () => {
    const onChange = vi.fn()
    render(<SortPanel sort={[{ column: 'price', direction: 'asc' }]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Flip direction of Price/i }))
    expect(onChange).toHaveBeenCalledWith([{ column: 'price', direction: 'desc' }])
  })

  it('removes a level when × is clicked', () => {
    const onChange = vi.fn()
    render(<SortPanel
      sort={[
        { column: 'price', direction: 'asc' },
        { column: 'liveable_area_sqft', direction: 'asc' },
      ]}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Remove Price/i }))
    expect(onChange).toHaveBeenCalledWith([{ column: 'liveable_area_sqft', direction: 'asc' }])
  })

  it('moves a level up when ↑ reorder is clicked', () => {
    const onChange = vi.fn()
    render(<SortPanel
      sort={[
        { column: 'price', direction: 'asc' },
        { column: 'liveable_area_sqft', direction: 'asc' },
      ]}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Move Area \(sqft\) up/i }))
    expect(onChange).toHaveBeenCalledWith([
      { column: 'liveable_area_sqft', direction: 'asc' },
      { column: 'price', direction: 'asc' },
    ])
  })

  it('Add-sort dropdown appends a new level', () => {
    const onChange = vi.fn()
    render(<SortPanel sort={[]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Add sort/i), { target: { value: 'price' } })
    expect(onChange).toHaveBeenCalledWith([{ column: 'price', direction: 'asc' }])
  })

  it('Add-sort dropdown excludes columns already sorted', () => {
    render(<SortPanel
      sort={[{ column: 'price', direction: 'asc' }]}
      onChange={() => {}}
    />)
    const select = screen.getByLabelText(/Add sort/i) as HTMLSelectElement
    const options = Array.from(select.options).map(o => o.value)
    expect(options).not.toContain('price')
  })
})
