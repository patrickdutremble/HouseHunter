'use client'

import { useState, useRef, useEffect } from 'react'

interface LocationCellProps {
  text: string | null
  mapQuery: string | null
  editable: boolean
  isSelected?: boolean
  imageUrl?: string | null
  onSave: (newValue: string | null) => void
}

export function LocationCell({ text, mapQuery, editable, isSelected = false, imageUrl, onSave }: LocationCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [imgError, setImgError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    setImgError(false)
  }, [imageUrl])

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!editable) return
    if (!isSelected) return
    setEditValue(text ?? '')
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
        onClick={e => e.stopPropagation()}
        className="w-full px-2 py-1 text-sm border border-accent rounded outline-none bg-surface"
      />
    )
  }

  const mapHref = mapQuery && mapQuery.trim() !== ''
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null

  return (
    <span className="flex items-center gap-2 min-w-0">
      {imageUrl && !imgError ? (
        <img
          src={imageUrl}
          alt={text ? `${text} listing photo` : 'Listing photo'}
          loading="lazy"
          className="shrink-0 w-11 h-9 rounded-md object-cover bg-surface-muted"
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          aria-hidden="true"
          className="shrink-0 w-11 h-9 rounded-md bg-surface-muted flex items-center justify-center text-fg-subtle"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
          </svg>
        </span>
      )}
      {mapHref && text ? (
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="text-accent hover:text-sky-700 dark:hover:text-sky-300 hover:underline leading-tight text-[12.5px] break-words min-w-0"
          title={mapQuery ?? undefined}
        >
          {text}
        </a>
      ) : (
        <span className="text-fg-subtle">—</span>
      )}
      {editable && (
        <button
          type="button"
          onClick={startEdit}
          title={isSelected ? 'Edit location' : undefined}
          className={`flex-shrink-0 transition-colors ${isSelected ? 'text-fg-subtle hover:text-accent' : 'text-border cursor-default'}`}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 13.5V16h2.5L15 7.5 12.5 5 4 13.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </span>
  )
}
