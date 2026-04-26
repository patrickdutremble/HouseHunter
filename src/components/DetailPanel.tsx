'use client'

import { useState, useEffect } from 'react'
import { detailColumns } from '@/lib/columns'
import { EditableCell } from './EditableCell'
import { LocationField } from './LocationField'
import { FavoriteButton } from './FavoriteButton'
import { criteria, deriveCriteria, isDerivedCriterion } from '@/lib/criteria'
import type { Listing } from '@/types/listing'

interface DetailPanelProps {
  listing: Listing
  onClose: () => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  onDelete: (id: string) => void
}

const SECONDARY_LINK_BUTTON_CLASSES =
  'px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-sky-900/40 text-accent rounded-lg hover:bg-blue-100 dark:hover:bg-sky-900/60 hover:text-sky-700 dark:hover:text-sky-300 transition-colors'

export function DetailPanel({ listing, onClose, onUpdate, onDelete }: DetailPanelProps) {
  const [pendingCriteria, setPendingCriteria] = useState<Record<string, boolean>>(listing.criteria ?? {})

  useEffect(() => {
    setPendingCriteria(listing.criteria ?? {})
  }, [listing.id])
  return (
    <div className="w-[420px] border-l border-border bg-surface flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-bg">
        <div>
          <h2 className="text-lg font-semibold text-fg">
            {listing.location ?? 'Unknown Location'}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <FavoriteButton
            value={listing.favorite}
            onToggle={() => onUpdate(listing.id, 'favorite', !listing.favorite)}
            size={22}
          />
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-fg-subtle hover:text-fg-muted hover:bg-surface-muted transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Quick Links */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {listing.centris_link && (
            <a
              href={listing.centris_link}
              target="_blank"
              rel="noopener noreferrer"
              className={SECONDARY_LINK_BUTTON_CLASSES}
            >
              View on Centris &#8599;
            </a>
          )}
          {listing.broker_link && (
            <a
              href={listing.broker_link}
              target="_blank"
              rel="noopener noreferrer"
              className={SECONDARY_LINK_BUTTON_CLASSES}
            >
              Broker site &#8599;
            </a>
          )}
        </div>

        {/* Good-to-have criteria */}
        <div className="mb-5">
          <div className="text-xs font-medium text-fg-subtle uppercase tracking-wide mb-2">
            Good-to-have criteria
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {criteria.map(c => {
              const isDerived = isDerivedCriterion(c.key)
              const checked = isDerived
                ? deriveCriteria({ ...listing, criteria: pendingCriteria })[c.key]
                : pendingCriteria[c.key] === true
              const cursor = isDerived ? 'cursor-not-allowed' : 'cursor-pointer'
              return (
                <label key={c.key} className={`flex items-center gap-2 text-sm text-fg-muted ${cursor}`}>
                  <input
                    type="checkbox"
                    aria-label={c.label}
                    checked={checked}
                    disabled={isDerived}
                    title={isDerived ? 'Auto-derived from listing data' : undefined}
                    onChange={isDerived ? undefined : () => {
                      setPendingCriteria(prev => {
                        const next = { ...prev, [c.key]: !(prev[c.key] === true) }
                        onUpdate(listing.id, 'criteria', next)
                        return next
                      })
                    }}
                    className={`w-4 h-4 rounded border-border-strong text-accent focus:ring-accent ${cursor} ${isDerived ? 'opacity-70' : ''}`}
                  />
                  <span className={isDerived ? 'text-fg-subtle' : ''}>{c.label}</span>
                </label>
              )
            })}
          </div>
        </div>

        {/* Listing image */}
        {listing.image_url && (
          <img
            src={listing.image_url}
            alt="Listing photo"
            className="w-full h-48 object-cover rounded-lg border border-border mb-5"
          />
        )}

        {/* Location with full address + Maps link */}
        <div className="flex items-start justify-between py-1.5 border-b border-border mb-3">
          <span className="text-xs font-medium text-fg-subtle uppercase tracking-wide w-32 shrink-0 pt-0.5">
            Location
          </span>
          <div className="flex-1 text-sm text-fg-muted min-w-0">
            <LocationField
              displayValue={listing.full_address ?? listing.location}
              mapQuery={listing.full_address ?? listing.location}
              onSave={(newValue) => onUpdate(listing.id, 'full_address', newValue)}
            />
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {detailColumns.map(col => {
            if (col.key === 'location') return null

            const value = listing[col.key as keyof Listing]

            return (
              <div key={col.key} className="flex items-start justify-between py-1.5 border-b border-border">
                <span className="text-xs font-medium text-fg-subtle uppercase tracking-wide w-32 shrink-0 pt-0.5">
                  {col.label}
                </span>
                <div className="flex-1 text-sm text-fg-muted min-w-0">
                  <EditableCell
                    value={value}
                    format={col.format}
                    editable={col.editable}
                    align="left"
                    wrap
                    multiline={col.key === 'notes'}
                    isSelected={true}
                    onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border bg-bg">
        <button
          onClick={() => {
            if (confirm('Move this listing to the trash?')) {
              onDelete(listing.id)
            }
          }}
          className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          Delete listing
        </button>
      </div>
    </div>
  )
}
