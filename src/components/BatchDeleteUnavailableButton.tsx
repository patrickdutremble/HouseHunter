'use client'

import { useEffect, useRef, useState } from 'react'

const UNDO_WINDOW_MS = 5000

interface PendingDelete {
  count: number
  expiresAt: number
  commit: () => Promise<boolean>
  undo: () => void
}

interface Props {
  unavailableIds: string[]
  beginBulkSoftDelete: (ids: string[]) => { commit: () => Promise<boolean>; undo: () => void; count: number }
  onDeleted?: () => void
}

export function BatchDeleteUnavailableButton({ unavailableIds, beginBulkSoftDelete, onDeleted }: Props) {
  const [pending, setPending] = useState<PendingDelete | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const committedRef = useRef(false)

  const count = unavailableIds.length

  useEffect(() => {
    if (!pending) return

    committedRef.current = false

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000))
      setSecondsLeft(remaining)
    }
    tick()
    const interval = setInterval(tick, 200)

    const timeout = setTimeout(async () => {
      committedRef.current = true
      const ok = await pending.commit()
      if (!ok) {
        setErrorMsg('Delete failed — listings restored.')
      } else {
        onDeleted?.()
      }
      setPending(null)
    }, UNDO_WINDOW_MS)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [pending, onDeleted])

  function handleClick() {
    if (count === 0 || pending) return
    setErrorMsg(null)
    const result = beginBulkSoftDelete(unavailableIds)
    if (result.count === 0) return
    setPending({
      count: result.count,
      expiresAt: Date.now() + UNDO_WINDOW_MS,
      commit: result.commit,
      undo: result.undo,
    })
    setSecondsLeft(Math.ceil(UNDO_WINDOW_MS / 1000))
  }

  function handleUndo() {
    if (!pending || committedRef.current) return
    pending.undo()
    setPending(null)
  }

  if (pending) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted">
          Deleted {pending.count} unavailable listing{pending.count !== 1 ? 's' : ''} ({secondsLeft}s)
        </span>
        <button
          type="button"
          onClick={handleUndo}
          className="px-3 py-1.5 text-sm rounded-lg border border-border bg-surface text-fg hover:bg-surface-hover transition-colors"
        >
          Undo
        </button>
      </div>
    )
  }

  if (count === 0) return null

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        title={`Delete ${count} unavailable listing${count !== 1 ? 's' : ''}`}
        className="px-3 py-1.5 text-sm rounded-lg border bg-surface border-border text-fg-muted hover:bg-surface-hover transition-colors"
      >
        Delete unavailable ({count})
      </button>
      {errorMsg && <span className="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>}
    </div>
  )
}
