'use client'

import { useEffect, useMemo, useState } from 'react'
import { TableHeader } from './TableHeader'
import { TableRow } from './TableRow'
import { FilterBar, type Filters } from './FilterBar'
import { RefreshStatusesButton } from './RefreshStatusesButton'
import { timeAgo } from '@/lib/time-ago'
import { useSort } from '@/hooks/useSort'
import { useTableKeyboard } from '@/hooks/useTableKeyboard'
import type { Listing } from '@/types/listing'

interface ListingsTableProps {
  listings: Listing[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  compareIds: Set<string>
  onToggleCompare: (id: string) => void
  onRefreshed?: () => void
}

export function ListingsTable({ listings, selectedId, onSelect, onUpdate, compareIds, onToggleCompare, onRefreshed }: ListingsTableProps) {
  const [filters, setFilters] = useState<Filters>({ type: '', minPrice: '', maxPrice: '', favoritesOnly: false, flagStatus: 'all' })
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return listings.filter(l => {
      if (filters.flagStatus === 'only' && !l.flagged_for_deletion) return false
      if (filters.flagStatus === 'hide' && l.flagged_for_deletion) return false
      if (filters.favoritesOnly && !l.favorite) return false
      if (filters.type && l.property_type !== filters.type) return false
      if (filters.minPrice) {
        const min = Number(filters.minPrice.replace(/[$,\s]/g, ''))
        if (!isNaN(min) && (l.price ?? 0) < min) return false
      }
      if (filters.maxPrice) {
        const max = Number(filters.maxPrice.replace(/[$,\s]/g, ''))
        if (!isNaN(max) && (l.price ?? Infinity) > max) return false
      }
      return true
    })
  }, [listings, filters])

  const { sorted, sort, toggleSort } = useSort(filtered)

  useTableKeyboard({
    listings: sorted,
    focusedId,
    selectedId,
    setFocusedId,
    setSelectedId: onSelect,
    onToggleCompare,
  })

  const handleRowSelect = (id: string) => {
    setFocusedId(id)
    onSelect(id)
  }

  useEffect(() => {
    if (focusedId !== null && !sorted.some(l => l.id === focusedId)) {
      setFocusedId(null)
    }
  }, [sorted, focusedId])

  const propertyTypes = useMemo(() => {
    const types = new Set(listings.map(l => l.property_type).filter(Boolean) as string[])
    return Array.from(types).sort()
  }, [listings])

  const lastCheckedAgo = useMemo(() => {
    const latest = listings
      .map(l => l.status_checked_at)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1)
    return timeAgo(latest ?? null)
  }, [listings])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <FilterBar propertyTypes={propertyTypes} onFilterChange={setFilters} />
          <RefreshStatusesButton onRefreshed={() => onRefreshed?.()} />
          {lastCheckedAgo && (
            <span className="text-xs text-slate-500">Last checked: {lastCheckedAgo}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-slate-400" title="Keyboard shortcuts: Arrow keys to navigate, Enter to open, Esc to close, c to toggle compare">
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">↑↓</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">Enter</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">Esc</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">c</kbd>
          </span>
          <span className="text-sm text-slate-500">
            {sorted.length} listing{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <TableHeader sort={sort} onSort={toggleSort} hasCompare />
          <tbody>
            {sorted.map(listing => (
              <TableRow
                key={listing.id}
                listing={listing}
                isSelected={listing.id === selectedId}
                isFocused={listing.id === focusedId}
                onSelect={handleRowSelect}
                onUpdate={onUpdate}
                isCompared={compareIds.has(listing.id)}
                onToggleCompare={onToggleCompare}
              />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={99} className="px-4 py-12 text-center text-slate-400 text-sm">
                  {listings.length === 0
                    ? 'No listings yet. Click "Add listing" to get started.'
                    : 'No listings match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
