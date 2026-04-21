import type { SupabaseClient } from '@supabase/supabase-js'
import { checkListingStatus } from './status-check'

export interface RefreshSummary {
  checked: number
  unavailable: number
  priceChanged: number
  errors: number
}

interface ActiveRow {
  id: string
  centris_link: string | null
  price: number | null
  status: string
}

const CONCURRENCY = 10

async function runInBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    await Promise.all(chunk.map(fn))
  }
}

export async function refreshAllStatuses(supabase: SupabaseClient): Promise<RefreshSummary> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, centris_link, price, status')
    .eq('status', 'active')
    .is('deleted_at', null)

  if (error) throw error

  const rows = (data ?? []) as ActiveRow[]
  const summary: RefreshSummary = { checked: 0, unavailable: 0, priceChanged: 0, errors: 0 }

  await runInBatches(rows, CONCURRENCY, async (row) => {
    if (!row.centris_link) return

    summary.checked++
    const now = new Date().toISOString()

    try {
      const result = await checkListingStatus(row.centris_link)

      if (result.status === 'unavailable') {
        summary.unavailable++
        const { error: updateErr } = await supabase
          .from('listings')
          .update({ status: 'unavailable', status_checked_at: now })
          .eq('id', row.id)
        if (updateErr) throw updateErr
        return
      }

      const newPrice = result.price
      const priceChanged = newPrice !== null && newPrice !== row.price

      if (priceChanged) {
        summary.priceChanged++
        const { error: updateErr } = await supabase
          .from('listings')
          .update({
            price: newPrice,
            previous_price: row.price,
            price_changed_at: now,
            status_checked_at: now,
          })
          .eq('id', row.id)
        if (updateErr) throw updateErr
      } else {
        const { error: updateErr } = await supabase
          .from('listings')
          .update({ status_checked_at: now })
          .eq('id', row.id)
        if (updateErr) throw updateErr
      }
    } catch (err) {
      summary.errors++
      console.error(`[refresh-statuses] failed for listing ${row.id}:`, err)
    }
  })

  return summary
}
