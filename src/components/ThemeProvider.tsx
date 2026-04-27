'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'theme'

function readStored(): Theme {
  if (typeof window === 'undefined') return 'system'
  const v = window.localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

function applyClass(resolved: ResolvedTheme) {
  const root = document.documentElement
  root.classList.add('theme-switching')
  if (resolved === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  // Force a reflow so the class change takes effect before transitions resume.
  void root.offsetHeight
  // setTimeout (not rAF) so cleanup also runs in hidden tabs.
  setTimeout(() => {
    root.classList.remove('theme-switching')
  }, 0)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStored())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(readStored()))

  useEffect(() => {
    const r = resolve(theme)
    setResolvedTheme(r)
    applyClass(r)
  }, [theme])

  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent | { matches: boolean }) => {
      const r: ResolvedTheme = e.matches ? 'dark' : 'light'
      setResolvedTheme(r)
      applyClass(r)
    }
    mql.addEventListener('change', handler as (e: MediaQueryListEvent) => void)
    return () => mql.removeEventListener('change', handler as (e: MediaQueryListEvent) => void)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    if (next === 'system') {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
    setThemeState(next)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
