'use client'

import { useState, useRef, useEffect } from 'react'

interface LocationCellProps {
  text: string | null
  mapQuery: string | null
  editable: boolean
  isSelected?: boolean
  onSave: (newValue: string | null) => void
}

export function LocationCell({ text, mapQuery, editable, isSelected = false, onSave }: LocationCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

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
        className="w-full px-2 py-1 text-sm border border-blue-400 rounded outline-none bg-white"
      />
    )
  }

  const mapHref = mapQuery && mapQuery.trim() !== ''
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null

  return (
    <span className="flex items-center gap-1 min-w-0">
      {mapHref && text ? (
        <a
          href={mapHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="truncate text-blue-600 hover:text-blue-800 hover:underline"
          title={mapQuery ?? undefined}
        >
          {text}
        </a>
      ) : (
        <span className="truncate text-slate-400">—</span>
      )}
      {editable && (
        <button
          type="button"
          onClick={startEdit}
          title={isSelected ? 'Edit location' : undefined}
          className={`flex-shrink-0 transition-colors ${isSelected ? 'text-slate-300 hover:text-blue-600' : 'text-slate-200 cursor-default'}`}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 13.5V16h2.5L15 7.5 12.5 5 4 13.5z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </span>
  )
}
