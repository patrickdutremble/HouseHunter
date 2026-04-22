'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SharePreviewCard } from '@/components/SharePreviewCard'
import { useListings } from '@/hooks/useListings'
import { extractCentrisUrl } from '@/lib/extract-centris-url'
import type { Listing } from '@/types/listing'

type State =
  | { kind: 'loading' }
  | { kind: 'success'; listing: Listing }
  | { kind: 'duplicate'; listing: Listing | null }
  | { kind: 'error'; message: string }
  | { kind: 'removed' }

const AUTO_REDIRECT_SECONDS = 5

function SharePageContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { deleteListing, fetchListings } = useListings()

  const rawShared = (params.get('url') || params.get('text') || params.get('title') || '').trim()
  const sharedUrl = extractCentrisUrl(rawShared) ?? ''

  const [state, setState] = useState<State>({ kind: 'loading' })
  const [countdown, setCountdown] = useState<number | null>(null)
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  function clearTimers() {
    if (redirectTimer.current) {
      clearTimeout(redirectTimer.current)
      redirectTimer.current = null
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current)
      countdownInterval.current = null
    }
  }

  useEffect(() => {
    if (!sharedUrl) {
      router.replace('/recent')
      return
    }
    void runScrape()
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedUrl])

  async function runScrape() {
    setState({ kind: 'loading' })
    setCountdown(null)
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

      // Auto-redirect after 5s, with a visible per-second countdown.
      setCountdown(AUTO_REDIRECT_SECONDS)
      countdownInterval.current = setInterval(() => {
        setCountdown(c => (c === null || c <= 1 ? c : c - 1))
      }, 1000)
      redirectTimer.current = setTimeout(() => {
        clearTimers()
        router.replace('/recent')
      }, AUTO_REDIRECT_SECONDS * 1000)
    } catch {
      setState({ kind: 'error', message: 'Network error — check your connection' })
    }
  }

  async function handleUndo() {
    if (state.kind !== 'success') return
    clearTimers()
    setCountdown(null)
    const ok = await deleteListing(state.listing.id)
    if (!ok) {
      setState({ kind: 'error', message: "Couldn't undo — try deleting from the Recent list" })
      return
    }
    setState({ kind: 'removed' })
    redirectTimer.current = setTimeout(() => router.replace('/recent'), 1500)
  }

  function handleDone() {
    clearTimers()
    router.replace('/recent')
  }

  function handleManual() {
    router.replace('/recent')
  }

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {state.kind === 'loading' && <SharePreviewCard variant="loading" />}
      {state.kind === 'success' && (
        <>
          <SharePreviewCard variant="success" listing={state.listing} onUndo={handleUndo} onDone={handleDone} />
          {countdown !== null && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 flex items-center gap-2 text-sm text-slate-500"
            >
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Redirecting to home in {countdown}s…</span>
            </div>
          )}
        </>
      )}
      {state.kind === 'duplicate' && (
        <SharePreviewCard variant="duplicate" listing={state.listing ?? undefined} onDone={handleDone} />
      )}
      {state.kind === 'removed' && (
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-5 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700" aria-hidden="true">
            ✓
          </div>
          <div className="flex-1 text-slate-900 font-medium">Removed — sent to trash</div>
        </div>
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

export default function SharePage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 flex items-center justify-center p-4"><SharePreviewCard variant="loading" /></main>}>
      <SharePageContent />
    </Suspense>
  )
}
