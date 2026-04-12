'use client'

import { useState } from 'react'

export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
}

const EMPTY_FILTERS: Filters = { type: '', minPrice: '', maxPrice: '' }

interface FilterBarProps {
  propertyTypes: string[]
  onFilterChange: (filters: Filters) => void
}

export function FilterBar({ propertyTypes, onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [open, setOpen] = useState(false)

  const update = (field: keyof Filters, value: string) => {
    const next = { ...filters, [field]: value }
    setFilters(next)
    onFilterChange(next)
  }

  const clear = () => {
    setFilters(EMPTY_FILTERS)
    onFilterChange(EMPTY_FILTERS)
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen(!open)}
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${hasActiveFilters
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }
        `}
      >
        Filters{hasActiveFilters ? ' \u25cf' : ''}
      </button>

      {open && (
        <div className="flex items-center gap-3">
          <select
            value={filters.type}
            onChange={e => update('type', e.target.value)}
            className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="">All types</option>
            {propertyTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Min $"
            value={filters.minPrice}
            onChange={e => update('minPrice', e.target.value)}
            className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />

          <input
            type="text"
            placeholder="Max $"
            value={filters.maxPrice}
            onChange={e => update('maxPrice', e.target.value)}
            className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />

          {hasActiveFilters && (
            <button
              onClick={clear}
              className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
