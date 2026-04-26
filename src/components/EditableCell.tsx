'use client'

import { useState, useRef, useEffect } from 'react'
import type { ColumnFormat } from '@/lib/columns'
import { formatCellValue } from '@/lib/formatting'

interface EditableCellProps {
  value: unknown
  format: ColumnFormat
  editable: boolean
  align: 'left' | 'right'
  wrap?: boolean
  multiline?: boolean
  isSelected?: boolean
  onSave: (newValue: string | number | null) => void
}

export function EditableCell({ value, format, editable, align, wrap = false, multiline = false, isSelected = false, onSave }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing) {
      if (multiline && textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.select()
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      } else if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
  }, [editing, multiline])

  const handleClick = () => {
    if (!editable) return
    if (!isSelected) return
    setEditValue(value === null || value === undefined ? '' : String(value))
    setEditing(true)
  }

  const handleSave = () => {
    setEditing(false)
    const trimmed = editValue.trim()

    if (trimmed === '') {
      onSave(null)
      return
    }

    if (format === 'currency' || format === 'integer' || format === 'year') {
      const numeric = Number(trimmed.replace(/[$,\s]/g, ''))
      if (!isNaN(numeric)) {
        onSave(Math.round(numeric))
        return
      }
    }

    onSave(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setEditing(false); return }
    if (multiline) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
    } else {
      if (e.key === 'Enter') handleSave()
    }
  }

  const alignClass = align === 'right' ? 'text-right' : 'text-left'

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={textareaRef}
          value={editValue}
          onChange={e => {
            setEditValue(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className={`w-full px-2 py-1 text-sm border border-accent rounded outline-none bg-surface resize-none ${alignClass}`}
          rows={3}
        />
      )
    }
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full px-2 py-1 text-sm border border-accent rounded outline-none bg-surface ${alignClass}`}
      />
    )
  }

  if (format === 'link-icon') {
    const href = typeof value === 'string' && value.trim() !== '' ? value : null
    const handleIconClick = (e: React.MouseEvent) => {
      e.stopPropagation()
    }
    const handleEditClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!isSelected) return
      handleClick()
    }
    return (
      <span className="flex items-center justify-center gap-1">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleIconClick}
            title={href}
            className="text-accent hover:text-sky-700 dark:hover:text-sky-300"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 3h6v6M17 3l-8 8M8 5H4v11h11v-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ) : null}
        {editable && (
          <button
            type="button"
            onClick={handleEditClick}
            title={isSelected ? (href ? 'Edit URL' : 'Paste URL') : undefined}
            className="text-fg-subtle hover:text-accent transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              {href ? (
                <path d="M4 13.5V16h2.5L15 7.5 12.5 5 4 13.5z" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M10 4v12M4 10h12" strokeLinecap="round" />
              )}
            </svg>
          </button>
        )}
      </span>
    )
  }

  const displayValue = formatCellValue(value, format)
  const cursorClass = editable && isSelected
    ? 'cursor-pointer hover:border hover:border-dashed hover:border-accent hover:rounded px-1 -mx-1 transition-colors'
    : ''
  const overflowClass = wrap ? 'break-words whitespace-pre-wrap' : 'truncate'

  return (
    <span
      onClick={handleClick}
      className={`block ${overflowClass} ${alignClass} ${cursorClass}`}
      title={editable && isSelected ? 'Click to edit' : undefined}
    >
      {displayValue}
    </span>
  )
}
