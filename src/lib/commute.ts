import { supabase } from '@/lib/supabase'

const SCHOOL_DESTINATION = 'Secondary School Leblanc, Terrebonne, QC'
const PVM_DESTINATION = '1 Place Ville Marie, Montreal, QC'
const TZ = 'America/Toronto'

type DirectionsResponse = {
  status: string
  routes?: Array<{ legs?: Array<{ duration?: { value?: number } }> }>
  error_message?: string
}

export async function calculateAndStoreCommute(
  listingId: string,
  lat: number,
  lon: number
): Promise<{ ok: boolean; school: string | null; pvm: string | null; skipped?: boolean }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return { ok: false, school: null, pvm: null }

  // Guard: skip if already has commute values
  const { data: existing } = await supabase
    .from('listings')
    .select('commute_school_car, commute_pvm_transit')
    .eq('id', listingId)
    .maybeSingle()

  if (existing?.commute_school_car && existing?.commute_pvm_transit) {
    return { ok: true, school: existing.commute_school_car, pvm: existing.commute_pvm_transit, skipped: true }
  }

  const origin = `${lat},${lon}`
  const arrivalSec = nextMonday9amMontrealUnixSec()

  const [schoolMin, pvmMin] = await Promise.all([
    fetchDriveMinutes(origin, SCHOOL_DESTINATION, apiKey),
    fetchTransitMinutes(origin, PVM_DESTINATION, arrivalSec, apiKey),
  ])

  const schoolText = schoolMin != null ? `${schoolMin} min` : null
  const pvmText = pvmMin != null ? `${pvmMin} min` : null

  const { error: updErr } = await supabase
    .from('listings')
    .update({ commute_school_car: schoolText, commute_pvm_transit: pvmText })
    .eq('id', listingId)

  if (updErr) return { ok: false, school: schoolText, pvm: pvmText }
  return { ok: true, school: schoolText, pvm: pvmText }
}

async function fetchDriveMinutes(origin: string, destination: string, apiKey: string): Promise<number | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', origin)
  url.searchParams.set('destination', destination)
  url.searchParams.set('mode', 'driving')
  url.searchParams.set('region', 'ca')
  url.searchParams.set('language', 'en')
  url.searchParams.set('key', apiKey)
  const res = await fetch(url, { cache: 'no-store' })
  return parseDurationMinutes(await res.json())
}

async function fetchTransitMinutes(origin: string, destination: string, arrivalSec: number, apiKey: string): Promise<number | null> {
  const url = new URL('https://maps.googleapis.com/maps/api/directions/json')
  url.searchParams.set('origin', origin)
  url.searchParams.set('destination', destination)
  url.searchParams.set('mode', 'transit')
  url.searchParams.set('arrival_time', String(arrivalSec))
  url.searchParams.set('region', 'ca')
  url.searchParams.set('language', 'en')
  url.searchParams.set('key', apiKey)
  const res = await fetch(url, { cache: 'no-store' })
  return parseDurationMinutes(await res.json())
}

function parseDurationMinutes(data: DirectionsResponse): number | null {
  if (data.status !== 'OK' || !data.routes?.length) return null
  const seconds = data.routes[0].legs?.[0]?.duration?.value
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null
  return Math.round(seconds / 60)
}

function nextMonday9amMontrealUnixSec(): number {
  const now = new Date()
  const nowParts = montrealParts(now)
  const dow = weekdayToNum(nowParts.weekday)
  let daysUntilMonday = (1 + 7 - dow) % 7
  if (daysUntilMonday === 0 && nowParts.hour >= 9) daysUntilMonday = 7
  const base = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day))
  base.setUTCDate(base.getUTCDate() + daysUntilMonday)
  const targetY = base.getUTCFullYear()
  const targetM = base.getUTCMonth() + 1
  const targetD = base.getUTCDate()
  for (const utcHour of [13, 14]) {
    const candidate = new Date(Date.UTC(targetY, targetM - 1, targetD, utcHour, 0, 0))
    const p = montrealParts(candidate)
    if (p.year === targetY && p.month === targetM && p.day === targetD && p.hour === 9) {
      return Math.floor(candidate.getTime() / 1000)
    }
  }
  return Math.floor(Date.UTC(targetY, targetM - 1, targetD, 14, 0, 0) / 1000)
}

function montrealParts(d: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false, weekday: 'short',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')), weekday: get('weekday') }
}

function weekdayToNum(short: string): number {
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[short] ?? 0
}
