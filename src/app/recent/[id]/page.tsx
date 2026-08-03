'use client'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useListings } from '@/hooks/useListings'
import { FavoriteButton } from '@/components/FavoriteButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import type { Listing } from '@/types/listing'

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return '$' + price.toLocaleString('en-CA')
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div className="py-2 border-b border-border">
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</div>
      <div className="text-fg">{value}</div>
    </div>
  )
}

export function NotesField({
  value,
  onSave,
}: {
  value: string | null
  onSave: (next: string | null) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [failed, setFailed] = useState(false)
  // Set when Escape cancels, so the blur that follows does not save.
  const cancelled = useRef(false)

  if (!editing) {
    return (
      <button
        type="button"
        aria-label="Notes"
        onClick={() => {
          setDraft(value ?? '')
          setFailed(false)
          setEditing(true)
        }}
        className="w-full text-left py-2 border-b border-border"
      >
        <div className="text-[11px] uppercase tracking-wide text-fg-subtle">Notes</div>
        <div className={value ? 'text-fg' : 'text-fg-subtle'}>{value || 'Add notes…'}</div>
      </button>
    )
  }

  const save = async () => {
    const next = draft.trim() === '' ? null : draft
    const ok = await onSave(next)
    if (ok) {
      setEditing(false)
      setFailed(false)
    } else {
      setFailed(true)
    }
  }

  return (
    <div className="py-2 border-b border-border">
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle">Notes</div>
      <textarea
        autoFocus
        aria-label="Notes"
        rows={4}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelled.current) {
            cancelled.current = false
            return
          }
          save()
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            cancelled.current = true
            setFailed(false)
            setEditing(false)
          }
        }}
        className="w-full mt-1 border border-border-strong rounded-lg px-3 py-2 text-sm bg-surface text-fg"
      />
      <button
        type="button"
        // Prevent the textarea's blur from firing a second save before onClick.
        onMouseDown={e => e.preventDefault()}
        onClick={save}
        className="mt-1 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium"
      >
        Done
      </button>
      {failed && (
        <div role="alert" className="mt-1 text-sm text-red-600 dark:text-red-300">
          Couldn&apos;t save notes — try again
        </div>
      )}
    </div>
  )
}

export default function DetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { listings, updateListing } = useListings()
  const [favoriteError, setFavoriteError] = useState<string | null>(null)

  const listing: Listing | undefined = listings.find(l => l.id === params.id)

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      router.push('/recent')
    } else {
      router.back()
    }
  }

  if (!listing) {
    return (
      <main className="min-h-screen bg-bg p-4">
        <button type="button" onClick={handleBack} className="text-fg-muted text-sm" aria-label="Back">← Back</button>
        <div className="mt-8 text-center text-fg-subtle">Listing not found</div>
      </main>
    )
  }

  const criteriaFlags = listing.criteria
    ? Object.entries(listing.criteria)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ')
    : null

  const handleToggleFavorite = async () => {
    const ok = await updateListing(listing.id, 'favorite', !listing.favorite)
    if (!ok) {
      setFavoriteError("Couldn't update favorite — try again")
      return
    }
    setFavoriteError(null)
  }

  return (
    <main className="min-h-screen bg-bg pb-8">
      <div className="px-4 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="text-fg-muted text-sm"
          aria-label="Back"
        >
          ← Back
        </button>
        <div className="flex items-center gap-2">
          <FavoriteButton
            value={listing.favorite}
            onToggle={handleToggleFavorite}
            size={22}
            className="w-10 h-10"
          />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      {favoriteError && (
        <div role="alert" className="px-4 text-sm text-red-600 dark:text-red-300">{favoriteError}</div>
      )}

      {listing.image_url ? (
        <div className="relative w-full aspect-video bg-surface-muted">
          <Image
            src={listing.image_url}
            alt=""
            fill
            sizes="100vw"
            preload
            className="object-cover"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
        </div>
      ) : (
        <div className="w-full aspect-video bg-surface-muted" />
      )}

      <section className="p-4">
        <div className="text-fg font-medium">{listing.full_address ?? listing.location ?? '—'}</div>
        <div className="text-3xl font-bold mt-1">{formatPrice(listing.price)}</div>

        <div className="mt-4 divide-y divide-border">
          <Field label="Bedrooms" value={listing.bedrooms ? `${listing.bedrooms} bdr` : null} />
          <Field label="Area" value={listing.liveable_area_sqft ? `${listing.liveable_area_sqft} sqft` : null} />
          <Field label="Property type" value={listing.property_type} />
          <Field label="Status" value={listing.status} />
          <Field label="Commute (car)" value={listing.commute_school_car} />
          <Field label="Commute (transit)" value={listing.commute_pvm_transit} />
          <Field label="Criteria" value={criteriaFlags} />
          <NotesField
            value={listing.notes}
            onSave={next => updateListing(listing.id, 'notes', next)}
          />
        </div>

        {listing.centris_link && (
          <a
            href={listing.centris_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full text-center py-3 rounded-lg bg-accent text-accent-fg font-medium hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 transition-colors"
          >
            Open on Centris
          </a>
        )}
      </section>
    </main>
  )
}
