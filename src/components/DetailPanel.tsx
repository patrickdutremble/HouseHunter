'use client'

import { detailColumns } from '@/lib/columns'
import { EditableCell } from './EditableCell'
import { StatusBadge } from './StatusBadge'
import type { Listing } from '@/types/listing'

interface DetailPanelProps {
  listing: Listing
  onClose: () => void
  onUpdate: (id: string, field: string, value: string | number | null) => void
  onDelete: (id: string) => void
}

export function DetailPanel({ listing, onClose, onUpdate, onDelete }: DetailPanelProps) {
  const googleMapsUrl = listing.full_address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.full_address)}`
    : null

  return (
    <div className="w-[420px] border-l border-slate-200 bg-white flex flex-col h-full shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {listing.location ?? 'Unknown Location'}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={listing.status} />
            {listing.mls_number && (
              <span className="text-xs text-slate-400">MLS# {listing.mls_number}</span>
            )}
          </div>
        </div>
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Quick Links */}
        <div className="flex gap-2 mb-5">
          {listing.link && (
            <a
              href={listing.link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              View on Centris &#8599;
            </a>
          )}
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Google Maps &#8599;
            </a>
          )}
        </div>

        {/* Fields */}
        <div className="space-y-3">
          {detailColumns.map(col => {
            if (col.key === 'status') return null
            if (col.key === 'link') return null

            const value = listing[col.key as keyof Listing]

            return (
              <div key={col.key} className="flex items-start justify-between py-1.5 border-b border-slate-50">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide w-32 shrink-0 pt-0.5">
                  {col.label}
                </span>
                <div className="flex-1 text-sm text-slate-700">
                  <EditableCell
                    value={value}
                    format={col.format}
                    editable={col.editable}
                    align="left"
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
