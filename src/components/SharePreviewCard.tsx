'use client'
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
        className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-5 space-y-4"
      >
        <div className="w-full aspect-video bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
        <div className="h-6 bg-slate-200 rounded animate-pulse w-1/3" />
        <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
      </div>
    )
  }

  if (variant === 'error') {
    return (
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-5 border-t-4 border-red-500">
        <div className="text-red-600 font-semibold mb-2">{message ?? "Couldn't read this listing"}</div>
        {url && (
          <div className="text-xs text-slate-500 break-all mb-4">{url}</div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 py-3 rounded-lg bg-slate-900 text-white font-medium"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onManual}
            className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-900 font-medium"
          >
            Paste manually
          </button>
        </div>
      </div>
    )
  }

  // success or duplicate
  const isSuccess = variant === 'success'
  const badgeClass = isSuccess
    ? 'bg-green-100 text-green-700'
    : 'bg-amber-100 text-amber-700'
  const badgeText = isSuccess ? '✓ Added' : 'Already saved'

  const l = listing
  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
      {l?.image_url ? (
        <img
          src={l.image_url}
          alt=""
          loading="lazy"
          className="w-full aspect-video object-cover bg-slate-100"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      ) : (
        <div className="w-full aspect-video bg-slate-100" />
      )}
      <div className="p-5 space-y-2">
        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${badgeClass}`}>
          {badgeText}
        </span>
        <div className="text-slate-900 font-medium">
          {l?.full_address ?? l?.location ?? '—'}
        </div>
        {l?.full_address && l?.location && (
          <div className="text-sm text-slate-600">{l.location}</div>
        )}
        <div className="text-2xl font-bold text-slate-900">{formatPrice(l?.price ?? null)}</div>
        <div className="text-sm text-slate-600">
          {[l?.bedrooms && `${l.bedrooms} bdr`, l?.liveable_area_sqft && `${l.liveable_area_sqft} sqft`]
            .filter(Boolean)
            .join(' • ') || '—'}
        </div>
        {(l?.commute_school_car || l?.commute_pvm_transit) && (
          <div className="text-sm text-slate-600">
            {l?.commute_school_car ?? l?.commute_pvm_transit}
          </div>
        )}
        <div className="pt-3 flex justify-end">
          {isSuccess ? (
            <button
              type="button"
              onClick={onUndo}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-900 font-medium"
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={onDone}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
