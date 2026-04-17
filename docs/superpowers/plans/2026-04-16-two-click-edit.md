# Two-Click Edit Behaviour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Table cells require two clicks to edit — first click selects the row, second click activates edit mode — while the detail panel keeps single-click editing.

**Architecture:** Add `isSelected?: boolean` (default `false`) to `EditableCell` and `LocationCell`. Gate `setEditing(true)` on it. Pass the existing `isSelected` prop from `TableRow` into those cells. Pass `isSelected={true}` from `DetailPanel` to preserve its current single-click behaviour.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest, @testing-library/react

---

## Files

| File | Change |
|------|--------|
| `src/components/EditableCell.tsx` | Add `isSelected` prop; gate edit entry; update hover styles |
| `src/components/LocationCell.tsx` | Add `isSelected` prop; gate edit button; update hover styles |
| `src/components/TableRow.tsx` | Pass `isSelected` to `EditableCell` and `LocationCell` |
| `src/components/DetailPanel.tsx` | Pass `isSelected={true}` to `EditableCell` |
| `src/components/__tests__/EditableCell.test.tsx` | New — component tests |
| `src/components/__tests__/LocationCell.test.tsx` | New — component tests |

---

### Task 1: Test and update `EditableCell`

**Files:**
- Modify: `src/components/EditableCell.tsx`
- Create: `src/components/__tests__/EditableCell.test.tsx`

- [ ] **Step 1: Create the failing tests**

Create `src/components/__tests__/EditableCell.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { EditableCell } from '../EditableCell'

describe('EditableCell two-click behaviour', () => {
  it('does not enter edit mode when isSelected is false', () => {
    render(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={false}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByText('hello'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('enters edit mode when isSelected is true', () => {
    render(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={true}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByText('hello'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('does not enter edit mode when editable is false even if isSelected is true', () => {
    render(
      <EditableCell
        value="hello"
        format="text"
        editable={false}
        align="left"
        isSelected={true}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByText('hello'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('shows hover class only when isSelected and editable', () => {
    const { rerender } = render(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={false}
        onSave={() => {}}
      />
    )
    const span = screen.getByText('hello')
    expect(span.className).not.toContain('hover:border-dashed')

    rerender(
      <EditableCell
        value="hello"
        format="text"
        editable
        align="left"
        isSelected={true}
        onSave={() => {}}
      />
    )
    expect(screen.getByText('hello').className).toContain('hover:border-dashed')
  })
})
```

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
npx vitest run src/components/__tests__/EditableCell.test.tsx
```

Expected: 4 failures — `isSelected` prop does not exist yet.

- [ ] **Step 3: Update `EditableCell`**

Replace the contents of `src/components/EditableCell.tsx` with:

```tsx
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
          className={`w-full px-2 py-1 text-sm border border-blue-400 rounded outline-none bg-white resize-none ${alignClass}`}
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
        className={`w-full px-2 py-1 text-sm border border-blue-400 rounded outline-none bg-white ${alignClass}`}
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
            className="text-blue-600 hover:text-blue-800"
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
            className="text-slate-300 hover:text-blue-600 transition-colors"
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
    ? 'cursor-pointer hover:border hover:border-dashed hover:border-blue-300 hover:rounded px-1 -mx-1 transition-colors'
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
```

- [ ] **Step 4: Run the tests — expect them all to pass**

```bash
npx vitest run src/components/__tests__/EditableCell.test.tsx
```

Expected: 4 passing.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/EditableCell.tsx src/components/__tests__/EditableCell.test.tsx
git commit -m "feat: gate EditableCell edit mode on isSelected prop"
```

---

### Task 2: Test and update `LocationCell`

**Files:**
- Modify: `src/components/LocationCell.tsx`
- Create: `src/components/__tests__/LocationCell.test.tsx`

- [ ] **Step 1: Create the failing tests**

Create `src/components/__tests__/LocationCell.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { LocationCell } from '../LocationCell'

describe('LocationCell two-click behaviour', () => {
  it('does not enter edit mode when isSelected is false', () => {
    render(
      <LocationCell
        text="123 Main St"
        mapQuery="123 Main St"
        editable
        isSelected={false}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('enters edit mode when isSelected is true', () => {
    render(
      <LocationCell
        text="123 Main St"
        mapQuery="123 Main St"
        editable
        isSelected={true}
        onSave={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests — expect them to fail**

```bash
npx vitest run src/components/__tests__/LocationCell.test.tsx
```

Expected: 2 failures — `isSelected` prop does not exist yet.

- [ ] **Step 3: Update `LocationCell`**

Replace the contents of `src/components/LocationCell.tsx` with:

```tsx
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
```

- [ ] **Step 4: Run the tests — expect them all to pass**

```bash
npx vitest run src/components/__tests__/LocationCell.test.tsx
```

Expected: 2 passing.

- [ ] **Step 5: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/LocationCell.tsx src/components/__tests__/LocationCell.test.tsx
git commit -m "feat: gate LocationCell edit mode on isSelected prop"
```

---

### Task 3: Wire `isSelected` through `TableRow`

**Files:**
- Modify: `src/components/TableRow.tsx`

No new tests needed — `TableRow` is a wiring change with no independent logic.

- [ ] **Step 1: Pass `isSelected` to `EditableCell` and `LocationCell`**

In `src/components/TableRow.tsx`, make two changes:

**At line 70 (`LocationCell`):** add `isSelected={isSelected}`:
```tsx
<LocationCell
  text={listing.location}
  mapQuery={listing.full_address ?? listing.location}
  editable={col.editable}
  isSelected={isSelected}
  onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
/>
```

**At line 89 (`EditableCell`):** add `isSelected={isSelected}`:
```tsx
<EditableCell
  value={value}
  format={col.format}
  editable={col.editable}
  align={col.align}
  isSelected={isSelected}
  onSave={(newValue) => {
    onUpdate(listing.id, col.key, newValue)
  }}
/>
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/TableRow.tsx
git commit -m "feat: pass isSelected from TableRow into EditableCell and LocationCell"
```

---

### Task 4: Preserve single-click editing in `DetailPanel`

**Files:**
- Modify: `src/components/DetailPanel.tsx`

- [ ] **Step 1: Pass `isSelected={true}` to `EditableCell` in `DetailPanel`**

In `src/components/DetailPanel.tsx`, find the `EditableCell` at line 106 and add `isSelected={true}`:

```tsx
<EditableCell
  value={value}
  format={col.format}
  editable={col.editable}
  align="left"
  wrap
  multiline={col.key === 'notes'}
  isSelected={true}
  onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
/>
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: preserve single-click editing in DetailPanel with isSelected=true"
```

---

## Manual Verification

After all tasks are complete, start the dev server and verify:

```bash
npm run dev
```

Check the following in the browser:

| Scenario | Expected result |
|----------|----------------|
| Click an editable cell on an **unselected** row | Row selects (blue highlight, detail panel opens). Cell does NOT enter edit mode. |
| Click an editable cell on the **selected** row | Cell enters edit mode (input appears). |
| Hover over editable cell on **unselected** row | No hover effect on the cell. |
| Hover over editable cell on **selected** row | Dashed blue border appears on the cell. |
| Click a **non-editable** cell on the selected row | Nothing — row stays selected. |
| Edit a cell in the **detail panel** | Single click still works — input appears immediately. |
| Click the location **edit pencil** on an unselected row | Row selects. No edit mode. |
| Click the location **edit pencil** on the selected row | Location input appears. |
