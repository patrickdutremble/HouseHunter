'use client'

import { useState } from 'react'
import { ListingsTable } from '@/components/ListingsTable'
import { DetailPanel } from '@/components/DetailPanel'
import { useListings } from '@/hooks/useListings'
import { listingsToCSV } from '@/lib/csv-export'

type ScrapeStatus = 'idle' | 'loading' | 'success' | 'error' | 'duplicate'

export default function Home() {
  const { listings, loading, error, fetchListings, updateListing, deleteListing } = useListings()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [centrisUrl, setCentrisUrl] = useState('')
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle')
  const [scrapeMessage, setScrapeMessage] = useState<string | null>(null)

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

  const handleExport = () => {
    const csv = listingsToCSV(listings)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `househunter-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
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

        {/* Spacer */}
        <div className="flex-shrink-0 w-px h-5 bg-slate-200 mx-1" />

        {/* Export */}
        <button
          onClick={handleExport}
          disabled={listings.length === 0}
          className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          Export CSV
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <ListingsTable
            listings={listings}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onUpdate={updateListing}
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
    </div>
  )
}
