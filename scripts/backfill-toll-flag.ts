import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

async function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function main() {
  // Dynamic imports so env is loaded before ../src/lib/supabase runs createClient.
  const { calculateAndStoreCommute } = await import('../src/lib/commute')
  const { supabase } = await import('../src/lib/supabase')

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
    const result = await calculateAndStoreCommute(
      row.id,
      row.latitude as number,
      row.longitude as number
    )
    if (result.ok) {
      ok += 1
      console.log(`  ${row.id}: school=${result.school}`)
    } else {
      failed += 1
      console.warn(`  ${row.id}: FAILED`)
    }
    await sleep(150)
  }

  console.log(`Done. ok=${ok} failed=${failed}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
