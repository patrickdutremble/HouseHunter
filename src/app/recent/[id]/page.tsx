'use client'
import { useRouter, useParams } from 'next/navigation'
import { useListings } from '@/hooks/useListings'
import type { Listing } from '@/types/listing'

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return '$' + price.toLocaleString('en-CA')
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div className="py-2 border-b border-slate-100">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-900">{value}</div>
    </div>
  )
}

export default function DetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { listings } = useListings()

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
      <main className="min-h-screen bg-slate-50 p-4">
        <button type="button" onClick={handleBack} className="text-slate-700 text-sm" aria-label="Back">← Back</button>
        <div className="mt-8 text-center text-slate-500">Listing not found</div>
      </main>
    )
  }

  const criteriaFlags = listing.criteria
    ? Object.entries(listing.criteria)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ')
    : null

  return (
    <main className="min-h-screen bg-slate-50 pb-8">
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={handleBack}
          className="text-slate-700 text-sm"
          aria-label="Back"
        >
          ← Back
        </button>
      </div>

      {listing.image_url ? (
        <img
          src={listing.image_url}
          alt=""
          className="w-full aspect-video object-cover bg-slate-100"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      ) : (
        <div className="w-full aspect-video bg-slate-100" />
      )}

      <section className="p-4">
        <div className="text-slate-900 font-medium">{listing.full_address ?? listing.location ?? '—'}</div>
        <div className="text-3xl font-bold mt-1">{formatPrice(listing.price)}</div>

        <div className="mt-4 divide-y divide-slate-100">
          <Field label="Bedrooms" value={listing.bedrooms ? `${listing.bedrooms} bdr` : null} />
          <Field label="Area" value={listing.liveable_area_sqft ? `${listing.liveable_area_sqft} sqft` : null} />
          <Field label="Property type" value={listing.property_type} />
          <Field label="Status" value={listing.status} />
          <Field label="Commute (car)" value={listing.commute_school_car} />
          <Field label="Commute (transit)" value={listing.commute_pvm_transit} />
          <Field label="Criteria" value={criteriaFlags} />
          <Field label="Notes" value={listing.notes} />
        </div>

        {listing.centris_link && (
          <a
            href={listing.centris_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full text-center py-3 rounded-lg bg-slate-900 text-white font-medium"
          >
            Open on Centris
          </a>
        )}
      </section>
    </main>
  )
}
