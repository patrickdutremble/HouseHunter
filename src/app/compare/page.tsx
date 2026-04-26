'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getBestValues, type BestMap } from '@/lib/comparison'
import { criteria, countChecked, deriveCriteria, isDerivedCriterion, type CriterionKey } from '@/lib/criteria'
import { formatCellValue } from '@/lib/formatting'
import type { ColumnFormat } from '@/lib/columns'
import type { Listing } from '@/types/listing'

interface CompareField {
  key: string
  label: string
  format: ColumnFormat
}

const compareFields: CompareField[] = [
  { key: 'price', label: 'Price', format: 'currency' },
  { key: 'property_type', label: 'Type', format: 'text' },
  { key: 'bedrooms', label: 'Bedrooms', format: 'text' },
  { key: 'liveable_area_sqft', label: 'Area (sqft)', format: 'integer' },
  { key: 'price_per_sqft', label: '$/sqft', format: 'currency' },
  { key: 'parking', label: 'Parking', format: 'text' },
  { key: 'year_built', label: 'Year Built', format: 'year' },
  { key: 'taxes_yearly', label: 'Taxes/yr', format: 'currency' },
  { key: 'common_fees_yearly', label: 'Fees/yr', format: 'currency' },
  { key: 'hydro_yearly', label: 'Hydro/yr', format: 'currency' },
  { key: 'downpayment', label: 'Downpayment', format: 'currency' },
  { key: 'monthly_mortgage', label: 'Mortgage/mo', format: 'currency' },
  { key: 'total_monthly_cost', label: 'Total/mo', format: 'currency' },
  { key: 'commute_school_car', label: 'School (car)', format: 'duration' },
  { key: 'commute_pvm_transit', label: 'PVM (transit)', format: 'duration' },
  { key: 'notes', label: 'Notes', format: 'text' },
]

function CompareContent() {
  const searchParams = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const listingsRef = useRef(listings)
  listingsRef.current = listings
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  async function copyCompareLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  useEffect(() => {
    async function fetchListings() {
      const idsParam = searchParams.get('ids')
      if (!idsParam) {
        setLoading(false)
        return
      }

      const ids = idsParam.split(',').slice(0, 5)
      const { data, error } = await supabase
        .from('listings')
        .select('*')
        .in('id', ids)
        .is('deleted_at', null)

      if (error) console.error('Failed to fetch listings for comparison:', error)
      setListings(data ?? [])
      setLoading(false)
    }

    fetchListings()
  }, [searchParams])

  async function toggleCriterion(id: string, key: CriterionKey, value: boolean) {
    const current = listingsRef.current.find(l => l.id === id)?.criteria ?? {}
    const next = { ...current, [key]: value }
    const updated = listingsRef.current.map(l =>
      l.id === id ? { ...l, criteria: next } : l
    )
    listingsRef.current = updated
    setListings(updated)

    const { error } = await supabase
      .from('listings')
      .update({ criteria: next })
      .eq('id', id)
    if (error) console.error('Failed to update criteria:', error)
  }

  const bestValues = useMemo(() => getBestValues(listings), [listings])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-fg-subtle text-sm">Loading comparison...</div>
      </div>
    )
  }

  if (listings.length < 2) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-bg gap-4">
        <p className="text-fg-subtle text-sm">Select at least 2 listings to compare.</p>
        <Link
          href="/"
          className="px-4 py-2 text-sm font-medium text-accent hover:text-sky-700 dark:hover:text-sky-200 hover:bg-blue-50 dark:hover:bg-sky-900/40 rounded-lg transition-colors"
        >
          Back to listings
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 text-fg-subtle hover:text-fg-muted hover:bg-surface-muted rounded-lg transition-colors"
            title="Back to listings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-fg">
            Compare Listings
            <span className="ml-2 text-sm font-normal text-fg-subtle">
              ({listings.length} listings)
            </span>
          </h1>
          <button
            type="button"
            onClick={copyCompareLink}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              copied
                ? 'text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30'
                : 'text-fg-muted hover:text-fg hover:bg-surface-muted'
            }`}
            title="Copy shareable comparison link"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Comparison grid */}
      <div className="px-6 py-6">
        <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${listings.length}, minmax(0, 1fr))` }}>
          {/* Images */}
          {listings.map(listing => (
            <div key={listing.id} className="bg-surface rounded-lg border border-border shadow-sm overflow-hidden">
              {/* Image */}
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt=""
                  className="w-full h-[180px] object-cover"
                />
              ) : (
                <div className="w-full h-[180px] bg-surface-muted flex items-center justify-center">
                  <svg className="text-fg-subtle" width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Location header */}
              <div className="px-4 py-3 border-b border-border">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.full_address ?? listing.location ?? '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-fg hover:text-accent transition-colors"
                >
                  {listing.location ?? 'Unknown location'}
                </a>
                {listing.centris_link && (
                  <a
                    href={listing.centris_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-accent hover:text-sky-700 dark:hover:text-sky-200"
                  >
                    Centris &#8599;
                  </a>
                )}
              </div>

              {/* Criteria section */}
              <div className="divide-y divide-border">
                <div
                  className={`flex items-start justify-between px-4 py-2 ${bestValues.criteria_count.has(listing.id) ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                >
                  <span className="text-xs font-medium text-fg-subtle uppercase tracking-wide shrink-0">
                    Criteria met
                  </span>
                  <span className={`text-sm text-right ${bestValues.criteria_count.has(listing.id) ? 'text-green-700 dark:text-green-300 font-medium' : 'text-fg-muted'}`}>
                    {countChecked(deriveCriteria(listing))} / {criteria.length}
                  </span>
                </div>
                {criteria.map(c => {
                  const derived = deriveCriteria(listing)
                  const checked = derived[c.key]
                  const isDerived = isDerivedCriterion(c.key)
                  const rowIsBest = bestValues[c.key]?.has(listing.id) ?? false
                  return (
                    <div
                      key={`crit-${c.key}`}
                      className={`flex items-center justify-between px-4 py-2 ${rowIsBest ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                    >
                      <span className={`text-xs font-medium uppercase tracking-wide shrink-0 ${rowIsBest ? 'text-green-700 dark:text-green-300' : 'text-fg-subtle'}`}>
                        {c.label}
                      </span>
                      <input
                        type="checkbox"
                        aria-label={c.label}
                        checked={checked}
                        disabled={isDerived}
                        title={isDerived ? 'Auto-derived from listing data' : undefined}
                        onChange={isDerived ? undefined : () => {
                          toggleCriterion(listing.id, c.key, !checked)
                        }}
                        className={`w-4 h-4 rounded border-border-strong text-accent focus:ring-accent ${isDerived ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Data rows */}
              <div className="divide-y divide-border">
                {compareFields.map(field => {
                  const value = listing[field.key as keyof Listing]
                  const isBest = field.key in bestValues
                    && (bestValues as Record<string, Set<string>>)[field.key].has(listing.id)
                  const formatted = formatCellValue(value, field.format)

                  return (
                    <div
                      key={field.key}
                      className={`flex items-start justify-between px-4 py-2 ${isBest ? 'bg-green-50 dark:bg-green-900/30' : ''}`}
                    >
                      <span className="text-xs font-medium text-fg-subtle uppercase tracking-wide shrink-0">
                        {field.label}
                      </span>
                      <span className={`text-sm text-right ${isBest ? 'text-green-700 dark:text-green-300 font-medium' : 'text-fg-muted'} ${field.key === 'notes' ? 'whitespace-pre-wrap text-xs' : ''}`}>
                        {formatted}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center bg-bg">
          <div className="text-fg-subtle text-sm">Loading comparison...</div>
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  )
}
