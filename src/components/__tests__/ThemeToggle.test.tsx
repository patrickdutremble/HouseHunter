import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { ThemeProvider } from '../ThemeProvider'
import { ThemeToggle } from '../ThemeToggle'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('ThemeToggle', () => {
  it('renders three buttons with correct aria-pressed reflecting current theme (default system)', () => {
    const { getByLabelText } = render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    expect(getByLabelText('Light theme').getAttribute('aria-pressed')).toBe('false')
    expect(getByLabelText('Dark theme').getAttribute('aria-pressed')).toBe('false')
    expect(getByLabelText('System theme').getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking Dark theme button sets theme to dark', () => {
    const { getByLabelText } = render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    fireEvent.click(getByLabelText('Dark theme'))
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(getByLabelText('Dark theme').getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('clicking Light theme button sets theme to light', () => {
    const { getByLabelText } = render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    fireEvent.click(getByLabelText('Light theme'))
    expect(localStorage.getItem('theme')).toBe('light')
    expect(getByLabelText('Light theme').getAttribute('aria-pressed')).toBe('true')
  })

  it('clicking System theme button removes the stored value', () => {
    localStorage.setItem('theme', 'dark')
    const { getByLabelText } = render(<ThemeProvider><ThemeToggle /></ThemeProvider>)
    fireEvent.click(getByLabelText('System theme'))
    expect(localStorage.getItem('theme')).toBeNull()
  })
})
