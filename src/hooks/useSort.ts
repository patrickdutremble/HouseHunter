'use client'

import { useState, useMemo, useCallback } from 'react'
import { countChecked, deriveCriteria } from '@/lib/criteria'
import type { Listing } from '@/types/listing'

export type SortDirection = 'asc' | 'desc'
export interface SortLevel {
  column: string
  direction: SortDirection
}
export type SortState = SortLevel[]

function getValue(l: Listing, column: string): unknown {
  if (column === 'criteria_count') return countChecked(deriveCriteria(l))
  return l[column as keyof Listing]
}

function compareByColumn(a: Listing, b: Listing, column: string, direction: SortDirection): number {
  const aVal = getValue(a, column)
  const bVal = getValue(b, column)
  const aNull = aVal === null || aVal === undefined
  const bNull = bVal === null || bVal === undefined
  if (aNull && bNull) return 0
  // Nulls always sort last regardless of direction. Return a direction-invariant
  // sign so the caller's flip-for-desc doesn't move them to the top.
  if (aNull) return direction === 'desc' ? -1 : 1
  if (bNull) return direction === 'desc' ? 1 : -1
  if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal
  return String(aVal).localeCompare(String(bVal))
}

export function useSort(listings: Listing[]) {
  const [sort, setSort] = useState<SortState>([])

  const toggleSort = useCallback((column: string, shift: boolean) => {
    setSort(prev => {
      const idx = prev.findIndex(s => s.column === column)

      if (!shift) {
        if (prev.length === 1 && idx === 0) {
          if (prev[0].direction === 'asc') return [{ column, direction: 'desc' }]
          return []
        }
        return [{ column, direction: 'asc' }]
      }

      if (idx === -1) {
        return [...prev, { column, direction: 'asc' }]
      }
      const existing = prev[idx]
      if (existing.direction === 'asc') {
        const next = [...prev]
        next[idx] = { column, direction: 'desc' }
        return next
      }
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const sorted = useMemo(() => {
    if (sort.length === 0) return listings
    return [...listings].sort((a, b) => {
      for (const { column, direction } of sort) {
        const cmp = compareByColumn(a, b, column, direction)
        if (cmp !== 0) return direction === 'desc' ? -cmp : cmp
      }
      return 0
    })
  }, [listings, sort])

  return { sorted, sort, toggleSort, setSort }
}
