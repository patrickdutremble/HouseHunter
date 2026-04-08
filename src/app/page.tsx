'use client'

import { useState } from 'react'
import { TopBar } from '@/components/TopBar'
import { ListingsTable } from '@/components/ListingsTable'
import { DetailPanel } from '@/components/DetailPanel'
import { useListings } from '@/hooks/useListings'

export default function Home() {
  const { listings, loading, error, updateListing, deleteListing } = useListings()
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
      <TopBar listings={listings} />

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
