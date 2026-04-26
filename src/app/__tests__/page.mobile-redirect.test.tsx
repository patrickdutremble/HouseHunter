import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    trashCount: 0,
  }),
}))

import HomePage from '@/app/page'
import { ThemeProvider } from '@/components/ThemeProvider'

function mockMatchMedia(narrow: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('/ mobile redirect', () => {
  beforeEach(() => {
    replaceMock.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to /recent when viewport is below 768px', () => {
    mockMatchMedia(true)
    render(<HomePage />, { wrapper: ThemeProvider })
    expect(replaceMock).toHaveBeenCalledWith('/recent')
  })

  it('does not redirect when viewport is >= 768px', () => {
    mockMatchMedia(false)
    render(<HomePage />, { wrapper: ThemeProvider })
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('renders nothing on narrow viewports (no desktop flash)', () => {
    mockMatchMedia(true)
    const { container } = render(<HomePage />, { wrapper: ThemeProvider })
    expect(container.querySelector('input[type="url"]')).toBeNull()
  })
})
