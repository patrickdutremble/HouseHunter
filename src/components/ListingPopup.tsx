import type { Listing } from '@/types/listing'
import { formatPillPrice } from '@/lib/marker-style'

interface ListingPopupProps {
  listing: Listing
  onSelect: (id: string) => void
}

export function ListingPopup({ listing, onSelect }: ListingPopupProps) {
  return (
    <div className="w-56">
      {listing.image_url && (
        <img
          src={listing.image_url}
          alt={listing.full_address ?? listing.location ?? 'Listing thumbnail'}
          loading="lazy"
          className="w-full h-28 object-cover rounded-md bg-surface-muted mb-2"
        />
      )}
      <div className="text-base font-semibold text-fg">
        {formatPillPrice(listing.price)}
      </div>
      <div className="text-xs text-fg-muted mt-0.5 leading-snug">
        {listing.full_address ?? listing.location ?? '—'}
      </div>
      <div className="flex gap-3 mt-2 text-[11px] text-fg-subtle">
        {listing.bedrooms && <span>{listing.bedrooms} bed</span>}
        {listing.commute_school_car && (
          <span>School: {listing.commute_school_car}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => onSelect(listing.id)}
        className="mt-3 w-full px-3 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-md hover:bg-sky-700 dark:hover:bg-sky-500 active:bg-sky-800 dark:active:bg-sky-600 transition-colors"
      >
        See full details
      </button>
    </div>
  )
}
