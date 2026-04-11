'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Status =
  | { kind: 'loading' }
  | { kind: 'success'; id: string }
  | { kind: 'duplicate'; id: string }
  | { kind: 'error'; message: string }

export function AddListingClient() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const didRun = useRef(false)

  const url = searchParams.get('url')
  const location = searchParams.get('location')
  const type = searchParams.get('type')
  const priceParam = searchParams.get('price')
  const price = priceParam ? Number(priceParam) : null
  const taxesParam = searchParams.get('taxes')
  const taxes = taxesParam ? Number(taxesParam) : null
  const feesParam = searchParams.get('fees')
  const fees = feesParam ? Number(feesParam) : null

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
          property_type: type || null,
          price: price != null && Number.isFinite(price) ? price : null,
          taxes_yearly: taxes != null && Number.isFinite(taxes) ? taxes : null,
          common_fees_yearly: fees != null && Number.isFinite(fees) ? fees : null,
        })
        .select('id')
        .single()

      if (insErr || !created) {
        setStatus({ kind: 'error', message: insErr?.message ?? 'Insert failed.' })
        return
      }
      setStatus({ kind: 'success', id: created.id })
    }

    run()
  }, [url, location, type, price, taxes, fees])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg">
        {status.kind === 'loading' && (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="text-slate-400 text-sm">Adding listing to HouseHunter...</div>
          </div>
        )}

        {status.kind === 'success' && (
          <div className="bg-white border-2 border-green-500 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-green-700 font-semibold text-lg mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Added to HouseHunter
            </div>
            <dl className="text-sm text-slate-600 space-y-1.5 mb-4">
              <Field label="Type" value={type} />
              <Field label="Location" value={location} />
              <Field label="Price" value={price != null ? `$${price.toLocaleString('en-CA')}` : null} />
              <Field label="Taxes/yr" value={taxes != null ? `$${taxes.toLocaleString('en-CA')}` : null} />
              <Field label="Fees/yr" value={fees != null ? `$${fees.toLocaleString('en-CA')}` : null} />
              <Field label="Centris link" value={url} href={url ?? undefined} />
            </dl>
            <Link
              href="/"
              className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open HouseHunter
            </Link>
          </div>
        )}

        {status.kind === 'duplicate' && (
          <div className="bg-white border-2 border-amber-500 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 font-semibold text-lg mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 6v4M10 14h.01" strokeLinecap="round" />
                <circle cx="10" cy="10" r="8" />
              </svg>
              Already in HouseHunter
            </div>
            <p className="text-sm text-slate-600 mb-4">
              This Centris listing is already in your database. Nothing was added.
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open HouseHunter
            </Link>
          </div>
        )}

        {status.kind === 'error' && (
          <div className="bg-white border-2 border-red-500 rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-red-700 font-semibold text-lg mb-3">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
              </svg>
              Could not add listing
            </div>
            <p className="text-sm text-slate-600 mb-4 font-mono bg-slate-50 p-3 rounded border border-slate-200">
              {status.message}
            </p>
            <Link
              href="/"
              className="inline-block px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Open HouseHunter
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-slate-400 w-24 shrink-0">{label}</dt>
      <dd className="text-slate-700 truncate">
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          <span className="text-slate-300">—</span>
        )}
      </dd>
    </div>
  )
}
