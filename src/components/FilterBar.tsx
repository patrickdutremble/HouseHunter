'use client'

import { useState, useRef, useEffect } from 'react'
import { type Filters, type FlagStatus, EMPTY_FILTERS, countActiveFilters } from '@/lib/filters'
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
const flagBtnActive = 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
const flagBtnHideActive = 'bg-surface-muted border-border-strong text-fg-muted'
const flagBtnAllActive = 'bg-surface border-border-strong text-fg-muted'
const flagBtnIdle = 'bg-surface border-border text-fg-subtle hover:bg-surface-hover'

const iconBtnBase = 'relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
const iconBtnIdle = 'bg-surface border-border text-fg-muted hover:bg-surface-hover'
const iconBtnFilterActive = 'bg-blue-50 dark:bg-sky-900/40 border-blue-300 dark:border-sky-700 text-blue-700 dark:text-blue-300'
const iconBtnFavActive = 'bg-amber-50 dark:bg-amber-900/30 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'

const FilterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />
  </svg>
)

const SortIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M3 6h18M6 12h12M9 18h6" />
  </svg>
)

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 21l1.1-6.5L2.6 9.8l6.5-.9L12 3z" />
  </svg>
)

const CountBadge = ({ count }: { count: number }) => (
  <span
    aria-hidden="true"
    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-accent text-accent-fg text-[10px] font-semibold leading-none"
  >
    {count}
  </span>
)

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

  const activeCount = countActiveFilters(filters)

  return (
    <div className="flex items-center gap-2">
      <div ref={filterPopover.ref} className="relative">
        <button
          onClick={() => filterPopover.setOpen(!filterPopover.open)}
          aria-label={activeCount > 0 ? `Filters (${activeCount} active)` : 'Filters'}
          title="Filters"
          className={`${iconBtnBase} ${activeCount > 0 ? iconBtnFilterActive : iconBtnIdle}`}
        >
          <FilterIcon />
          {activeCount > 0 && <CountBadge count={activeCount} />}
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
          aria-label={sort.length > 0 ? `Sort (${sort.length} active)` : 'Sort'}
          title="Sort"
          className={`${iconBtnBase} ${sort.length > 0 ? iconBtnFilterActive : iconBtnIdle}`}
        >
          <SortIcon />
          {sort.length > 0 && <CountBadge count={sort.length} />}
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
        aria-label={filters.favoritesOnly ? 'Showing favorites only' : 'Show favorites only'}
        title={filters.favoritesOnly ? 'Showing favorites only' : 'Show favorites only'}
        className={`${iconBtnBase} ${filters.favoritesOnly ? iconBtnFavActive : iconBtnIdle}`}
      >
        <StarIcon filled={filters.favoritesOnly} />
      </button>

      <div role="radiogroup" aria-label="Flag status" className="inline-flex rounded-lg overflow-hidden border border-border">
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'all')}
          aria-checked={filters.flagStatus === 'all'}
          className={`${flagBtnBase} border-0 border-r border-border ${filters.flagStatus === 'all' ? flagBtnAllActive : flagBtnIdle}`}
        >
          All
        </button>
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'only')}
          aria-checked={filters.flagStatus === 'only'}
          className={`${flagBtnBase} border-0 border-r border-border ${filters.flagStatus === 'only' ? flagBtnActive : flagBtnIdle}`}
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
