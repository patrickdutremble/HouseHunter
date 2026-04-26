'use client'

import { type Filters, EMPTY_FILTERS, countActiveFilters } from '@/lib/filters'

interface FilterPanelProps {
  propertyTypes: string[]
  filters: Filters
  onChange: (next: Filters) => void
}

const DEFAULT_SCHOOL_MAX = '60'
const DEFAULT_PVM_MAX = '90'
const SCHOOL_RANGE = { min: 0, max: 90 }
const PVM_RANGE = { min: 0, max: 120 }

export function FilterPanel({ propertyTypes, filters, onChange }: FilterPanelProps) {
  const update = <K extends keyof Filters>(field: K, value: Filters[K]) => {
    onChange({ ...filters, [field]: value })
  }

  const activeCount = countActiveFilters(filters)

  const schoolEnabled = filters.maxCommuteSchool !== ''
  const pvmEnabled = filters.maxCommutePvm !== ''

  return (
    <div className="w-96 rounded-lg border border-border bg-surface p-4 shadow-lg space-y-4">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">Property</h4>
        <select
          value={filters.type}
          onChange={e => update('type', e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-surface text-fg-muted"
          aria-label="Property type"
        >
          <option value="">All types</option>
          {propertyTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">Price</h4>
        <div className="flex gap-2">
          <input
            type="text" placeholder="Min $" aria-label="Minimum price"
            value={filters.minPrice}
            onChange={e => update('minPrice', e.target.value)}
            className="w-1/2 px-2 py-1.5 text-sm border border-border rounded-lg"
          />
          <input
            type="text" placeholder="Max $" aria-label="Maximum price"
            value={filters.maxPrice}
            onChange={e => update('maxPrice', e.target.value)}
            className="w-1/2 px-2 py-1.5 text-sm border border-border rounded-lg"
          />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">Beds</h4>
        <input
          type="number" min={0} placeholder="Min beds" aria-label="Min beds"
          value={filters.minBeds}
          onChange={e => update('minBeds', e.target.value)}
          className="w-24 px-2 py-1.5 text-sm border border-border rounded-lg"
        />
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">Commute</h4>
        <div className="space-y-3">
          <div>
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                checked={schoolEnabled}
                aria-label="Limit school commute"
                onChange={e => update('maxCommuteSchool', e.target.checked ? DEFAULT_SCHOOL_MAX : '')}
              />
              Limit school commute
            </label>
            {schoolEnabled && (
              <div className="flex items-center gap-2 mt-1 pl-6">
                <input
                  type="range" min={SCHOOL_RANGE.min} max={SCHOOL_RANGE.max} step={1}
                  aria-label="Max school commute"
                  value={filters.maxCommuteSchool}
                  onChange={e => update('maxCommuteSchool', e.target.value)}
                  className="flex-1"
                />
                <span className="text-xs text-fg-muted w-12 text-right">{filters.maxCommuteSchool} min</span>
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-fg-muted">
              <input
                type="checkbox"
                checked={pvmEnabled}
                aria-label="Limit PVM commute"
                onChange={e => update('maxCommutePvm', e.target.checked ? DEFAULT_PVM_MAX : '')}
              />
              Limit PVM commute
            </label>
            {pvmEnabled && (
              <div className="flex items-center gap-2 mt-1 pl-6">
                <input
                  type="range" min={PVM_RANGE.min} max={PVM_RANGE.max} step={1}
                  aria-label="Max PVM commute"
                  value={filters.maxCommutePvm}
                  onChange={e => update('maxCommutePvm', e.target.value)}
                  className="flex-1"
                />
                <span className="text-xs text-fg-muted w-12 text-right">{filters.maxCommutePvm} min</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">Costs</h4>
        <input
          type="text" placeholder="Max total $/mo" aria-label="Max monthly cost"
          value={filters.maxMonthlyCost}
          onChange={e => update('maxMonthlyCost', e.target.value)}
          className="w-40 px-2 py-1.5 text-sm border border-border rounded-lg"
        />
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle mb-2">Features</h4>
        <label className="flex items-center gap-2 text-sm text-fg-muted">
          <input
            type="checkbox"
            checked={filters.hasGarage}
            aria-label="At least 1 garage"
            onChange={e => update('hasGarage', e.target.checked)}
          />
          At least 1 garage
        </label>
      </section>

      <footer className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-xs text-fg-subtle">{activeCount} active</span>
        {activeCount > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-sm text-fg-subtle hover:text-fg transition-colors"
          >
            Clear all
          </button>
        )}
      </footer>
    </div>
  )
}
