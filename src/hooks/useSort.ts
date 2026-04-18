'use client'

import { useState, useMemo } from 'react'
import { countChecked } from '@/lib/criteria'
import type { Listing } from '@/types/listing'

export type SortDirection = 'asc' | 'desc' | null

export interface SortState {
  column: string | null
  direction: SortDirection
}

export function useSort(listings: Listing[]) {
  const [sort, setSort] = useState<SortState>({ column: null, direction: null })

  const toggleSort = (column: string) => {
    setSort(prev => {
      if (prev.column !== column) return { column, direction: 'asc' }
      if (prev.direction === 'asc') return { column, direction: 'desc' }
      return { column: null, direction: null }
    })
  }

  const sorted = useMemo(() => {
    if (!sort.column || !sort.direction) return listings

    return [...listings].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown

      if (sort.column === 'criteria_count') {
        aVal = countChecked(a.criteria)
        bVal = countChecked(b.criteria)
      } else {
        aVal = a[sort.column as keyof Listing]
        bVal = b[sort.column as keyof Listing]
      }

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sort.direction === 'desc' ? -comparison : comparison
    })
  }, [listings, sort])

  return { sorted, sort, toggleSort }
}
