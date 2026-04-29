'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { ListingsTable } from '@/components/ListingsTable'
import { DetailPanel } from '@/components/DetailPanel'
import { ViewToggle, type ViewMode } from '@/components/ViewToggle'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { useListings } from '@/hooks/useListings'
import { extractCentrisUrl } from '@/lib/extract-centris-url'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center text-fg-subtle text-sm">
      Loading map…
    </div>
  ),
})
type ScrapeStatus = 'idle' | 'loading' | 'success' | 'error' | 'duplicate'

function HomeContent() {
  const { listings, loading, error, fetchListings, updateListing, deleteListing, trashCount } = useListings()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [centrisUrl, setCentrisUrl] = useState('')
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle')
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [compareMaxWarning, setCompareMaxWarning] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })

  const router = useRouter()
  const searchParams = useSearchParams()
  const view: ViewMode = searchParams.get('view') === 'map' ? 'map' : 'table'

  const handleViewChange = (next: ViewMode) => {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'map') params.set('view', 'map')
    else params.delete('view')
    const query = params.toString()
    router.replace(query ? `/?${query}` : '/')
  }

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        setCompareMaxWarning(false)
        return next
      }
      if (prev.size >= 5) {
        setCompareMaxWarning(true)
        return prev
      }
      const next = new Set(prev)
      next.add(id)
      setCompareMaxWarning(false)
      return next
    })
  }

  useEffect(() => {
    if (!compareMaxWarning) return
    const timer = setTimeout(() => setCompareMaxWarning(false), 2000)
    return () => clearTimeout(timer)
  }, [compareMaxWarning])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(max-width: 767px)').matches) {
      setIsRedirecting(true)
      router.replace('/recent')
    }
  }, [router])

  const clearCompare = () => {
    setCompareIds(new Set())
    setCompareMaxWarning(false)
  }

  const openCompare = () => {
    const ids = encodeURIComponent(Array.from(compareIds).join(','))
    window.open(`/compare?ids=${ids}`, '_blank')
  }

  const selectedListing = selectedId
    ? listings.find(l => l.id === selectedId) ?? null
    : null

  const handleDelete = async (id: string) => {
    const success = await deleteListing(id)
    if (success && selectedId === id) {
      setSelectedId(null)
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setCentrisUrl(text.trim())
    } catch {
      // Clipboard permission denied — user can type/paste manually
    }
  }

  const handleScrape = async () => {
    const raw = centrisUrl.trim()
    if (!raw) return
    const url = extractCentrisUrl(raw) ?? raw

    setScrapeStatus('loading')
    setScrapeMessage(null)

    try {
      const res = await fetch('/api/scrape-centris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      let data: any
      try {
        data = await res.json()
      } catch {
        setScrapeStatus('error')
        setScrapeMessage(res.ok ? 'Unexpected server response' : `Server error (${res.status})`)
        return
      }

      if (res.status === 409) {
        setScrapeStatus('duplicate')
        setScrapeMessage('Already in HouseHunter')
        if (data.listingId) setSelectedId(data.listingId)
        return
      }

      if (!res.ok) {
        setScrapeStatus('error')
        setScrapeMessage(data.error || 'Something went wrong')
        return
      }

      // Success
      await fetchListings()
      if (data.listing?.id) setSelectedId(data.listing.id)
      setScrapeStatus('success')
      setScrapeMessage(data.commuteNote ? `Added! (${data.commuteNote})` : 'Added!')
      setCentrisUrl('')
    } catch {
      setScrapeStatus('error')
      setScrapeMessage('Network error — check your connection')
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-fg-subtle text-sm">Loading listings...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-red-500 text-sm">Error: {error}</div>
      </div>
    )
  }

  if (isRedirecting) return null

  const statusColor =
    scrapeStatus === 'success' ? 'text-green-600 dark:text-green-300' :
    scrapeStatus === 'duplicate' ? 'text-amber-600 dark:text-amber-300' :
    scrapeStatus === 'error' ? 'text-red-600 dark:text-red-300' :
    'text-fg-subtle'

  return (
    <div className="h-screen flex flex-col bg-bg">
      <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-border">
        {/* URL input */}
        <input
          type="url"
          value={centrisUrl}
          onChange={e => { setCentrisUrl(e.target.value); if (scrapeStatus !== 'idle' && scrapeStatus !== 'loading') setScrapeStatus('idle') }}
          onKeyDown={e => { if (e.key === 'Enter') handleScrape() }}
          placeholder="Paste a Centris URL..."
          disabled={scrapeStatus === 'loading'}
          className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent disabled:opacity-50 placeholder:text-fg-subtle"
        />

        {/* Paste button */}
        <button
          onClick={handlePaste}
          disabled={scrapeStatus === 'loading'}
          className="hidden sm:block px-3 py-1.5 text-sm font-medium text-fg-muted bg-surface border border-border rounded-lg hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Paste from clipboard"
        >
          Paste
        </button>

        {/* Add button */}
        <button
          onClick={handleScrape}
          disabled={scrapeStatus === 'loading' || !centrisUrl.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {scrapeStatus === 'loading' ? (
            <>
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Adding...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              </svg>
              Add
            </>
          )}
        </button>

        {/* Status message */}
        {scrapeStatus !== 'idle' && scrapeStatus !== 'loading' && scrapeMessage && (
          <span className={`text-sm font-medium truncate min-w-0 ${statusColor}`}>
            {scrapeMessage}
          </span>
        )}

        {/* Compare cluster — appears when 2+ listings selected */}
        {compareIds.size >= 2 && (
          <div className="relative flex items-center gap-1.5">
            <button
              onClick={openCompare}
              aria-label={`Compare ${compareIds.size} listings`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 transition-colors"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.166a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
              <span className="hidden sm:inline">Compare</span>
              <span>({compareIds.size})</span>
            </button>
            <button
              onClick={clearCompare}
              aria-label="Clear selection"
              className="p-1.5 text-fg-subtle bg-surface border border-border rounded-lg hover:text-fg-muted hover:bg-surface-hover transition-colors"
              title="Clear selection"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
            {compareMaxWarning && (
              <span role="status" aria-live="polite" className="absolute top-full right-0 mt-1 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg shadow-lg whitespace-nowrap z-30">
                Maximum 5 listings
              </span>
            )}
          </div>
        )}

        <ViewToggle current={view} onChange={handleViewChange} />

        <ThemeToggle />

        <UserMenu />

      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {view === 'map' ? (
            <MapView listings={listings} onSelect={setSelectedId} />
          ) : (
            <ListingsTable
              listings={listings}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={updateListing}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              onRefreshed={fetchListings}
            />
          )}
        </div>

        {selectedListing && (
          <DetailPanel
            listing={selectedListing}
            onClose={() => setSelectedId(null)}
            onUpdate={updateListing}
            onDelete={handleDelete}
          />
        )}
      </div>

      {/* Trash link */}
      <Link
        href="/trash"
        className="fixed bottom-4 left-4 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-fg-subtle bg-surface border border-border rounded-lg shadow-sm hover:bg-surface-hover hover:text-fg-muted transition-colors"
        title="View deleted listings"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
        Trash
        {trashCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full">
            {trashCount}
          </span>
        )}
      </Link>

    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-bg"><div className="text-fg-subtle text-sm">Loading...</div></div>}>
      <HomeContent />
    </Suspense>
  )
}
