import { describe, expect, it, vi, beforeEach } from 'vitest'
import { refreshAllStatuses } from '../refresh-statuses'
import * as statusCheck from '../status-check'

type Row = {
  id: string
  centris_link: string | null
  price: number | null
  status: string
  deleted_at?: string | null
}

function makeSupabaseStub(rows: Row[]) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
  const client = {
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          is: async (_col: string, _val: unknown) => {
            const filtered = rows.filter(r => (r.deleted_at ?? null) === null)
            return { data: filtered, error: null }
          },
        }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ id, patch })
          return { error: null }
        },
      }),
    }),
  }
  return { client, updates }
}

describe('refreshAllStatuses', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('marks a listing unavailable and records status_checked_at', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockResolvedValue({ status: 'unavailable' })
    const { client, updates } = makeSupabaseStub([
      { id: 'a', centris_link: 'https://x/1', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 1, priceChanged: 0, errors: 0 })
    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('a')
    expect(updates[0].patch.status).toBe('unavailable')
    expect(updates[0].patch.status_checked_at).toBeTypeOf('string')
  })

  it('records a price drop with previous_price and price_changed_at', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockResolvedValue({ status: 'active', price: 90000 })
    const { client, updates } = makeSupabaseStub([
      { id: 'b', centris_link: 'https://x/2', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 0, priceChanged: 1, errors: 0 })
    expect(updates[0].patch).toMatchObject({
      price: 90000,
      previous_price: 100000,
    })
    expect(updates[0].patch.price_changed_at).toBeTypeOf('string')
    expect(updates[0].patch.status_checked_at).toBeTypeOf('string')
  })

  it('only updates status_checked_at when nothing changed', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockResolvedValue({ status: 'active', price: 100000 })
    const { client, updates } = makeSupabaseStub([
      { id: 'c', centris_link: 'https://x/3', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 0, priceChanged: 0, errors: 0 })
    expect(Object.keys(updates[0].patch).sort()).toEqual(['status_checked_at'])
  })

  it('counts errors and does not update the row when checkListingStatus throws', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockRejectedValue(new Error('boom'))
    const { client, updates } = makeSupabaseStub([
      { id: 'd', centris_link: 'https://x/4', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 0, priceChanged: 0, errors: 1 })
    expect(updates).toHaveLength(0)
  })

  it('skips listings with no centris_link', async () => {
    const spy = vi.spyOn(statusCheck, 'checkListingStatus')
    const { client, updates } = makeSupabaseStub([
      { id: 'e', centris_link: null, price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 0, unavailable: 0, priceChanged: 0, errors: 0 })
    expect(spy).not.toHaveBeenCalled()
    expect(updates).toHaveLength(0)
  })

  it('processes multiple listings', async () => {
    const spy = vi.spyOn(statusCheck, 'checkListingStatus')
    spy.mockImplementation(async (url) => {
      if (url.endsWith('/1')) return { status: 'unavailable' }
      if (url.endsWith('/2')) return { status: 'active', price: 200000 }
      return { status: 'active', price: 300000 }
    })
    const { client, updates } = makeSupabaseStub([
      { id: '1', centris_link: 'https://x/1', price: 100000, status: 'active' },
      { id: '2', centris_link: 'https://x/2', price: 250000, status: 'active' },
      { id: '3', centris_link: 'https://x/3', price: 300000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 3, unavailable: 1, priceChanged: 1, errors: 0 })
    expect(updates).toHaveLength(3)
  })

  it('skips soft-deleted listings (deleted_at not null)', async () => {
    const spy = vi.spyOn(statusCheck, 'checkListingStatus').mockResolvedValue({ status: 'unavailable' })
    const { client, updates } = makeSupabaseStub([
      { id: 'live', centris_link: 'https://x/1', price: 100000, status: 'active', deleted_at: null },
      { id: 'trashed', centris_link: 'https://x/2', price: 200000, status: 'active', deleted_at: '2026-03-01T00:00:00Z' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary.checked).toBe(1)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('live')
  })
})
