'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ThemeToggle } from '@/components/ThemeToggle'
import type { Listing } from '@/types/listing'

export default function TrashPage() {
  const [trashedListings, setTrashedListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTrashed = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('listings')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    setTrashedListings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTrashed()
  }, [fetchTrashed])

  const restoreListing = async (id: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ deleted_at: null })
      .eq('id', id)

    if (!error) {
      setTrashedListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const permanentlyDelete = async (id: string) => {
    if (!confirm('Permanently delete this listing? This cannot be undone.')) return

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id)

    if (!error) {
      setTrashedListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const emptyTrash = async () => {
    if (!confirm(`Permanently delete all ${trashedListings.length} items in trash? This cannot be undone.`)) return

    const ids = trashedListings.map(l => l.id)
    const { error } = await supabase
      .from('listings')
      .delete()
      .in('id', ids)

    if (!error) {
      setTrashedListings([])
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '—'
    return `$${price.toLocaleString()}`
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-fg-subtle text-sm">Loading trash...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="bg-surface border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 text-fg-subtle hover:text-fg-muted hover:bg-surface-muted rounded-lg transition-colors"
              title="Back to listings"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-fg">
              Trash
              {trashedListings.length > 0 && (
                <span className="ml-2 text-sm font-normal text-fg-subtle">
                  ({trashedListings.length} {trashedListings.length === 1 ? 'item' : 'items'})
                </span>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {trashedListings.length > 0 && (
              <button
                onClick={emptyTrash}
                className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
              >
                Empty trash
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {trashedListings.length === 0 ? (
          <div className="text-center py-16">
            <svg className="mx-auto mb-3 text-fg-subtle" width="40" height="40" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
            <p className="text-fg-subtle text-sm">Trash is empty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trashedListings.map(listing => (
              <div
                key={listing.id}
                className="flex items-center gap-4 bg-surface rounded-lg border border-border p-4 shadow-sm"
              >
                {/* Listing image */}
                {listing.image_url ? (
                  <img
                    src={listing.image_url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg border border-border shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 bg-surface-muted rounded-lg border border-border shrink-0 flex items-center justify-center">
                    <svg className="text-fg-subtle" width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-fg truncate">
                    {listing.location ?? 'Unknown location'}
                  </div>
                  <div className="text-sm text-fg-subtle mt-0.5">
                    {formatPrice(listing.price)}
                    {listing.property_type && ` \u00B7 ${listing.property_type}`}
                  </div>
                  {listing.deleted_at && (
                    <div className="text-xs text-fg-subtle mt-1">
                      Deleted {formatDate(listing.deleted_at)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => restoreListing(listing.id)}
                    className="px-3 py-1.5 text-xs font-medium text-accent hover:text-sky-700 dark:hover:text-sky-300 hover:bg-blue-50 dark:hover:bg-sky-900/40 rounded-lg transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => permanentlyDelete(listing.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
