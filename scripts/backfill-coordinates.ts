import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { parseCentrisHtml } from '../src/lib/centris-parser'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or (SUPABASE_SERVICE_ROLE_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY) in env'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, centris_link')
    .is('latitude', null)
    .not('centris_link', 'is', null)

  if (error) {
    console.error('Query failed:', error.message)
    process.exit(1)
  }

  console.log(`Found ${listings?.length ?? 0} listings to backfill`)
  let updated = 0
  let skipped = 0

  for (const listing of listings ?? []) {
    if (!listing.centris_link) { skipped++; continue }
    try {
      const res = await fetch(listing.centris_link, {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'accept-language': 'en-CA,en;q=0.9,fr-CA;q=0.8,fr;q=0.7',
        },
      })
      if (!res.ok) {
        console.warn(`[skip] ${listing.id} — HTTP ${res.status}`)
        skipped++
        continue
      }
      const html = await res.text()
      const parsed = parseCentrisHtml(html)
      if (parsed.lat == null || parsed.lon == null) {
        console.warn(`[skip] ${listing.id} — no coordinates in page`)
        skipped++
        continue
      }
      const { error: updErr } = await supabase
        .from('listings')
        .update({ latitude: parsed.lat, longitude: parsed.lon })
        .eq('id', listing.id)
      if (updErr) {
        console.warn(`[skip] ${listing.id} — update failed: ${updErr.message}`)
        skipped++
        continue
      }
      updated++
      console.log(`[ok]  ${listing.id} — ${parsed.lat}, ${parsed.lon}`)
    } catch (err) {
      console.warn(`[skip] ${listing.id} — ${err instanceof Error ? err.message : String(err)}`)
      skipped++
    }
    await sleep(1200) // be polite to Centris
  }

  console.log(`\nDone. Updated: ${updated}. Skipped: ${skipped}.`)
}

main()
