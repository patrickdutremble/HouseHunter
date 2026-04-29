'use client'

import { useState } from 'react'
import type { RefreshSummary } from '@/lib/refresh-statuses'

interface Props {
  onRefreshed: (summary: RefreshSummary) => void
}

export function RefreshStatusesButton({ onRefreshed }: Props) {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function handleClick() {
    setRunning(true)
    setMessage(null)
    setIsError(false)
    try {
      const res = await fetch('/api/refresh-statuses', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const summary = (await res.json()) as RefreshSummary
      setMessage(
        `Checked ${summary.checked} listings — ${summary.unavailable} unavailable, ${summary.priceChanged} price changes.`,
      )
      onRefreshed(summary)
    } catch (err) {
      setIsError(true)
      setMessage(`Refresh failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        aria-label={running ? 'Refreshing statuses' : 'Refresh statuses'}
        title={running ? 'Refreshing\u2026' : 'Refresh statuses'}
        className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          running
            ? 'bg-surface-muted border-border text-fg-subtle cursor-wait'
            : 'bg-surface border-border text-fg-muted hover:bg-surface-hover'
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className={running ? 'animate-spin' : ''}
        >
          <path d="M21 12a9 9 0 0 1-15.36 6.36" />
          <path d="M3 12a9 9 0 0 1 15.36-6.36" />
          <path d="M21 4v5h-5" />
          <path d="M3 20v-5h5" />
        </svg>
      </button>
      {message && (
        <span className={`text-xs ${isError ? 'text-red-600 dark:text-red-400' : 'text-fg-subtle'}`}>{message}</span>
      )}
    </div>
  )
}
