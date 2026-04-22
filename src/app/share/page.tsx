'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SharePreviewCard } from '@/components/SharePreviewCard'
import { useListings } from '@/hooks/useListings'
import type { Listing } from '@/types/listing'

type State =
  | { kind: 'loading' }
  | { kind: 'success'; listing: Listing }
  | { kind: 'duplicate'; listing: Listing | null }
  | { kind: 'error'; message: string }

export default function SharePage() {
  const router = useRouter()
  const params = useSearchParams()
  const { deleteListing, fetchListings } = useListings()

  const sharedUrl = (params.get('url') || params.get('text') || '').trim()

  const [state, setState] = useState<State>({ kind: 'loading' })
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sharedUrl) {
      router.replace('/recent')
      return
    }
    void runScrape()
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedUrl])

  async function runScrape() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch('/api/scrape-centris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sharedUrl }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setState({ kind: 'duplicate', listing: data.listing ?? null })
        return
      }
      if (!res.ok) {
        setState({ kind: 'error', message: "Couldn't read this listing" })
        return
      }

      if (!data.listing) {
        setState({ kind: 'error', message: "Couldn't read this listing" })
        return
      }
      await fetchListings()
      setState({ kind: 'success', listing: data.listing as Listing })

      // Auto-redirect after 5s if the user does nothing.
      redirectTimer.current = setTimeout(() => router.replace('/recent'), 5000)
    } catch {
      setState({ kind: 'error', message: 'Network error — check your connection' })
    }
  }

  async function handleUndo() {
    if (state.kind !== 'success') return
    if (redirectTimer.current) clearTimeout(redirectTimer.current)
    await deleteListing(state.listing.id)
    redirectTimer.current = setTimeout(() => router.replace('/recent'), 1500)
  }

  function handleDone() {
    if (redirectTimer.current) clearTimeout(redirectTimer.current)
    router.replace('/recent')
  }

  function handleManual() {
    router.replace('/recent')
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {state.kind === 'loading' && <SharePreviewCard variant="loading" />}
      {state.kind === 'success' && (
        <SharePreviewCard variant="success" listing={state.listing} onUndo={handleUndo} onDone={handleDone} />
      )}
      {state.kind === 'duplicate' && (
        <SharePreviewCard variant="duplicate" listing={state.listing ?? undefined} onDone={handleDone} />
      )}
      {state.kind === 'error' && (
        <SharePreviewCard
          variant="error"
          url={sharedUrl}
          message={state.message}
          onRetry={runScrape}
          onManual={handleManual}
        />
      )}
    </main>
  )
}
