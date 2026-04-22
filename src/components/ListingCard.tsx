'use client'
import { useState } from 'react'
import type { Listing } from '@/types/listing'

interface ListingCardProps {
  listing: Listing
  onTap: (id: string) => void
  onDelete: (id: string) => void
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diffMs = Date.now() - then
  if (diffMs < 0) return 'just now'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return '$' + price.toLocaleString('en-CA')
}

function PlaceholderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
    </svg>
  )
}

export function ListingCard({ listing, onTap, onDelete }: ListingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const address = listing.full_address ?? listing.location ?? '—'
  const meta = [
    listing.bedrooms && `${listing.bedrooms} bdr`,
    listing.liveable_area_sqft && `${listing.liveable_area_sqft} sqft`,
  ]
    .filter(Boolean)
    .join(' • ')
  const commute = listing.commute_school_car ?? listing.commute_pvm_transit

  function handleDeleteClick() {
    setMenuOpen(false)
    if (window.confirm('Move to trash?')) {
      onDelete(listing.id)
    }
  }

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        type="button"
        data-testid="listing-card-body"
        onClick={() => onTap(listing.id)}
        className="w-full flex gap-3 p-3 text-left"
      >
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={address}
            loading="lazy"
            className="shrink-0 w-20 h-20 rounded-lg object-cover bg-slate-100"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
        ) : (
          <div className="shrink-0 w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
            <PlaceholderIcon />
          </div>
        )}
        <div className="flex-1 min-w-0 pr-8">
          <div className="text-sm text-slate-900 truncate">{address}</div>
          <div className="font-bold text-slate-900">{formatPrice(listing.price)}</div>
          {meta && <div className="text-xs text-slate-600">{meta}</div>}
          {commute && <div className="text-xs text-slate-600 truncate">{commute}</div>}
          <div className="text-[11px] text-slate-400 mt-0.5">Added {timeAgo(listing.created_at)}</div>
        </div>
      </button>

      <button
        type="button"
        aria-label="More"
        onClick={() => setMenuOpen(v => !v)}
        className="absolute top-2 right-2 z-50 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="4" cy="10" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="16" cy="10" r="1.5" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-10 right-2 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]">
            {listing.centris_link && (
              <a
                href={listing.centris_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-slate-900 hover:bg-slate-50"
              >
                Open on Centris
              </a>
            )}
            <button
              type="button"
              onClick={handleDeleteClick}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
