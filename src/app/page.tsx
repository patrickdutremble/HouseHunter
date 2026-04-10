'use client'

import { useState } from 'react'
import { ListingsTable } from '@/components/ListingsTable'
import { DetailPanel } from '@/components/DetailPanel'
import { useListings } from '@/hooks/useListings'
import { listingsToCSV } from '@/lib/csv-export'

export default function Home() {
  const { listings, loading, error, updateListing, addListing, deleteListing } = useListings()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedListing = selectedId
    ? listings.find(l => l.id === selectedId) ?? null
    : null

  const handleDelete = async (id: string) => {
    const success = await deleteListing(id)
    if (success && selectedId === id) {
      setSelectedId(null)
    }
  }

  const handleAdd = async () => {
    const created = await addListing()
    if (created) setSelectedId(created.id)
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

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200">
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
          title="Add a new empty listing"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          </svg>
          Add listing
        </button>
        <button
          onClick={handleExport}
          disabled={listings.length === 0}
          className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
