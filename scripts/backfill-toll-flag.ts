import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

const SCHOOL_DESTINATION = 'Secondary School Leblanc, Terrebonne, QC'

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function main() {
  // Dynamic imports so env is loaded before ../src/lib/supabase runs createClient.
  const { fetchDriveRoute } = await import('../src/lib/commute')
  const { supabase } = await import('../src/lib/supabase')

  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY missing from .env.local')
    process.exit(1)
  }

  const { data, error } = await supabase
    .from('listings')
    .select('id, latitude, longitude')
    .is('commute_school_has_toll', null)
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .is('deleted_at', null)

  if (error) {
    console.error('Select failed:', error)
    process.exit(1)
  }

  console.log(`Backfilling ${data.length} listings...`)

  let ok = 0
  let failed = 0
  for (const row of data) {
    const origin = `${row.latitude},${row.longitude}`
    const result = await fetchDriveRoute(origin, SCHOOL_DESTINATION, apiKey)

    if (!result) {
      failed += 1
      console.warn(`  ${row.id}: FAILED (API returned null)`)
      await sleep(150)
      continue
    }

    const { error: updErr } = await supabase
      .from('listings')
      .update({
        commute_school_car: `${result.minutes} min`,
        commute_school_has_toll: result.hasToll,
      })
      .eq('id', row.id)

    if (updErr) {
      failed += 1
      console.warn(`  ${row.id}: UPDATE FAILED — ${updErr.message}`)
    } else {
      ok += 1
      console.log(`  ${row.id}: school=${result.minutes} min, toll=${result.hasToll}`)
    }

    await sleep(150)
  }

  console.log(`Done. ok=${ok} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
