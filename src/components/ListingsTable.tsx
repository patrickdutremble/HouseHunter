'use client'

import { useEffect, useMemo, useState } from 'react'
import { TableHeader } from './TableHeader'
import { TableRow } from './TableRow'
import { FilterBar, type Filters } from './FilterBar'
import { RefreshStatusesButton } from './RefreshStatusesButton'
import { timeAgo } from '@/lib/time-ago'
import { useSort } from '@/hooks/useSort'
import { useTableKeyboard } from '@/hooks/useTableKeyboard'
import { applyFilters, EMPTY_FILTERS } from '@/lib/filters'
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
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const filtered = useMemo(() => applyFilters(listings, filters), [listings, filters])

  const { sorted, sort, toggleSort, setSort } = useSort(filtered)

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <FilterBar
            propertyTypes={propertyTypes}
            filters={filters}
            onFilterChange={setFilters}
            sort={sort}
            onSortChange={setSort}
          />
          <RefreshStatusesButton onRefreshed={() => onRefreshed?.()} />
          {lastCheckedAgo && (
            <span className="text-xs text-fg-subtle">Last checked: {lastCheckedAgo}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-fg-subtle" title="Keyboard shortcuts: Arrow keys to navigate, Enter to open, Esc to close, c to toggle compare">
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">↑↓</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">Enter</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">Esc</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">c</kbd>
          </span>
          <span className="text-sm text-fg-subtle">
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
                <td colSpan={99} className="px-4 py-12 text-center text-fg-subtle text-sm">
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
