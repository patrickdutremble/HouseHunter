import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Prevent supabase module-init crash (createClient requires env vars at import time)
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { fetchDriveRoute } from '../commute'

describe('fetchDriveRoute', () => {
  const origFetch = global.fetch

  beforeEach(() => {
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key')
  })

  afterEach(() => {
    global.fetch = origFetch
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('returns minutes and hasToll=true when tollInfo is present', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [
          {
            duration: '1920s',
            travelAdvisory: {
              tollInfo: {
                estimatedPrice: [{ currencyCode: 'CAD', units: '2', nanos: 500_000_000 }],
              },
            },
          },
        ],
      }),
    }) as unknown as typeof fetch

    const result = await fetchDriveRoute('45.5,-73.6', 'Secondary School Leblanc, Terrebonne, QC', 'test-key')

    expect(result).toEqual({ minutes: 32, hasToll: true })
  })

  it('returns minutes and hasToll=false when travelAdvisory.tollInfo is absent', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        routes: [{ duration: '1200s', travelAdvisory: {} }],
      }),
    }) as unknown as typeof fetch

    const result = await fetchDriveRoute('45.5,-73.6', 'dest', 'test-key')

    expect(result).toEqual({ minutes: 20, hasToll: false })
  })

  it('returns null when the API returns an error response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { status: 'PERMISSION_DENIED' } }),
    }) as unknown as typeof fetch

    const result = await fetchDriveRoute('45.5,-73.6', 'dest', 'test-key')

    expect(result).toBeNull()
  })
})
