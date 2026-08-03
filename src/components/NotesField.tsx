'use client'

import { useRef, useState } from 'react'

export function NotesField({
  value,
  onSave,
}: {
  value: string | null
  onSave: (next: string | null) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [failed, setFailed] = useState(false)
  // Set when Escape cancels, so the blur that follows does not save.
  const cancelled = useRef(false)

  if (!editing) {
    return (
      <button
        type="button"
        aria-label={value ? `Notes: ${value}` : 'Notes — add notes'}
        onClick={() => {
          setDraft(value ?? '')
          setFailed(false)
          cancelled.current = false
          setEditing(true)
        }}
        className="w-full text-left py-2 border-b border-border"
      >
        <div className="text-[11px] uppercase tracking-wide text-fg-subtle">Notes</div>
        <div className={value ? 'text-fg whitespace-pre-wrap break-words' : 'text-fg-subtle'}>{value || 'Add notes…'}</div>
      </button>
    )
  }

  const save = async () => {
    const next = draft.trim() === '' ? null : draft
    const ok = await onSave(next)
    if (ok) {
      setEditing(false)
      setFailed(false)
    } else {
      setFailed(true)
    }
  }

  return (
    <div className="py-2 border-b border-border">
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle">Notes</div>
      <textarea
        autoFocus
        aria-label="Notes"
        rows={4}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelled.current) {
            cancelled.current = false
            return
          }
          save()
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            cancelled.current = true
            setFailed(false)
            setEditing(false)
          }
        }}
        className="w-full mt-1 border border-border-strong rounded-lg px-3 py-2 text-sm bg-surface text-fg"
      />
      <button
        type="button"
        // Prevent the textarea's blur from firing a second save before onClick.
        onMouseDown={e => e.preventDefault()}
        onClick={save}
        className="mt-1 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium"
      >
        Done
      </button>
      {failed && (
        <div role="alert" className="mt-1 text-sm text-red-600 dark:text-red-300">
          Couldn&apos;t save notes — try again
        </div>
      )}
    </div>
  )
}
