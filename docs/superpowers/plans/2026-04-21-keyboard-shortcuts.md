# Keyboard Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add keyboard shortcuts to the listings table — `↑`/`↓` to move between rows, `Enter` to open the detail panel, `Esc` to close it, and `c` to toggle compare for the focused row.

**Architecture:** Introduce a separate "focused row" concept distinct from "selected row". The focused row is the keyboard cursor (highlighted ring, no panel). The selected row is what the DetailPanel shows. Arrow keys move focus only; Enter commits focus → selection. Esc clears the selection (closes panel) but keeps focus. A new `useTableKeyboard` hook owns the document-level keydown listener and handles guards for input focus and modifier keys. The focused row is auto-scrolled into view via a ref map.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Vitest + @testing-library/react for tests. No new dependencies.

**Key UX rules:**
- Shortcuts are ignored when an `<input>`, `<textarea>`, or `contenteditable` element is focused, OR when any modifier (Ctrl/Cmd/Alt) is held (so Ctrl+C, Cmd+R, etc. still work).
- `↑`/`↓` with no focused row picks the first/last row respectively.
- `↑`/`↓` never leaves selection alone — it always replaces `focusedId`. Selection only changes on `Enter` (or a mouse click, which keeps existing behaviour).
- `Esc` clears `selectedId` (closes panel); if no panel is open, it clears `focusedId` instead.
- `c` is ignored if nothing is focused.
- Clicking a row sets BOTH focusedId and selectedId (existing click behaviour continues to open the panel).
- Shortcuts only active while the table view is mounted — map view unmounts `ListingsTable`, which removes the listener.

---

### Task 1: Widen `onSelect` prop to accept `null`

**Files:**
- Modify: `src/components/ListingsTable.tsx:15`
- Modify: `src/components/DetailPanel.tsx` (no change needed — `onClose` already used)
- Modify: `src/app/page.tsx` (no change needed — `setSelectedId` already accepts `null`)

**Why:** `Esc` needs to clear `selectedId`. The current type `(id: string) => void` forbids passing `null`. `setSelectedId` in `page.tsx` is already `Dispatch<SetStateAction<string | null>>`, so widening the prop is purely a type change.

- [ ] **Step 1: Update the prop type**

In `src/components/ListingsTable.tsx`, change the `onSelect` prop type on the `ListingsTableProps` interface:

```tsx
interface ListingsTableProps {
  listings: Listing[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  compareIds: Set<string>
  onToggleCompare: (id: string) => void
  onRefreshed?: () => void
}
```

- [ ] **Step 2: Verify the call sites still typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0 with no type errors. `TableRow`'s `onSelect: (id: string) => void` stays narrower — that's fine because a function accepting `string | null` is assignable where `string` is expected only if contravariant; but since we pass the parent's `onSelect` directly to `TableRow` as `(id: string) => void`, assignment is safe (narrowing input contravariantly). If TS complains, adapt the `TableRow` prop type identically.

- [ ] **Step 3: Commit**

```bash
git add src/components/ListingsTable.tsx
git commit -m "refactor(table): widen onSelect to accept null for upcoming Esc handler"
```

---

### Task 2: Create the pure navigation helper

**Files:**
- Create: `src/lib/keyboard-nav.ts`
- Create: `src/lib/__tests__/keyboard-nav.test.ts`

**Why:** Keep the arithmetic for "given a list and a current id, what's next/previous/first/last?" separate from React so it's trivially unit-testable. The hook in Task 4 will delegate to these helpers.

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/keyboard-nav.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextId, prevId, firstId, lastId } from '../keyboard-nav'

const ITEMS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('keyboard-nav', () => {
  describe('nextId', () => {
    it('returns first id when current is null', () => {
      expect(nextId(ITEMS, null)).toBe('a')
    })
    it('returns next id when current is in list', () => {
      expect(nextId(ITEMS, 'a')).toBe('b')
    })
    it('clamps at last id when current is last', () => {
      expect(nextId(ITEMS, 'c')).toBe('c')
    })
    it('returns first id when current is not in list', () => {
      expect(nextId(ITEMS, 'missing')).toBe('a')
    })
    it('returns null when list is empty', () => {
      expect(nextId([], null)).toBeNull()
      expect(nextId([], 'a')).toBeNull()
    })
  })

  describe('prevId', () => {
    it('returns last id when current is null', () => {
      expect(prevId(ITEMS, null)).toBe('c')
    })
    it('returns previous id when current is in list', () => {
      expect(prevId(ITEMS, 'b')).toBe('a')
    })
    it('clamps at first id when current is first', () => {
      expect(prevId(ITEMS, 'a')).toBe('a')
    })
    it('returns last id when current is not in list', () => {
      expect(prevId(ITEMS, 'missing')).toBe('c')
    })
    it('returns null when list is empty', () => {
      expect(prevId([], null)).toBeNull()
    })
  })

  describe('firstId / lastId', () => {
    it('returns first/last for non-empty list', () => {
      expect(firstId(ITEMS)).toBe('a')
      expect(lastId(ITEMS)).toBe('c')
    })
    it('returns null for empty list', () => {
      expect(firstId([])).toBeNull()
      expect(lastId([])).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/keyboard-nav.test.ts`
Expected: FAIL with "Failed to resolve import '../keyboard-nav'".

- [ ] **Step 3: Implement the helpers**

Create `src/lib/keyboard-nav.ts`:

```ts
export interface HasId {
  id: string
}

export function firstId<T extends HasId>(items: T[]): string | null {
  return items[0]?.id ?? null
}

export function lastId<T extends HasId>(items: T[]): string | null {
  return items[items.length - 1]?.id ?? null
}

export function nextId<T extends HasId>(items: T[], current: string | null): string | null {
  if (items.length === 0) return null
  if (current === null) return items[0].id
  const idx = items.findIndex(i => i.id === current)
  if (idx === -1) return items[0].id
  if (idx >= items.length - 1) return items[idx].id
  return items[idx + 1].id
}

export function prevId<T extends HasId>(items: T[], current: string | null): string | null {
  if (items.length === 0) return null
  if (current === null) return items[items.length - 1].id
  const idx = items.findIndex(i => i.id === current)
  if (idx === -1) return items[items.length - 1].id
  if (idx <= 0) return items[0].id
  return items[idx - 1].id
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/keyboard-nav.test.ts`
Expected: PASS all 12 assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/keyboard-nav.ts src/lib/__tests__/keyboard-nav.test.ts
git commit -m "feat(lib): add pure keyboard navigation helpers"
```

---

### Task 3: Create the `useTableKeyboard` hook

**Files:**
- Create: `src/hooks/useTableKeyboard.ts`
- Create: `src/hooks/__tests__/useTableKeyboard.test.tsx`

**Why:** Encapsulates the document-level keydown listener, the input-focus guard, the modifier-key guard, and the shortcut routing. Keeping it in a hook (not inline in `ListingsTable`) lets us test the behaviour without rendering a whole table.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/__tests__/useTableKeyboard.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import { useTableKeyboard } from '../useTableKeyboard'

interface Harness {
  listings: { id: string }[]
  focusedId: string | null
  selectedId: string | null
  setFocusedId?: (id: string | null) => void
  setSelectedId?: (id: string | null) => void
  onToggleCompare?: (id: string) => void
}

function Harness(props: Harness) {
  useTableKeyboard({
    listings: props.listings,
    focusedId: props.focusedId,
    selectedId: props.selectedId,
    setFocusedId: props.setFocusedId ?? (() => {}),
    setSelectedId: props.setSelectedId ?? (() => {}),
    onToggleCompare: props.onToggleCompare ?? (() => {}),
  })
  return null
}

function press(key: string, opts: Partial<KeyboardEventInit> = {}) {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...opts }))
  })
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

const LISTINGS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('useTableKeyboard', () => {
  it('ArrowDown moves focus to next row', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown')
    expect(setFocusedId).toHaveBeenCalledWith('b')
  })

  it('ArrowDown with no focus picks first row', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId={null} selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown')
    expect(setFocusedId).toHaveBeenCalledWith('a')
  })

  it('ArrowUp moves focus to previous row', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowUp')
    expect(setFocusedId).toHaveBeenCalledWith('a')
  })

  it('Enter sets selectedId to focusedId', () => {
    const setSelectedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} setSelectedId={setSelectedId} />)
    press('Enter')
    expect(setSelectedId).toHaveBeenCalledWith('b')
  })

  it('Enter does nothing when nothing is focused', () => {
    const setSelectedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId={null} selectedId={null} setSelectedId={setSelectedId} />)
    press('Enter')
    expect(setSelectedId).not.toHaveBeenCalled()
  })

  it('Escape clears selection when panel is open', () => {
    const setSelectedId = vi.fn()
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId="b" setSelectedId={setSelectedId} setFocusedId={setFocusedId} />)
    press('Escape')
    expect(setSelectedId).toHaveBeenCalledWith(null)
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('Escape clears focus when no panel is open', () => {
    const setSelectedId = vi.fn()
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} setSelectedId={setSelectedId} setFocusedId={setFocusedId} />)
    press('Escape')
    expect(setFocusedId).toHaveBeenCalledWith(null)
    expect(setSelectedId).not.toHaveBeenCalled()
  })

  it('c toggles compare on focused row', () => {
    const onToggleCompare = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="b" selectedId={null} onToggleCompare={onToggleCompare} />)
    press('c')
    expect(onToggleCompare).toHaveBeenCalledWith('b')
  })

  it('c does nothing when nothing is focused', () => {
    const onToggleCompare = vi.fn()
    render(<Harness listings={LISTINGS} focusedId={null} selectedId={null} onToggleCompare={onToggleCompare} />)
    press('c')
    expect(onToggleCompare).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when focus is inside an <input>', () => {
    const setFocusedId = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown')
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when focus is inside a <textarea>', () => {
    const setFocusedId = vi.fn()
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown')
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('ignores shortcuts when a modifier key is held', () => {
    const setFocusedId = vi.fn()
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} setFocusedId={setFocusedId} />)
    press('ArrowDown', { ctrlKey: true })
    press('ArrowDown', { metaKey: true })
    press('ArrowDown', { altKey: true })
    expect(setFocusedId).not.toHaveBeenCalled()
  })

  it('prevents default on ArrowDown to stop page scroll', () => {
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} />)
    const ev = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    act(() => { document.dispatchEvent(ev) })
    expect(ev.defaultPrevented).toBe(true)
  })

  it('does not prevent default on unrelated keys', () => {
    render(<Harness listings={LISTINGS} focusedId="a" selectedId={null} />)
    const ev = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true })
    act(() => { document.dispatchEvent(ev) })
    expect(ev.defaultPrevented).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useTableKeyboard.test.tsx`
Expected: FAIL with "Failed to resolve import '../useTableKeyboard'".

- [ ] **Step 3: Implement the hook**

Create `src/hooks/useTableKeyboard.ts`:

```ts
'use client'

import { useEffect } from 'react'
import { nextId, prevId } from '@/lib/keyboard-nav'

interface HasId {
  id: string
}

interface UseTableKeyboardArgs<T extends HasId> {
  listings: T[]
  focusedId: string | null
  selectedId: string | null
  setFocusedId: (id: string | null) => void
  setSelectedId: (id: string | null) => void
  onToggleCompare: (id: string) => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  return false
}

export function useTableKeyboard<T extends HasId>({
  listings,
  focusedId,
  selectedId,
  setFocusedId,
  setSelectedId,
  onToggleCompare,
}: UseTableKeyboardArgs<T>) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      if (isTypingTarget(document.activeElement)) return

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault()
          const next = nextId(listings, focusedId)
          if (next !== null) setFocusedId(next)
          break
        }
        case 'ArrowUp': {
          e.preventDefault()
          const prev = prevId(listings, focusedId)
          if (prev !== null) setFocusedId(prev)
          break
        }
        case 'Enter': {
          if (focusedId === null) return
          e.preventDefault()
          setSelectedId(focusedId)
          break
        }
        case 'Escape': {
          if (selectedId !== null) {
            e.preventDefault()
            setSelectedId(null)
          } else if (focusedId !== null) {
            e.preventDefault()
            setFocusedId(null)
          }
          break
        }
        case 'c':
        case 'C': {
          if (focusedId === null) return
          e.preventDefault()
          onToggleCompare(focusedId)
          break
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [listings, focusedId, selectedId, setFocusedId, setSelectedId, onToggleCompare])
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/__tests__/useTableKeyboard.test.tsx`
Expected: PASS all 14 assertions.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTableKeyboard.ts src/hooks/__tests__/useTableKeyboard.test.tsx
git commit -m "feat(hooks): add useTableKeyboard for arrow/enter/esc/c shortcuts"
```

---

### Task 4: Wire the hook into `ListingsTable` with `focusedId` state

**Files:**
- Modify: `src/components/ListingsTable.tsx`

**Why:** `ListingsTable` owns the filtered+sorted listings, so it's the natural host for keyboard state. Adding `focusedId` local state + the hook gives arrow/enter/esc/c behaviour. The `onSelect` callback must also clear focus on external clicks, and row clicks should update focus too — pass a wrapped `onSelect` to `TableRow`.

- [ ] **Step 1: Update imports and add state**

In `src/components/ListingsTable.tsx`, update the imports and add focused state. Replace lines 1-22 with:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { TableHeader } from './TableHeader'
import { TableRow } from './TableRow'
import { FilterBar, type Filters } from './FilterBar'
import { RefreshStatusesButton } from './RefreshStatusesButton'
import { timeAgo } from '@/lib/time-ago'
import { useSort } from '@/hooks/useSort'
import { useTableKeyboard } from '@/hooks/useTableKeyboard'
import type { Listing } from '@/types/listing'

interface ListingsTableProps {
  listings: Listing[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  compareIds: Set<string>
  onToggleCompare: (id: string) => void
  onRefreshed?: () => void
}

export function ListingsTable({ listings, selectedId, onSelect, onUpdate, compareIds, onToggleCompare, onRefreshed }: ListingsTableProps) {
  const [filters, setFilters] = useState<Filters>({ type: '', minPrice: '', maxPrice: '', favoritesOnly: false })
  const [focusedId, setFocusedId] = useState<string | null>(null)
```

- [ ] **Step 2: Invoke the hook after `sorted` is computed**

Immediately after the `const { sorted, sort, toggleSort } = useSort(filtered)` line (line 41 in the original), insert:

```tsx
  useTableKeyboard({
    listings: sorted,
    focusedId,
    selectedId,
    setFocusedId,
    setSelectedId: onSelect,
    onToggleCompare,
  })

  const handleRowSelect = (id: string) => {
    setFocusedId(id)
    onSelect(id)
  }
```

- [ ] **Step 3: Pass `handleRowSelect` and `isFocused` to `TableRow`**

In the `<tbody>` map, replace the `TableRow` invocation with:

```tsx
            {sorted.map(listing => (
              <TableRow
                key={listing.id}
                listing={listing}
                isSelected={listing.id === selectedId}
                isFocused={listing.id === focusedId}
                onSelect={handleRowSelect}
                onUpdate={onUpdate}
                isCompared={compareIds.has(listing.id)}
                onToggleCompare={onToggleCompare}
              />
            ))}
```

(The `isFocused` prop will be wired up in Task 5.)

- [ ] **Step 4: Run the existing tests to catch regressions**

Run: `npx vitest run`
Expected: All existing tests PASS. The `TableRow.test.tsx` file does not pass `isFocused`, so the prop will need a default — that's handled in Task 5.

- [ ] **Step 5: Commit**

```bash
git add src/components/ListingsTable.tsx
git commit -m "feat(table): track focusedId and wire useTableKeyboard"
```

---

### Task 5: Add `isFocused` prop + visual ring on `TableRow`, and auto-scroll

**Files:**
- Modify: `src/components/TableRow.tsx`
- Modify: `src/components/__tests__/TableRow.test.tsx`

**Why:** The user needs to see which row the arrow keys are on. Use a blue ring that's distinct from the blue-50 background of `isSelected` — so a row can be "focused but not selected" (arrow-keyed but Enter not yet pressed) or "focused and selected" (both). Also scroll the focused row into view when it changes off-screen so long tables remain keyboard-navigable.

- [ ] **Step 1: Write failing tests for the new prop**

In `src/components/__tests__/TableRow.test.tsx`, replace the `renderRow` helper to accept `isFocused` and add new test cases. First, update the helper (around lines 44-57):

```tsx
function renderRow(listing: Listing, opts: { isFocused?: boolean; isSelected?: boolean } = {}) {
  return render(
    <table><tbody>
      <TableRow
        listing={listing}
        isSelected={opts.isSelected ?? false}
        isFocused={opts.isFocused ?? false}
        onSelect={() => {}}
        onUpdate={() => {}}
        isCompared={false}
        onToggleCompare={() => {}}
      />
    </tbody></table>,
  )
}
```

Then append to the existing `describe('TableRow', () => { ... })` block, just before its closing `})`:

```tsx
  it('applies a focus ring class when isFocused is true', () => {
    renderRow({ ...BASE, id: 'f1' }, { isFocused: true })
    const row = screen.getByRole('row')
    expect(row.className).toMatch(/ring-2/)
    expect(row.className).toMatch(/ring-blue-400/)
  })

  it('does not apply the focus ring when isFocused is false', () => {
    renderRow({ ...BASE, id: 'f2' }, { isFocused: false })
    const row = screen.getByRole('row')
    expect(row.className).not.toMatch(/ring-blue-400/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/TableRow.test.tsx`
Expected: FAIL — either on the new assertions (no `ring-blue-400`) or at type-check on the unknown `isFocused` prop.

- [ ] **Step 3: Add the `isFocused` prop + ref to `TableRow`**

In `src/components/TableRow.tsx`, replace the full file contents with:

```tsx
import { useEffect, useRef } from 'react'
import { tableColumns } from '@/lib/columns'
import { criteria, countChecked, deriveCriteria } from '@/lib/criteria'
import { EditableCell } from './EditableCell'
import { LocationCell } from './LocationCell'
import { FavoriteButton } from './FavoriteButton'
import type { Listing } from '@/types/listing'

interface TableRowProps {
  listing: Listing
  isSelected: boolean
  isFocused?: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  isCompared: boolean
  onToggleCompare: (id: string) => void
}

const PRICE_CHANGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function formatPriceDelta(current: number, previous: number): string {
  const delta = Math.abs(current - previous)
  const rounded = Math.round(delta / 1000)
  return `$${rounded}k`
}

interface PriceChangeBadge {
  label: string
  colorClass: string
}

function computePriceChangeBadge(listing: Listing): PriceChangeBadge | null {
  if (!listing.price_changed_at || listing.previous_price == null || listing.price == null) return null
  const changedAt = new Date(listing.price_changed_at).getTime()
  if (Number.isNaN(changedAt)) return null
  if (Date.now() - changedAt > PRICE_CHANGE_WINDOW_MS) return null

  const dropped = listing.price < listing.previous_price
  const arrow = dropped ? '\u2193' : '\u2191'
  const color = dropped ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
  return {
    label: `${arrow} ${formatPriceDelta(listing.price, listing.previous_price)}`,
    colorClass: color,
  }
}

export function TableRow({ listing, isSelected, isFocused = false, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null)
  const hasHighFees = (listing.common_fees_yearly ?? 0) > 6000
  const hasFlags = listing.notes && (
    listing.notes.toLowerCase().includes('foundation') ||
    listing.notes.toLowerCase().includes('water') ||
    listing.notes.toLowerCase().includes('sewer')
  )
  const isUnavailable = listing.status === 'unavailable'
  const priceBadge = computePriceChangeBadge(listing)

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isFocused])

  return (
    <tr
      ref={rowRef}
      onClick={() => onSelect(listing.id)}
      className={`
        border-b border-slate-100 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-blue-200' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
        ${hasFlags ? 'ring-1 ring-inset ring-amber-200' : ''}
        ${isFocused ? 'ring-2 ring-inset ring-blue-400' : ''}
        ${isCompared ? 'border-l-2 border-l-blue-400' : ''}
        ${isUnavailable ? 'opacity-50' : ''}
      `}
    >
      <td
        className="px-1 py-2.5 text-center"
        style={{ width: '32px', minWidth: '32px' }}
        onClick={e => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isCompared}
          onChange={() => onToggleCompare(listing.id)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>
      {tableColumns.map(col => {
        if (col.key === 'favorite') {
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-center"
              style={{ width: col.width, minWidth: col.width }}
              onClick={e => e.stopPropagation()}
            >
              <FavoriteButton
                value={listing.favorite}
                onToggle={() => onUpdate(listing.id, 'favorite', !listing.favorite)}
              />
            </td>
          )
        }

        if (col.key === 'criteria_count') {
          const checked = countChecked(deriveCriteria(listing))
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-slate-700 text-right"
              style={{ width: col.width, minWidth: col.width }}
            >
              {checked}/{criteria.length}
            </td>
          )
        }

        if (col.key === 'location') {
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-slate-700"
              style={{ width: col.width, minWidth: col.width }}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LocationCell
                    text={listing.location}
                    mapQuery={listing.full_address ?? listing.location}
                    editable={col.editable}
                    isSelected={isSelected}
                    imageUrl={listing.image_url}
                    onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
                  />
                </div>
                {isUnavailable && (
                  <span
                    className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    data-testid="unavailable-pill"
                  >
                    Unavailable
                  </span>
                )}
              </div>
            </td>
          )
        }

        const value = listing[col.key as keyof Listing]
        const isHighFeeCell = col.key === 'common_fees_yearly' && hasHighFees
        const showPriceBadge = col.key === 'price' && priceBadge !== null

        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 text-sm ${isHighFeeCell ? 'bg-red-50 text-red-800 font-medium' : 'text-slate-700'}`}
            style={{ width: col.width, minWidth: col.width }}
          >
            <div className={showPriceBadge ? 'flex items-center justify-end gap-2' : ''}>
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
              {showPriceBadge && priceBadge && (
                <span
                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${priceBadge.colorClass}`}
                  data-testid="price-change-badge"
                >
                  {priceBadge.label}
                </span>
              )}
            </div>
          </td>
        )
      })}
    </tr>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/TableRow.test.tsx`
Expected: PASS. Note: `scrollIntoView` is not implemented by jsdom, so the useEffect may throw — if so, stub it in the test file by adding this at the top of the file (above `describe`):

```tsx
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})
```

And import `beforeAll` and `vi` from `vitest`. Re-run the tests after adding the stub.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TableRow.tsx src/components/__tests__/TableRow.test.tsx
git commit -m "feat(table): show focus ring and auto-scroll focused row into view"
```

---

### Task 6: Manual browser verification

**Files:** None — this is a verification task only.

**Why:** Keyboard behaviour depends on real browser event dispatch, real focus semantics, and real scroll containers. Unit tests with jsdom don't catch issues like "the listing-table scroll container doesn't actually scroll because the overflow is on a parent". Verify end-to-end before claiming done.

- [ ] **Step 1: Start the dev server**

Run `npm run dev` (or use `preview_start` if that's available).

- [ ] **Step 2: Verify `↓` from no selection**

Open `/`. Do NOT click anywhere in the table. Press `↓`.
Expected: The first row gets a blue ring. No detail panel opens.

- [ ] **Step 3: Verify repeated `↓` / `↑` scroll and wrap-clamp**

Keep pressing `↓` past the visible area.
Expected: Row focus advances, and the table scrolls to keep the focused row on screen. At the last row, further `↓` does nothing. Press `↑` repeatedly back to the first row; further `↑` does nothing.

- [ ] **Step 4: Verify `Enter` opens panel**

With a row focused (ring visible), press `Enter`.
Expected: The detail panel opens on the right for that listing. The focused row now also has the `bg-blue-50` selected background (ring + background combined).

- [ ] **Step 5: Verify `Esc` closes the panel**

With the panel open, press `Esc`.
Expected: The panel closes. The focused row still has the ring.

- [ ] **Step 6: Verify `Esc` a second time clears focus**

Press `Esc` again.
Expected: The focus ring disappears.

- [ ] **Step 7: Verify `c` toggles compare**

Focus a row with `↓`. Press `c`.
Expected: The compare checkbox for that row becomes checked, and the left-edge blue border appears. Press `c` again — checkbox unchecks, border disappears.

- [ ] **Step 8: Verify shortcuts are suppressed while typing in the URL input**

Click the "Paste a Centris URL…" input at the top. Press `↓`, `c`, `Enter`.
Expected: None of these affect the table. The URL input behaves normally (typing letters works, Enter triggers the scrape button).

- [ ] **Step 9: Verify shortcuts are suppressed while editing a cell**

Click a row to select it, then click an editable cell (e.g. Notes). While the input is focused, press `↓`, `Esc`.
Expected: `Esc` closes the cell editor (existing EditableCell behaviour) and the cell editor keyboard handlers take priority. `↓` types into the input and does not move focus.

- [ ] **Step 10: Verify modifier keys don't hijack browser shortcuts**

Focus a row, then press `Ctrl+R` (or `Cmd+R` on Mac).
Expected: The browser reloads. Our listener must not have called `preventDefault`. Similarly `Ctrl+C` while a row is focused should copy any selected text, not toggle compare.

- [ ] **Step 11: Verify shortcuts don't fire on the map view**

Navigate to `/?view=map`. Press `↓` and `c`.
Expected: Nothing happens in the table (it's unmounted), no errors in the console.

- [ ] **Step 12: Commit if anything was tweaked, otherwise move on**

If any of the above steps required fixes, commit them with a message like `fix(table): keyboard suppression while editing cell`. Otherwise proceed to Task 7.

---

### Task 7: Add a tiny "keyboard help" hint

**Files:**
- Modify: `src/components/ListingsTable.tsx`

**Why:** Power-user features are useless if users don't know they exist. A single, unobtrusive hint next to the listing count ("↑↓ Enter Esc c") signals the shortcuts without a modal.

- [ ] **Step 1: Add the hint to the header**

In `src/components/ListingsTable.tsx`, find the top-right header element (the `<span>` that reads `{sorted.length} listing{sorted.length !== 1 ? 's' : ''}`) and replace the outer parent div to include the hint. Change:

```tsx
        <span className="text-sm text-slate-500">
          {sorted.length} listing{sorted.length !== 1 ? 's' : ''}
        </span>
```

to:

```tsx
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-slate-400" title="Keyboard shortcuts: Arrow keys to navigate, Enter to open, Esc to close, c to toggle compare">
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">↑↓</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">Enter</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">Esc</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-slate-100 border border-slate-200 rounded">c</kbd>
          </span>
          <span className="text-sm text-slate-500">
            {sorted.length} listing{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
```

- [ ] **Step 2: Manually verify the hint renders**

Reload `/`. The header right-side now shows `↑↓ Enter Esc c` followed by the listing count. Hovering shows the tooltip describing each shortcut.

- [ ] **Step 3: Run full tests and typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: All PASS, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListingsTable.tsx
git commit -m "feat(table): show keyboard-shortcut hint in header"
```

---

## Verification

After completing all tasks, run the full suite once more:

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

Expected: All tests pass, no type errors, no lint errors.

## Summary of files changed

- **New:** `src/lib/keyboard-nav.ts`
- **New:** `src/lib/__tests__/keyboard-nav.test.ts`
- **New:** `src/hooks/useTableKeyboard.ts`
- **New:** `src/hooks/__tests__/useTableKeyboard.test.tsx`
- **Modified:** `src/components/ListingsTable.tsx` (focusedId state, hook wiring, help hint, widened onSelect)
- **Modified:** `src/components/TableRow.tsx` (isFocused prop, ring class, scroll-into-view)
- **Modified:** `src/components/__tests__/TableRow.test.tsx` (isFocused test coverage)
