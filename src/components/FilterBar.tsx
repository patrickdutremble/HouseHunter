'use client'

import { useState, useRef, useEffect } from 'react'
import { type Filters, type FlagStatus, EMPTY_FILTERS } from '@/lib/filters'
import { FilterPanel } from './FilterPanel'
import { SortPanel } from './SortPanel'
import type { SortState } from '@/hooks/useSort'

export type { Filters, FlagStatus }

interface FilterBarProps {
  propertyTypes: string[]
  filters: Filters
  onFilterChange: (filters: Filters) => void
  sort: SortState
  onSortChange: (next: SortState) => void
}

const flagBtnBase = 'px-3 py-1.5 text-sm border transition-colors'
const flagBtnActive = 'bg-red-50 border-red-300 text-red-700'
const flagBtnHideActive = 'bg-slate-100 border-slate-300 text-slate-700'
const flagBtnAllActive = 'bg-white border-slate-300 text-slate-700'
const flagBtnIdle = 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return { open, setOpen, ref }
}

export function FilterBar({
  propertyTypes,
  filters,
  onFilterChange,
  sort,
  onSortChange,
}: FilterBarProps) {
  const filterPopover = usePopover()
  const sortPopover = usePopover()

  const update = <K extends keyof Filters>(field: K, value: Filters[K]) => {
    onFilterChange({ ...filters, [field]: value })
  }

  const activeCount = [
    filters.type !== '',
    filters.minPrice !== '',
    filters.maxPrice !== '',
    filters.favoritesOnly,
    filters.flagStatus !== 'all',
    filters.minBeds !== '',
    filters.maxCommuteSchool !== '',
    filters.maxCommutePvm !== '',
    filters.maxMonthlyCost !== '',
    filters.hasGarage,
  ].filter(Boolean).length

  return (
    <div className="flex items-center gap-2">
      <div ref={filterPopover.ref} className="relative">
        <button
          onClick={() => filterPopover.setOpen(!filterPopover.open)}
          className={`
            px-3 py-1.5 text-sm rounded-lg border transition-colors
            ${activeCount > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
          `}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
        {filterPopover.open && (
          <div className="absolute top-full left-0 mt-1 z-20">
            <FilterPanel
              propertyTypes={propertyTypes}
              filters={filters}
              onChange={onFilterChange}
            />
          </div>
        )}
      </div>

      <div ref={sortPopover.ref} className="relative">
        <button
          onClick={() => sortPopover.setOpen(!sortPopover.open)}
          className={`
            px-3 py-1.5 text-sm rounded-lg border transition-colors
            ${sort.length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
          `}
        >
          Sort{sort.length > 0 ? ` (${sort.length})` : ''}
        </button>
        {sortPopover.open && (
          <div className="absolute top-full left-0 mt-1 z-20">
            <SortPanel sort={sort} onChange={onSortChange} />
          </div>
        )}
      </div>

      <button
        onClick={() => update('favoritesOnly', !filters.favoritesOnly)}
        aria-pressed={filters.favoritesOnly}
        title={filters.favoritesOnly ? 'Showing favorites only' : 'Show favorites only'}
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${filters.favoritesOnly
            ? 'bg-amber-50 border-amber-300 text-amber-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
        `}
      >
        {filters.favoritesOnly ? '\u2605' : '\u2606'} Favorites
      </button>

      <div role="radiogroup" aria-label="Flag status" className="inline-flex rounded-lg overflow-hidden border border-slate-200">
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'all')}
          aria-checked={filters.flagStatus === 'all'}
          className={`${flagBtnBase} border-0 border-r border-slate-200 ${filters.flagStatus === 'all' ? flagBtnAllActive : flagBtnIdle}`}
        >
          All
        </button>
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'only')}
          aria-checked={filters.flagStatus === 'only'}
          className={`${flagBtnBase} border-0 border-r border-slate-200 ${filters.flagStatus === 'only' ? flagBtnActive : flagBtnIdle}`}
        >
          Flagged only
        </button>
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'hide')}
          aria-checked={filters.flagStatus === 'hide'}
          className={`${flagBtnBase} border-0 ${filters.flagStatus === 'hide' ? flagBtnHideActive : flagBtnIdle}`}
        >
          Hide flagged
        </button>
      </div>
    </div>
  )
}

export { EMPTY_FILTERS }
