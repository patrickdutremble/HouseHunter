'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useListings } from '@/hooks/useListings'
import { ListingCard } from '@/components/ListingCard'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { extractCentrisUrl } from '@/lib/extract-centris-url'

type PasteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'duplicate' }
  | { kind: 'error'; message: string }

export default function RecentPage() {
  const router = useRouter()
  const { listings, deleteListing, fetchListings, trashCount } = useListings()

  const [url, setUrl] = useState('')
  const [paste, setPaste] = useState<PasteState>({ kind: 'idle' })

  const recent = [...listings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch {
      // Clipboard blocked — user can type the URL.
    }
  }

  async function handleAdd() {
    const trimmed = url.trim()
    if (!trimmed) return
    const extracted = extractCentrisUrl(trimmed) ?? trimmed
    setPaste({ kind: 'loading' })
    try {
      const res = await fetch('/api/scrape-centris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: extracted }),
      })
      let data: any
      try {
        data = await res.json()
      } catch {
        if (!res.ok) {
          setPaste({ kind: 'error', message: `Server error (${res.status})` })
        } else {
          setPaste({ kind: 'error', message: 'Unexpected server response' })
        }
        return
      }
      if (res.status === 409) {
        setPaste({ kind: 'duplicate' })
        return
      }
      if (!res.ok) {
        setPaste({ kind: 'error', message: data.error || 'Something went wrong' })
        return
      }
      await fetchListings()
      setUrl('')
      setPaste({ kind: 'success' })
    } catch {
      setPaste({ kind: 'error', message: 'Network error — check your connection' })
    }
  }

  function onTapCard(id: string) {
    router.push(`/recent/${id}`)
  }

  async function onDeleteCard(id: string) {
    const ok = await deleteListing(id)
    if (!ok) {
      setPaste({ kind: 'error', message: "Couldn't delete — try again" })
      return
    }
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
        <div className="bg-surface rounded-xl shadow-sm border border-border p-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => {
                setUrl(e.target.value)
                if (paste.kind !== 'loading' && paste.kind !== 'idle') {
                  setPaste({ kind: 'idle' })
                }
              }}
              placeholder="Paste a Centris URL"
              className="flex-1 border border-border-strong rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-3 py-2 rounded-lg bg-surface-muted text-fg text-sm"
            >
              Paste
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={paste.kind === 'loading' || !url.trim()}
            className="w-full py-3 rounded-lg bg-accent text-accent-fg font-medium hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 disabled:opacity-50 transition-colors"
          >
            {paste.kind === 'loading' ? 'Adding…' : 'Add'}
          </button>
          {paste.kind === 'success' && (
            <div className="text-sm text-green-700 dark:text-green-300">Added</div>
          )}
          {paste.kind === 'duplicate' && (
            <div className="text-sm text-amber-700 dark:text-amber-300">Already saved</div>
          )}
          {paste.kind === 'error' && (
            <div className="text-sm text-red-600 dark:text-red-300">{paste.message}</div>
          )}
        </div>

        <h2 className="text-xs uppercase tracking-wide text-fg-subtle font-semibold pt-2">Recent</h2>

        {recent.length === 0 ? (
          <div className="text-center text-fg-subtle text-sm py-12 px-4">
            No listings yet — paste a URL above or share one from the Centris app.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(l => (
              <ListingCard key={l.id} listing={l} onTap={onTapCard} onDelete={onDeleteCard} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
