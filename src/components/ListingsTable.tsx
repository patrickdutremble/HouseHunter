'use client'

import { useMemo, useState } from 'react'
import { TableHeader } from './TableHeader'
import { TableRow } from './TableRow'
import { FilterBar, type Filters } from './FilterBar'
import { useSort } from '@/hooks/useSort'
import type { Listing } from '@/types/listing'

interface ListingsTableProps {
  listings: Listing[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null) => void
  compareIds: Set<string>
  onToggleCompare: (id: string) => void
}

export function ListingsTable({ listings, selectedId, onSelect, onUpdate, compareIds, onToggleCompare }: ListingsTableProps) {
  const [filters, setFilters] = useState<Filters>({ type: '', minPrice: '', maxPrice: '' })

  const filtered = useMemo(() => {
    return listings.filter(l => {
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

  const propertyTypes = useMemo(() => {
    const types = new Set(listings.map(l => l.property_type).filter(Boolean) as string[])
    return Array.from(types).sort()
  }, [listings])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
        <FilterBar propertyTypes={propertyTypes} onFilterChange={setFilters} />
        <span className="text-sm text-slate-500">
          {sorted.length} listing{sorted.length !== 1 ? 's' : ''}
        </span>
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
                onSelect={onSelect}
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
