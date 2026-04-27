'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ThemeToggle } from '@/components/ThemeToggle'

type Status =
  | { kind: 'loading'; stage: 'inserting' | 'commutes' }
  | {
      kind: 'success'
      id: string
      commuteSchool: string | null
      commutePvm: string | null
      commuteError: string | null
    }
  | { kind: 'duplicate'; id: string }
  | { kind: 'error'; message: string }

export function AddListingClient() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>({ kind: 'loading', stage: 'inserting' })
  const didRun = useRef(false)

  const url = searchParams.get('url')
  const addrParam = searchParams.get('addr')
  const fullAddress = addrParam && addrParam.trim() !== '' ? addrParam : null
  const location = searchParams.get('location')
  const type = searchParams.get('type')
  const priceParam = searchParams.get('price')
  const price = priceParam ? Number(priceParam) : null
  const taxesParam = searchParams.get('taxes')
  const taxes = taxesParam ? Number(taxesParam) : null
  const feesParam = searchParams.get('fees')
  const fees = feesParam ? Number(feesParam) : null
  const bedrooms = searchParams.get('bedrooms')
  const areaParam = searchParams.get('area')
  const area = areaParam ? Number(areaParam) : null
  const parking = searchParams.get('parking')
  const yearParam = searchParams.get('year')
  const yearBuilt = yearParam ? Number(yearParam) : null
  const latParam = searchParams.get('lat')
  const lonParam = searchParams.get('lon')
  const lat = latParam != null && latParam !== '' ? Number(latParam) : null
  const lon = lonParam != null && lonParam !== '' ? Number(lonParam) : null
  const imgParam = searchParams.get('img')
  const imageUrl = imgParam && imgParam.trim() !== '' ? imgParam : null

  const priceNum = price != null && Number.isFinite(price) ? price : null
  const taxesNum = taxes != null && Number.isFinite(taxes) ? taxes : null
  const feesNum = fees != null && Number.isFinite(fees) ? fees : null
  const areaNum = area != null && Number.isFinite(area) ? area : null

  const downpayment = priceNum != null ? Math.round(priceNum * 0.2) : null
  const monthlyMortgage = priceNum != null ? calcMonthlyMortgage(priceNum) : null
  const totalMonthlyCost =
    monthlyMortgage != null
      ? monthlyMortgage +
        (taxesNum != null ? Math.round(taxesNum / 12) : 0) +
        (feesNum != null ? Math.round(feesNum / 12) : 0)
      : null
  const pricePerSqft =
    priceNum != null && areaNum != null && areaNum > 0
      ? Math.round(priceNum / areaNum)
      : null

  useEffect(() => {
    if (didRun.current) return
    didRun.current = true

    const run = async () => {
      if (!url) {
        setStatus({ kind: 'error', message: 'Missing "url" query parameter.' })
        return
      }

      const { data: existing, error: selErr } = await supabase
        .from('listings')
        .select('id')
        .eq('centris_link', url)
        .maybeSingle()

      if (selErr) {
        setStatus({ kind: 'error', message: selErr.message })
        return
      }
      if (existing) {
        setStatus({ kind: 'duplicate', id: existing.id })
        return
      }

      const { data: created, error: insErr } = await supabase
        .from('listings')
        .insert({
          centris_link: url,
          location: location || null,
          full_address: fullAddress,
          property_type: type || null,
          price: price != null && Number.isFinite(price) ? price : null,
          taxes_yearly: taxes != null && Number.isFinite(taxes) ? taxes : null,
          common_fees_yearly: fees != null && Number.isFinite(fees) ? fees : null,
          bedrooms: bedrooms || null,
          liveable_area_sqft: area != null && Number.isFinite(area) ? area : null,
          parking: parking || null,
          year_built: yearBuilt != null && Number.isFinite(yearBuilt) ? yearBuilt : null,
          downpayment,
          monthly_mortgage: monthlyMortgage,
          total_monthly_cost: totalMonthlyCost,
          price_per_sqft: pricePerSqft,
          image_url: imageUrl,
        })
        .select('id')
        .single()

      if (insErr || !created) {
        setStatus({ kind: 'error', message: insErr?.message ?? 'Insert failed.' })
        return
      }

      // Insert succeeded — now fetch commute times via our API route.
      // If we don't have coordinates or the API call fails, we still report
      // the listing as successfully added (just with no commute values).
      if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
        setStatus({
          kind: 'success',
          id: created.id,
          commuteSchool: null,
          commutePvm: null,
          commuteError: 'No coordinates captured from Centris — commute times not fetched.',
        })
        return
      }

      setStatus({ kind: 'loading', stage: 'commutes' })

      try {
        const res = await fetch('/api/commute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId: created.id, lat, lon }),
        })
        const payload = (await res.json()) as {
          school?: string | null
          pvm?: string | null
          error?: string
        }
        if (!res.ok) {
          setStatus({
            kind: 'success',
            id: created.id,
            commuteSchool: null,
            commutePvm: null,
            commuteError: payload.error ?? `Commute API returned ${res.status}`,
          })
          return
        }
        setStatus({
          kind: 'success',
          id: created.id,
          commuteSchool: payload.school ?? null,
          commutePvm: payload.pvm ?? null,
          commuteError: null,
        })
      } catch (e) {
        setStatus({
          kind: 'success',
          id: created.id,
          commuteSchool: null,
          commutePvm: null,
          commuteError: e instanceof Error ? e.message : 'Commute fetch failed.',
        })
      }
    }

    run()
  }, [
    url,
    fullAddress,
    location,
    type,
    price,
    taxes,
    fees,
    bedrooms,
    area,
    parking,
    yearBuilt,
    downpayment,
    monthlyMortgage,
    totalMonthlyCost,
    pricePerSqft,
    lat,
    lon,
    imageUrl,
  ])

  useEffect(() => {
    if (status.kind !== 'success' && status.kind !== 'duplicate') return
    const t = setTimeout(() => window.close(), 3000)
    return () => clearTimeout(t)
  }, [status.kind])

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-8">
      <div className="w-full max-w-lg">
        {status.kind === 'loading' && (
          <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
            <div className="text-fg-subtle text-sm">
              {status.stage === 'inserting'
                ? 'Adding listing to HouseHunter...'
                : 'Calculating commute times...'}
            </div>
          </div>
        )}

        {status.kind === 'success' && (
          <div className="bg-surface border-2 border-green-500 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-semibold text-lg mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Added to HouseHunter
            </div>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Listing photo"
                className="w-full h-40 object-cover rounded-lg border border-border mb-4"
              />
            )}
            <dl className="text-sm text-fg-muted space-y-1.5 mb-4">
              <Field label="Type" value={type} />
              <Field label="Address" value={fullAddress} />
              <Field label="Location" value={location} />
              <Field label="Bedrooms" value={bedrooms} />
              <Field label="Area" value={area != null ? `${area.toLocaleString('en-CA')} sqft` : null} />
              <Field label="Parking" value={parking} />
              <Field label="Year built" value={yearBuilt != null ? String(yearBuilt) : null} />
              <Field label="Price" value={price != null ? `$${price.toLocaleString('en-CA')}` : null} />
              <Field label="Taxes/yr" value={taxes != null ? `$${taxes.toLocaleString('en-CA')}` : null} />
              <Field label="Fees/yr" value={fees != null ? `$${fees.toLocaleString('en-CA')}` : null} />
              <Field label="School (car)" value={status.commuteSchool} />
              <Field label="PVM (transit)" value={status.commutePvm} />
              <Field label="Centris link" value={url} href={safeHref(url)} />
            </dl>
            {status.commuteError && (
              <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-4">
                Commute times unavailable: {status.commuteError}
              </p>
            )}
            <Link
              href="/"
              className="inline-block px-4 py-2 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 transition-colors"
            >
              Open HouseHunter
            </Link>
          </div>
        )}

        {status.kind === 'duplicate' && (
          <div className="bg-surface border-2 border-amber-500 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-semibold text-lg mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 6v4M10 14h.01" strokeLinecap="round" />
                <circle cx="10" cy="10" r="8" />
              </svg>
              Already in HouseHunter
            </div>
            <p className="text-sm text-fg-muted mb-4">
              This Centris listing is already in your database. Nothing was added.
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 transition-colors"
            >
              Open HouseHunter
            </Link>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="bg-surface border-2 border-red-500 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold text-lg mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
              </svg>
              Could not add listing
            </div>
            <p className="text-sm text-fg-muted mb-4 font-mono bg-bg p-3 rounded border border-border">
              {status.message}
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 text-sm font-medium text-fg-muted bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors"
            >
              Open HouseHunter
            </Link>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

// 20% down, 3.99% annual, 25-year amortization.
function calcMonthlyMortgage(price: number): number {
  const principal = price * 0.8
  const r = 0.0399 / 12
  const n = 25 * 12
  const factor = Math.pow(1 + r, n)
  return Math.round((principal * (r * factor)) / (factor - 1))
}

function safeHref(u: string | null): string | undefined {
  if (!u) return undefined
  try {
    const p = new URL(u)
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.toString() : undefined
  } catch {
    return undefined
  }
}

function Field({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-fg-subtle w-24 shrink-0">{label}</dt>
      <dd className="text-fg-muted truncate">
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-fg-subtle">—</span>
        )}
      </dd>
    </div>
  )
}
