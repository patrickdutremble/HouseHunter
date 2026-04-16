'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ListingsTable } from '@/components/ListingsTable'
import { DetailPanel } from '@/components/DetailPanel'
import { useListings } from '@/hooks/useListings'
type ScrapeStatus = 'idle' | 'loading' | 'success' | 'error' | 'duplicate'

export default function Home() {
  const { listings, loading, error, fetchListings, updateListing, deleteListing, trashCount } = useListings()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [centrisUrl, setCentrisUrl] = useState('')
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle')
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
  const [compareMaxWarning, setCompareMaxWarning] = useState(false)

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        setCompareMaxWarning(false)
      } else {
        if (next.size >= 5) {
          setCompareMaxWarning(true)
          setTimeout(() => setCompareMaxWarning(false), 2000)
          return prev
        }
        next.add(id)
        setCompareMaxWarning(false)
      }
      return next
    })
  }

  const clearCompare = () => {
    setCompareIds(new Set())
    setCompareMaxWarning(false)
  }

  const openCompare = () => {
    const ids = Array.from(compareIds).join(',')
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
    const url = centrisUrl.trim()
    if (!url) return

    setScrapeStatus('loading')
    setScrapeMessage(null)

    try {
      const res = await fetch('/api/scrape-centris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

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
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading listings...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-red-500 text-sm">Error: {error}</div>
      </div>
    )
  }

  const statusColor =
    scrapeStatus === 'success' ? 'text-green-600' :
    scrapeStatus === 'duplicate' ? 'text-amber-600' :
    scrapeStatus === 'error' ? 'text-red-600' :
    'text-slate-400'

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-slate-200">
        {/* URL input */}
        <input
          type="url"
          value={centrisUrl}
          onChange={e => { setCentrisUrl(e.target.value); if (scrapeStatus !== 'idle' && scrapeStatus !== 'loading') setScrapeStatus('idle') }}
          onKeyDown={e => { if (e.key === 'Enter') handleScrape() }}
          placeholder="Paste a Centris URL..."
          disabled={scrapeStatus === 'loading'}
          className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 placeholder:text-slate-400"
        />

        {/* Paste button */}
        <button
          onClick={handlePaste}
          disabled={scrapeStatus === 'loading'}
          className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Paste from clipboard"
        >
          Paste
        </button>

        {/* Add button */}
        <button
          onClick={handleScrape}
          disabled={scrapeStatus === 'loading' || !centrisUrl.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
          <span className={`text-sm font-medium whitespace-nowrap ${statusColor}`}>
            {scrapeMessage}
          </span>
        )}

      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ListingsTable
            listings={listings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={updateListing}
            compareIds={compareIds}
            onToggleCompare={toggleCompare}
          />
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
        className="fixed bottom-4 left-4 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors"
        title="View deleted listings"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
        Trash
        {trashCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
            {trashCount}
          </span>
        )}
      </Link>

      {compareIds.size >= 2 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          <button
            onClick={openCompare}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.166a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
            Compare ({compareIds.size})
          </button>
          <button
            onClick={clearCompare}
            className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg shadow-lg hover:text-slate-600 hover:bg-slate-50 transition-colors"
            title="Clear selection"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
          {compareMaxWarning && (
            <span className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg shadow-lg">
              Maximum 5 listings
            </span>
          )}
        </div>
      )}
    </div>
  )
}
