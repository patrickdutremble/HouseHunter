import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { checkListingStatus } from '../status-check'

const ACTIVE_HTML = `
<!doctype html><html><body>
  <h1>Condo for sale</h1>
  <h2>123 rue Example, Laval</h2>
  <div class="price"><span class="text-nowrap">$499,000</span></div>
</body></html>
`

const UNAVAILABLE_BANNER_HTML = `
<!doctype html><html><body>
  <div class="alert">This property is no longer available. Here are similar listings.</div>
</body></html>
`

interface FakeResponse {
  url: string
  status: number
  ok: boolean
  text: () => Promise<string>
}

function fakeRes(opts: { url?: string; status?: number; body?: string }): FakeResponse {
  const status = opts.status ?? 200
  return {
    url: opts.url ?? 'https://www.centris.ca/en/condo/1',
    status,
    ok: status >= 200 && status < 300,
    text: async () => opts.body ?? '',
  }
}

function stubFetch(res: FakeResponse | (() => Promise<FakeResponse>)) {
  const impl = typeof res === 'function' ? res : async () => res
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('checkListingStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns unavailable when final URL contains listingnotfound=', async () => {
    stubFetch(fakeRes({
      url: 'https://www.centris.ca/en/search?listingnotfound=24767029',
      status: 200,
      body: '<html></html>',
    }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/24767029')
    expect(result).toEqual({ status: 'unavailable' })
  })

  it('returns unavailable when HTML contains "no longer available" (case-insensitive)', async () => {
    stubFetch(fakeRes({ status: 200, body: UNAVAILABLE_BANNER_HTML }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/1')
    expect(result).toEqual({ status: 'unavailable' })
  })

  it('returns unavailable on 404', async () => {
    stubFetch(fakeRes({ status: 404, body: 'Not Found' }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/1')
    expect(result).toEqual({ status: 'unavailable' })
  })

  it('returns active + price for a live listing', async () => {
    stubFetch(fakeRes({ status: 200, body: ACTIVE_HTML }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/1')
    expect(result).toEqual({ status: 'active', price: 499000 })
  })

  it('throws on non-404 non-2xx response', async () => {
    stubFetch(fakeRes({ status: 503, body: 'Server error' }))
    await expect(checkListingStatus('https://www.centris.ca/en/condo/1')).rejects.toThrow()
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    await expect(checkListingStatus('https://www.centris.ca/en/condo/1')).rejects.toThrow()
  })
})
