import { NextResponse } from 'next/server'
import { calculateAndStoreCommute } from '@/lib/commute'

export async function POST(req: Request) {
  let body: { listingId?: string; lat?: number | string; lon?: number | string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const listingId = body.listingId
  const lat = Number(body.lat)
  const lon = Number(body.lon)

  if (!listingId || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: 'Missing listingId, lat, or lon' }, { status: 400 })
  }

  if (!process.env.GOOGLE_MAPS_API_KEY) {
    return NextResponse.json({ error: 'GOOGLE_MAPS_API_KEY not configured on the server' }, { status: 500 })
  }

  const result = await calculateAndStoreCommute(listingId, lat, lon)

  if (!result.ok) {
    return NextResponse.json({ error: 'Commute calculation failed' }, { status: 500 })
  }

  return NextResponse.json({ school: result.school, pvm: result.pvm, skipped: result.skipped })
}
