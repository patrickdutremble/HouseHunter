import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StarIcon } from '@/components/StarIcon'

describe('StarIcon', () => {
  it('renders a filled star when filled is true', () => {
    const { container } = render(<StarIcon filled size={22} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg).toHaveAttribute('fill', 'currentColor')
    expect(svg).toHaveAttribute('width', '22')
    expect(svg).toHaveAttribute('height', '22')
  })

  it('renders an outline star when filled is false', () => {
    const { container } = render(<StarIcon filled={false} size={18} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('fill', 'none')
    expect(svg).toHaveAttribute('stroke', 'currentColor')
    expect(svg).toHaveAttribute('width', '18')
  })

  it('is hidden from assistive technology', () => {
    const { container } = render(<StarIcon filled={false} size={18} />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
