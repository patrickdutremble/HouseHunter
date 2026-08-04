'use client'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useListings } from '@/hooks/useListings'
import { FavoriteButton } from '@/components/FavoriteButton'
import { NotesField } from '@/components/NotesField'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import type { Listing } from '@/types/listing'

// If router.replace hasn't unmounted us by now, navigation stalled — fall back
// to the not-found screen so the user isn't stranded on a blank page.
const NAV_FALLBACK_MS = 5000

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

export default function DetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { listings, updateListing, deleteListing } = useListings()
  // Shared by the favorite toggle and the delete button. Both clear it before
  // starting, so the message on screen always describes the latest action.
  const [actionError, setActionError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const listing: Listing | undefined = listings.find(l => l.id === params.id)

  useEffect(() => {
    if (!deleting) return
    const timer = setTimeout(() => setDeleting(false), NAV_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [deleting])

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length <= 1) {
      router.push('/recent')
    } else {
      router.back()
    }
  }

  if (!listing) {
    // A successful delete already dropped this listing from local state.
    // Hold a blank screen briefly, until router.replace lands, rather than
    // flashing "Listing not found".
    if (deleting) return null
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
    setActionError(null)
    const ok = await updateListing(listing.id, 'favorite', !listing.favorite)
    if (!ok) {
      setActionError("Couldn't update favorite — try again")
      return
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Move this listing to the trash?')) return
    setActionError(null)
    setDeleting(true)
    // deleteListing resolves false on a Supabase error rather than rejecting,
    // but catch anyway — nothing should be able to navigate us away from a
    // listing that wasn't actually deleted.
    const ok = await deleteListing(listing.id).catch(() => false)
    if (!ok) {
      setActionError("Couldn't delete — try again")
      setDeleting(false)
      return
    }
    // Stays true on success — the component unmounts when the route changes.
    router.replace('/recent')
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
            disabled={deleting}
          />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>

      {actionError && (
        <div role="alert" className="px-4 text-sm text-red-600 dark:text-red-300">{actionError}</div>
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
          {/* Notes leads on mobile — it's the field most often edited on a phone.
              Desktop keeps its own order in DetailPanel. */}
          <NotesField
            value={listing.notes}
            onSave={next => updateListing(listing.id, 'notes', next)}
          />
          <Field label="Bedrooms" value={listing.bedrooms ? `${listing.bedrooms} bdr` : null} />
          <Field label="Area" value={listing.liveable_area_sqft ? `${listing.liveable_area_sqft} sqft` : null} />
          <Field label="Property type" value={listing.property_type} />
          <Field label="Status" value={listing.status} />
          <Field label="Commute (car)" value={listing.commute_school_car} />
          <Field label="Commute (transit)" value={listing.commute_pvm_transit} />
          <Field label="Criteria" value={criteriaFlags} />
        </div>

        {/* Wrapper owns the top margin and the gap so the delete button is
            spaced correctly whether or not the Centris link is rendered. */}
        <div className="mt-6 space-y-3">
          {listing.centris_link && (
            <a
              href={listing.centris_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 rounded-lg bg-accent text-accent-fg font-medium hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 transition-colors"
            >
              Open on Centris
            </a>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label={deleting ? 'Deleting…' : undefined}
            className="block w-full text-center py-3 rounded-lg border border-red-600 dark:border-red-400 text-red-600 dark:text-red-300 font-medium disabled:opacity-50 active:bg-red-50 dark:active:bg-red-900/30 transition-colors"
          >
            Delete listing
          </button>
        </div>
      </section>
    </main>
  )
}
