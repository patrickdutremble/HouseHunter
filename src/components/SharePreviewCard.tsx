'use client'
import Image from 'next/image'
import type { Listing } from '@/types/listing'

type Variant = 'loading' | 'success' | 'duplicate' | 'error'

interface SharePreviewCardProps {
  variant: Variant
  listing?: Listing
  url?: string
  message?: string
  onUndo?: () => void
  onDone?: () => void
  onRetry?: () => void
  onManual?: () => void
}

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return '$' + price.toLocaleString('en-CA')
}

export function SharePreviewCard(props: SharePreviewCardProps) {
  const { variant, listing, url, message, onUndo, onDone, onRetry, onManual } = props

  if (variant === 'loading') {
    return (
      <div
        data-testid="share-skeleton"
        role="status"
        aria-label="Loading listing preview"
        className="hh-force-light w-full max-w-sm mx-auto bg-surface rounded-2xl shadow-lg p-5 space-y-4"
      >
        <div className="w-full aspect-video bg-surface-muted rounded-lg animate-pulse" />
        <div className="h-4 bg-surface-muted rounded animate-pulse w-3/4" />
        <div className="h-6 bg-surface-muted rounded animate-pulse w-1/3" />
        <div className="h-3 bg-surface-muted rounded animate-pulse w-2/3" />
      </div>
    )
  }

  if (variant === 'error') {
    return (
      <div role="alert" className="hh-force-light w-full max-w-sm mx-auto bg-surface rounded-2xl shadow-lg p-5 border-t-4 border-red-500">
        <div className="text-red-600 font-semibold mb-2">{message ?? "Couldn't read this listing"}</div>
        {url && (
          <div className="text-xs text-fg-subtle break-all mb-4">{url}</div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 py-3 rounded-lg bg-accent text-accent-fg font-medium"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onManual}
            className="flex-1 py-3 rounded-lg bg-surface-muted text-fg font-medium"
          >
            Paste manually
          </button>
        </div>
      </div>
    )
  }

  // success or duplicate
  const isSuccess = variant === 'success'
  // No dark: variants needed — the card root is wrapped in hh-force-light.
  const badgeClass = isSuccess
    ? 'bg-green-100 text-green-700'
    : 'bg-amber-100 text-amber-700'
  const badgeText = isSuccess ? '✓ Added' : 'Already saved'

  const l = listing
  return (
    <div className="hh-force-light w-full max-w-sm mx-auto bg-surface rounded-2xl shadow-lg overflow-hidden">
      {l?.image_url ? (
        <div className="relative w-full aspect-video bg-surface-muted">
          <Image
            src={l.image_url}
            alt={`Photo of ${l?.full_address ?? l?.location ?? 'listing'}`}
            fill
            sizes="(max-width: 640px) 100vw, 400px"
            className="object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
        </div>
      ) : (
        <div className="w-full aspect-video bg-surface-muted" />
      )}
      <div className="p-5 space-y-2">
        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${badgeClass}`}>
          {badgeText}
        </span>
        <h2 className="text-fg font-medium">
          {l?.full_address ?? l?.location ?? '—'}
        </h2>
        {l?.full_address && l?.location && (
          <div className="text-sm text-fg-muted">{l.location}</div>
        )}
        <div className="text-2xl font-bold text-fg">{formatPrice(l?.price ?? null)}</div>
        <div className="text-sm text-fg-muted">
          {[l?.bedrooms && `${l.bedrooms} bdr`, l?.liveable_area_sqft && `${l.liveable_area_sqft} sqft`]
            .filter(Boolean)
            .join(' • ') || '—'}
        </div>
        {(l?.commute_school_car || l?.commute_pvm_transit) && (
          <div className="text-sm text-fg-muted">
            {l?.commute_school_car ?? l?.commute_pvm_transit}
          </div>
        )}
        <div className="pt-3 flex justify-end">
          {isSuccess ? (
            <button
              type="button"
              onClick={onUndo}
              className="px-4 py-2 rounded-lg bg-surface-muted text-fg font-medium"
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={onDone}
              className="px-4 py-2 rounded-lg bg-accent text-accent-fg font-medium"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
