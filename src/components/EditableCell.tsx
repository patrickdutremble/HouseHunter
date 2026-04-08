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
  onSave: (newValue: string | number | null) => void
}

export function EditableCell({ value, format, editable, align, wrap = false, onSave }: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleClick = () => {
    if (!editable) return
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

    if (format === 'currency' || format === 'integer') {
      const numeric = Number(trimmed.replace(/[$,\s]/g, ''))
      if (!isNaN(numeric)) {
        onSave(Math.round(numeric))
        return
      }
    }

    onSave(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') setEditing(false)
  }

  const alignClass = align === 'right' ? 'text-right' : 'text-left'

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={`w-full px-2 py-1 text-sm border border-blue-400 rounded outline-none bg-white ${alignClass}`}
      />
    )
  }

  const displayValue = formatCellValue(value, format)
  const cursorClass = editable ? 'cursor-pointer hover:bg-blue-50 rounded px-1 -mx-1 transition-colors' : ''
  const overflowClass = wrap ? 'break-words whitespace-normal' : 'truncate'

  return (
    <span
      onClick={handleClick}
      className={`block ${overflowClass} ${alignClass} ${cursorClass}`}
      title={editable ? 'Click to edit' : undefined}
    >
      {displayValue}
    </span>
  )
}
