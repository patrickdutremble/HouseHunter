import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Stub UserMenu globally so page tests don't need to wire up auth/router mocks
// just to render a page. Tests that specifically test UserMenu can re-mock it.
vi.mock('@/components/UserMenu', () => ({
  UserMenu: () => null,
}))

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}
