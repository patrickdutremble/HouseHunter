'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { recalculateListing } from '@/lib/calculations'
import type { Listing } from '@/types/listing'

export function useListings() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trashCount, setTrashCount] = useState(0)

  const fetchListings = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setListings(data ?? [])
      setError(null)
    }
    setLoading(false)
  }, [])

  const fetchTrashCount = useCallback(async () => {
    const { count, error: countError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .not('deleted_at', 'is', null)

    if (!countError && count !== null) {
      setTrashCount(count)
    }
  }, [])

  useEffect(() => {
    fetchListings()
    fetchTrashCount()
  }, [fetchListings, fetchTrashCount])

  const updateListing = async (id: string, field: string, value: string | number | boolean | null) => {
    const updates: Record<string, unknown> = { [field]: value }

    // Recalculate derived fields if a source field changed
    const recalcFields = ['price', 'taxes_yearly', 'common_fees_yearly', 'hydro_yearly', 'liveable_area_sqft']
    if (recalcFields.includes(field)) {
      const current = listings.find(l => l.id === id)
      if (current) {
        const input = {
          price: field === 'price' ? (value as number) : current.price,
          taxes_yearly: field === 'taxes_yearly' ? (value as number) : current.taxes_yearly,
          common_fees_yearly: field === 'common_fees_yearly' ? (value as number) : current.common_fees_yearly,
          hydro_yearly: field === 'hydro_yearly' ? (value as number) : current.hydro_yearly,
          liveable_area_sqft: field === 'liveable_area_sqft' ? (value as number) : current.liveable_area_sqft,
        }
        const calculated = recalculateListing(input)
        Object.assign(updates, calculated)
      }
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Update local state
    setListings(prev =>
      prev.map(l => (l.id === id ? { ...l, ...updates } as Listing : l))
    )
    return true
  }

  const deleteListing = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('listings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return false
    }

    setListings(prev => prev.filter(l => l.id !== id))
    fetchTrashCount()
    return true
  }

  return { listings, loading, error, fetchListings, updateListing, deleteListing, trashCount }
}
