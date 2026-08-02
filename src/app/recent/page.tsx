'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useListings } from '@/hooks/useListings'
import { ListingCard } from '@/components/ListingCard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { filterListings } from '@/lib/search-listings'

export default function RecentPage() {
  const router = useRouter()
  const { listings, deleteListing, fetchListings, trashCount } = useListings()

  const [query, setQuery] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const sorted = [...listings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const searched = filterListings(sorted, query)

  function onTapCard(id: string) {
    router.push(`/recent/${id}`)
  }

  async function onDeleteCard(id: string) {
    const ok = await deleteListing(id)
    if (!ok) {
      setDeleteError("Couldn't delete — try again")
      return
    }
    setDeleteError(null)
    await fetchListings()
  }

  return (
    <main className="min-h-screen bg-bg pb-8">
      <header className="sticky top-0 z-10 bg-surface border-b border-border h-14 px-4 flex items-center justify-between gap-2">
        <div className="font-bold text-fg">HouseHunter</div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
          <Link href="/trash" className="relative flex items-center gap-1 text-fg-muted" aria-label={`Trash (${trashCount})`}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.75 1A1.75 1.75 0 007 2.75V3H3.5a.75.75 0 000 1.5h.62l.77 11.55A2.25 2.25 0 007.13 18h5.74a2.25 2.25 0 002.24-1.95L15.88 4.5h.62a.75.75 0 000-1.5H13v-.25A1.75 1.75 0 0011.25 1h-2.5z" clipRule="evenodd" />
          </svg>
          {trashCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {trashCount}
            </span>
          )}
          </Link>
        </div>
      </header>

      <section className="p-4 space-y-3">
        <div className="relative sticky top-14 z-10 bg-bg py-1 -my-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
            placeholder="Search address or notes…"
            aria-label="Search listings"
            className="w-full border border-border-strong rounded-lg pl-3 pr-9 py-2.5 text-sm bg-surface text-fg placeholder:text-fg-subtle"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-fg-subtle"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          )}
        </div>
        {deleteError && (
          <div className="text-sm text-red-600 dark:text-red-300">{deleteError}</div>
        )}

        {searched.length === 0 ? (
          <div className="text-center text-fg-subtle text-sm py-12 px-4">
            No listings yet — share one from the Centris app.
          </div>
        ) : (
          <div className="space-y-2">
            {searched.map(l => (
              <ListingCard key={l.id} listing={l} onTap={onTapCard} onDelete={onDeleteCard} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
