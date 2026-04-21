import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAllStatuses } from '@/lib/refresh-statuses'

export const maxDuration = 60

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)
  try {
    const summary = await refreshAllStatuses(supabase)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
