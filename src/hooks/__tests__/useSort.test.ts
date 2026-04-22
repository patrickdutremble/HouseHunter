import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSort } from '@/hooks/useSort'
import type { Listing } from '@/types/listing'

function mk(partial: Partial<Listing> = {}): Listing {
  return {
    id: 'x', centris_link: null, broker_link: null, location: null,
    full_address: null, mls_number: null, property_type: null,
    price: null, taxes_yearly: null, common_fees_yearly: null,
    bedrooms: null, liveable_area_sqft: null, price_per_sqft: null,
    parking: null, year_built: null, hydro_yearly: null,
    downpayment: null, monthly_mortgage: null, total_monthly_cost: null,
    commute_school_car: null, commute_school_has_toll: null,
    commute_pvm_transit: null, notes: null, personal_rating: null,
    status: 'active', status_checked_at: null, previous_price: null,
    price_changed_at: null, favorite: false, flagged_for_deletion: false,
    image_url: null, latitude: null, longitude: null,
    created_at: '2026-04-01', updated_at: '2026-04-01',
    deleted_at: null, criteria: null,
    ...partial,
  }
}

describe('useSort — multi-level', () => {
  it('empty sort array = original order', () => {
    const ls = [mk({ id: 'a' }), mk({ id: 'b' })]
    const { result } = renderHook(() => useSort(ls))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('single-level asc sort on price', () => {
    const ls = [mk({ id: 'a', price: 800000 }), mk({ id: 'b', price: 500000 })]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'price', direction: 'asc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['b', 'a'])
  })

  it('single-level desc flips order', () => {
    const ls = [mk({ id: 'a', price: 800000 }), mk({ id: 'b', price: 500000 })]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'price', direction: 'desc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('two-level: ties in primary broken by secondary', () => {
    const ls = [
      mk({ id: 'a', price: 500000, liveable_area_sqft: 900 }),
      mk({ id: 'b', price: 500000, liveable_area_sqft: 1200 }),
      mk({ id: 'c', price: 600000, liveable_area_sqft: 800 }),
    ]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'desc' },
    ]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['b', 'a', 'c'])
  })

  it('nulls sort last in asc and desc', () => {
    const ls = [
      mk({ id: 'a', price: 500000 }),
      mk({ id: 'b', price: null }),
      mk({ id: 'c', price: 300000 }),
    ]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'price', direction: 'asc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['c', 'a', 'b'])
    act(() => result.current.setSort([{ column: 'price', direction: 'desc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'c', 'b'])
  })

  it('criteria_count still works as primary', () => {
    const ls = [
      mk({ id: 'a', criteria: { k1: true, k2: true } }),
      mk({ id: 'b', criteria: { k1: true } }),
    ]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'criteria_count', direction: 'desc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('toggleSort cycles asc → desc → clear on same column', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'asc' }])
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'desc' }])
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([])
  })

  it('plain click on different column replaces sort', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ]))
    act(() => result.current.toggleSort('bedrooms', false))
    expect(result.current.sort).toEqual([{ column: 'bedrooms', direction: 'asc' }])
  })

  it('plain click on a column that is one of several collapses to that column asc', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'desc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ]))
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'asc' }])
  })

  it('shift-click appends a new level', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.toggleSort('price', false))
    act(() => result.current.toggleSort('liveable_area_sqft', true))
    expect(result.current.sort).toEqual([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ])
  })

  it('shift-click on existing level flips its direction', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ]))
    act(() => result.current.toggleSort('liveable_area_sqft', true))
    expect(result.current.sort).toEqual([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'desc' },
    ])
  })

  it('third shift-click removes that level only', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'desc' },
    ]))
    act(() => result.current.toggleSort('liveable_area_sqft', true))
    // liveable_area_sqft was desc; shift-click should remove.
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'asc' }])
  })
})
