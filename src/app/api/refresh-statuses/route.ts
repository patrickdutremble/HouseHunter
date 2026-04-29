import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAllStatuses } from '@/lib/refresh-statuses'

export const maxDuration = 60

export async function POST() {
  try {
    const supabase = createAdminClient()
    const summary = await refreshAllStatuses(supabase)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[refresh-statuses] failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
