import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../ThemeProvider'

function Probe() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolvedTheme}</span>
      <button data-testid="set-dark" onClick={() => setTheme('dark')}>dark</button>
      <button data-testid="set-light" onClick={() => setTheme('light')}>light</button>
      <button data-testid="set-system" onClick={() => setTheme('system')}>system</button>
    </div>
  )
}

function setMatchMedia(matches: boolean) {
  const listeners: ((e: { matches: boolean }) => void)[] = []
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.push(l),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  return {
    fireChange(newMatches: boolean) {
      listeners.forEach(l => l({ matches: newMatches }))
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('ThemeProvider', () => {
  it('defaults to system when no localStorage value', () => {
    setMatchMedia(false)
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(getByTestId('theme').textContent).toBe('system')
    expect(getByTestId('resolved').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('reads stored "dark" value from localStorage', () => {
    localStorage.setItem('theme', 'dark')
    setMatchMedia(false)
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(getByTestId('theme').textContent).toBe('dark')
    expect(getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('setTheme("dark") writes localStorage and sets the dark class', () => {
    setMatchMedia(false)
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>)
    act(() => { getByTestId('set-dark').click() })
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(getByTestId('resolved').textContent).toBe('dark')
  })

  it('setTheme("system") removes localStorage entry and resolves via matchMedia', () => {
    localStorage.setItem('theme', 'dark')
    setMatchMedia(false)
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>)
    act(() => { getByTestId('set-system').click() })
    expect(localStorage.getItem('theme')).toBeNull()
    expect(getByTestId('resolved').textContent).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('matchMedia change in system mode toggles the dark class', () => {
    const mm = setMatchMedia(false)
    const { getByTestId } = render(<ThemeProvider><Probe /></ThemeProvider>)
    expect(getByTestId('resolved').textContent).toBe('light')
    act(() => { mm.fireChange(true) })
    expect(getByTestId('resolved').textContent).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
