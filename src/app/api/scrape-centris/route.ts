import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCentrisHtml } from '@/lib/centris-parser'
import { recalculateListing } from '@/lib/calculations'
import { calculateAndStoreCommute } from '@/lib/commute'

export async function POST(req: Request) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url = body.url?.trim()
  if (!url) {
    return NextResponse.json(
      { error: 'Please provide a valid Centris URL' },
      { status: 400 }
    )
  }
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json(
      { error: 'Please provide a valid Centris URL' },
      { status: 400 }
    )
  }
  if (
    parsedUrl.protocol !== 'https:' ||
    (parsedUrl.hostname !== 'www.centris.ca' && parsedUrl.hostname !== 'centris.ca')
  ) {
    return NextResponse.json(
      { error: 'Please provide a valid Centris URL' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // --- Duplicate check ---
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('centris_link', url)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', listingId: existing.id },
      { status: 409 }
    )
  }

  // --- Fetch the Centris page ---
  let html: string
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-CA,en;q=0.9,fr-CA;q=0.8,fr;q=0.7',
      },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return NextResponse.json(
        { error: `Centris returned HTTP ${res.status}` },
        { status: 502 }
      )
    }
    html = await res.text()
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown fetch error'
    return NextResponse.json(
      { error: `Could not fetch Centris page: ${msg}` },
      { status: 502 }
    )
  }

  // --- Parse ---
  const parsed = parseCentrisHtml(html)

  // --- Calculate derived fields ---
  const calculated = recalculateListing({
    price: parsed.price,
    taxes_yearly: parsed.taxes_yearly,
    common_fees_yearly: parsed.common_fees_yearly,
    hydro_yearly: null,
    liveable_area_sqft: parsed.liveable_area_sqft,
  })

  // --- Insert ---
  const { data: inserted, error: insertErr } = await supabase
    .from('listings')
    .insert({
      centris_link: url,
      location: parsed.location,
      full_address: parsed.full_address,
      property_type: parsed.property_type,
      price: parsed.price,
      taxes_yearly: parsed.taxes_yearly,
      common_fees_yearly: parsed.common_fees_yearly,
      bedrooms: parsed.bedrooms,
      liveable_area_sqft: parsed.liveable_area_sqft,
      parking: parsed.parking,
      year_built: parsed.year_built,
      image_url: parsed.image_url,
      latitude: parsed.lat,
      longitude: parsed.lon,
      downpayment: calculated.downpayment,
      monthly_mortgage: calculated.monthly_mortgage,
      total_monthly_cost: calculated.total_monthly_cost,
      price_per_sqft: calculated.price_per_sqft,
    })
    .select()
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'Failed to insert listing' },
      { status: 500 }
    )
  }

  // --- Commute ---
  let commuteNote: string | null = null
  if (parsed.lat != null && parsed.lon != null) {
    const result = await calculateAndStoreCommute(inserted.id, parsed.lat, parsed.lon)
    if (!result.ok) commuteNote = 'Commute calculation failed'
  } else {
    commuteNote = 'No coordinates found — commute not calculated'
  }

  return NextResponse.json({
    listing: inserted,
    commuteNote,
  })
}
