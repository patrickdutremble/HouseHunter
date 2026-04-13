'use client'

import { detailColumns } from '@/lib/columns'
import { EditableCell } from './EditableCell'
import { LocationField } from './LocationField'
import { FavoriteButton } from './FavoriteButton'
import type { Listing } from '@/types/listing'

interface DetailPanelProps {
  listing: Listing
  onClose: () => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null) => void
  onDelete: (id: string) => void
}

export function DetailPanel({ listing, onClose, onUpdate, onDelete }: DetailPanelProps) {
  return (
    <div className="w-[420px] border-l border-slate-200 bg-white flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
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
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
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
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              View on Centris &#8599;
            </a>
          )}
          {listing.broker_link && (
            <a
              href={listing.broker_link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Broker site &#8599;
            </a>
          )}
        </div>

        {/* Listing image */}
        {listing.image_url && (
          <img
            src={listing.image_url}
            alt="Listing photo"
            className="w-full h-48 object-cover rounded-lg border border-slate-200 mb-5"
          />
        )}

        {/* Location with full address + Maps link */}
        <div className="flex items-start justify-between py-1.5 border-b border-slate-50 mb-3">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">
            Location
          </span>
          <div className="flex-1 text-sm text-slate-700 min-w-0">
            <LocationField
              value={listing.full_address ?? listing.location}
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
              <div key={col.key} className="flex items-start justify-between py-1.5 border-b border-slate-50">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">
                  {col.label}
                </span>
                <div className="flex-1 text-sm text-slate-700 min-w-0">
                  <EditableCell
                    value={value}
                    format={col.format}
                    editable={col.editable}
                    align="left"
                    wrap
                    multiline={col.key === 'notes'}
                    onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-200 bg-slate-50">
        <button
          onClick={() => {
            if (confirm('Delete this listing? This cannot be undone.')) {
              onDelete(listing.id)
            }
          }}
          className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
        >
          Delete listing
        </button>
      </div>
    </div>
  )
}
