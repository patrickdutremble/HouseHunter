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
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${running
            ? 'bg-surface-muted border-border text-fg-subtle cursor-wait'
            : 'bg-surface border-border text-fg-muted hover:bg-surface-hover'}
        `}
      >
        {running ? 'Refreshing\u2026' : 'Refresh statuses'}
      </button>
      {message && (
        <span className={`text-xs ${isError ? 'text-red-600 dark:text-red-400' : 'text-fg-subtle'}`}>{message}</span>
      )}
    </div>
  )
}
