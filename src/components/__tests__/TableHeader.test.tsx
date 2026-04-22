import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableHeader } from '../TableHeader'

describe('TableHeader', () => {
  it('renders no arrow when column is unsorted', () => {
    render(
      <table><TableHeader sort={[]} onSort={() => {}} /></table>
    )
    const priceHeader = screen.getByText(/^Price$/)
    expect(priceHeader.textContent).toBe('Price')
  })

  it('renders rank and arrow for a sorted column', () => {
    render(
      <table>
        <TableHeader sort={[{ column: 'price', direction: 'asc' }]} onSort={() => {}} />
      </table>
    )
    const priceHeader = screen.getByText(/Price/)
    expect(priceHeader.textContent).toContain('1')
    expect(priceHeader.textContent).toContain('\u2191')
  })

  it('shows rank + direction per column across multiple sort levels', () => {
    render(
      <table>
        <TableHeader
          sort={[
            { column: 'price', direction: 'asc' },
            { column: 'liveable_area_sqft', direction: 'desc' },
          ]}
          onSort={() => {}}
        />
      </table>
    )
    const priceHeader = screen.getByText(/Price/)
    const areaHeader = screen.getByText(/Area \(sqft\)/)
    expect(priceHeader.textContent).toContain('1')
    expect(priceHeader.textContent).toContain('\u2191')
    expect(areaHeader.textContent).toContain('2')
    expect(areaHeader.textContent).toContain('\u2193')
  })

  it('calls onSort with shift=false on plain click', () => {
    const onSort = vi.fn()
    render(<table><TableHeader sort={[]} onSort={onSort} /></table>)
    fireEvent.click(screen.getByText(/^Price$/))
    expect(onSort).toHaveBeenLastCalledWith('price', false)
  })

  it('calls onSort with shift=true on shift-click', () => {
    const onSort = vi.fn()
    render(<table><TableHeader sort={[]} onSort={onSort} /></table>)
    fireEvent.click(screen.getByText(/^Price$/), { shiftKey: true })
    expect(onSort).toHaveBeenLastCalledWith('price', true)
  })
})
