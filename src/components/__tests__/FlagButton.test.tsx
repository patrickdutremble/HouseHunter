import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FlagButton } from '../FlagButton'

describe('FlagButton', () => {
  it('shows "Flag for deletion" title when unflagged', () => {
    render(<FlagButton value={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Flag for deletion')
  })

  it('shows "Unflag" title when flagged', () => {
    render(<FlagButton value={true} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Unflag')
  })

  it('sets aria-pressed to reflect value', () => {
    const { rerender } = render(<FlagButton value={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    rerender(<FlagButton value={true} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<FlagButton value={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('applies red color classes when flagged', () => {
    render(<FlagButton value={true} onToggle={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/text-red-/)
  })
})
