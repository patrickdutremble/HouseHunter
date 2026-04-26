'use client'

import { useState, useRef, useEffect } from 'react'

interface LocationFieldProps {
  displayValue: string | null
  mapQuery: string | null
  onSave: (newValue: string | null) => void
}

export function LocationField({ displayValue, mapQuery, onSave }: LocationFieldProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const startEdit = () => {
    setEditValue(displayValue ?? '')
    setEditing(true)
  }

  const handleSave = () => {
    setEditing(false)
    const trimmed = editValue.trim()
    onSave(trimmed === '' ? null : trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 text-sm border border-accent rounded outline-none bg-surface"
      />
    )
  }

  const query = mapQuery && mapQuery.trim() !== '' ? mapQuery : null
  const mapHref = query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null

  return (
    <span className="flex items-start gap-1">
      {mapHref ? (
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 break-words text-accent hover:text-sky-700 dark:hover:text-sky-300 hover:underline"
          title="Open in Google Maps"
        >
          {displayValue}
        </a>
      ) : (
        <span className="flex-1 text-fg-subtle">—</span>
      )}
      <button
        type="button"
        onClick={startEdit}
        title={displayValue ? 'Edit address' : 'Add address'}
        className="flex-shrink-0 text-fg-subtle hover:text-accent transition-colors pt-0.5"
      >
        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          {displayValue ? (
            <path d="M4 13.5V16h2.5L15 7.5 12.5 5 4 13.5z" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M10 4v12M4 10h12" strokeLinecap="round" />
          )}
        </svg>
      </button>
    </span>
  )
}
