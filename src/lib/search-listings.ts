import type { Listing } from '@/types/listing'

/**
 * Case-insensitive substring filter over a listing's address and notes.
 * An empty/whitespace query returns the input list unchanged.
 */
export function filterListings(listings: Listing[], query: string): Listing[] {
  const q = query.trim().toLowerCase()
  if (!q) return listings
  return listings.filter(l =>
    [l.location, l.full_address, l.notes].some(
      f => (f ?? '').toLowerCase().includes(q)
    )
  )
}
