import { describe, it, expect } from 'vitest'
import { shouldGate } from '../middleware-paths'

describe('shouldGate', () => {
  describe('gates protected paths', () => {
    it('gates root', () => {
      expect(shouldGate('/')).toBe(true)
    })
    it('gates /recent', () => {
      expect(shouldGate('/recent')).toBe(true)
    })
    it('gates dynamic /recent/:id', () => {
      expect(shouldGate('/recent/abc-123')).toBe(true)
    })
    it('gates /add-listing', () => {
      expect(shouldGate('/add-listing')).toBe(true)
    })
    it('gates /compare', () => {
      expect(shouldGate('/compare')).toBe(true)
    })
    it('gates /trash', () => {
      expect(shouldGate('/trash')).toBe(true)
    })
    it('gates /share', () => {
      expect(shouldGate('/share')).toBe(true)
    })
    it('gates /api/scrape-centris', () => {
      expect(shouldGate('/api/scrape-centris')).toBe(true)
    })
    it('gates /api/commute', () => {
      expect(shouldGate('/api/commute')).toBe(true)
    })
    it('gates /api/refresh-statuses (manual button)', () => {
      expect(shouldGate('/api/refresh-statuses')).toBe(true)
    })
  })

  describe('lets through public/internal paths', () => {
    it('lets through /login', () => {
      expect(shouldGate('/login')).toBe(false)
    })
    it('lets through /auth/callback', () => {
      expect(shouldGate('/auth/callback')).toBe(false)
    })
    it('lets through cron route', () => {
      expect(shouldGate('/api/cron/refresh-statuses')).toBe(false)
    })
    it('lets through any /api/cron/* path', () => {
      expect(shouldGate('/api/cron/anything')).toBe(false)
    })
    it('lets through Next.js static internals', () => {
      expect(shouldGate('/_next/static/chunks/main.js')).toBe(false)
    })
    it('lets through Next.js image internals', () => {
      expect(shouldGate('/_next/image')).toBe(false)
    })
    it('lets through favicon', () => {
      expect(shouldGate('/favicon.ico')).toBe(false)
    })
    it('lets through PWA manifest', () => {
      expect(shouldGate('/manifest.json')).toBe(false)
    })
    it('lets through service worker', () => {
      expect(shouldGate('/sw.js')).toBe(false)
    })
    it('lets through icon files', () => {
      expect(shouldGate('/icon-192.png')).toBe(false)
      expect(shouldGate('/icon-512.png')).toBe(false)
      expect(shouldGate('/icon-maskable.png')).toBe(false)
    })
    it('lets through bookmarklet help page', () => {
      expect(shouldGate('/bookmarklet.html')).toBe(false)
    })
  })
})
