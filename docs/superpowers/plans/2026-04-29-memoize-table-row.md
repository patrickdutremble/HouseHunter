# Memoize TableRow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop re-rendering all 50+ table rows on every favorite-toggle / row-click by wrapping `TableRow` in `React.memo` and stabilizing the three callback props it receives.

**Architecture:** `React.memo` skips a re-render when all props are reference-equal to the previous render. Today, three callbacks reaching `TableRow` are recreated every render in their parents — `handleRowSelect` (in `ListingsTable`), `toggleCompare` (in `app/page.tsx`), and `updateListing` (in `useListings`). All three must become stable via `useCallback` for `memo` to actually skip work. `updateListing` reads `listings` state, so we use a `useRef` mirror to keep it dep-free.

**Tech Stack:** React 19, Next.js (App Router), TypeScript, Vitest + React Testing Library.

**Out of scope:** `deleteListing`, `beginBulkSoftDelete`, and `fetchListings` are not consumed by `TableRow`, so they are not modified. `fetchListings` is already wrapped in `useCallback`.

**Why no render-count behavioral test:** Render-count assertions via `React.Profiler` are brittle in jsdom (StrictMode double-renders, batching). We rely on (a) a structural test that asserts `React.memo` wraps the export, and (b) the existing behavior tests in `src/components/__tests__/TableRow.test.tsx` and `ListingsTable.test.tsx` continuing to pass. Final empirical verification is a manual React DevTools Profiler check (Task 5).

---

## File Map

- **Modify:** `src/components/TableRow.tsx` — wrap export in `React.memo`.
- **Modify:** `src/components/ListingsTable.tsx` — wrap `handleRowSelect` in `useCallback`.
- **Modify:** `src/app/page.tsx` — wrap `toggleCompare` in `useCallback`.
- **Modify:** `src/hooks/useListings.ts` — wrap `updateListing` in `useCallback` using a `listingsRef` mirror so the callback has no deps.
- **Modify:** `src/components/__tests__/TableRow.test.tsx` — add structural test asserting memoization.
- **Run:** Existing test files (no edits): `ListingsTable.test.tsx`, `useListings` consumers.

---

### Task 1: Stabilize `handleRowSelect` in `ListingsTable`

`handleRowSelect` is recreated every render. Wrap it in `useCallback` so memoized rows see a stable reference.

**Files:**
- Modify: `src/components/ListingsTable.tsx:43-46`

- [ ] **Step 1: Add `useCallback` to the React import**

In `src/components/ListingsTable.tsx`, change line 3:

```tsx
import { useEffect, useMemo, useState } from 'react'
```

to:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
```

- [ ] **Step 2: Wrap `handleRowSelect` in `useCallback`**

Replace lines 43-46:

```tsx
  const handleRowSelect = (id: string) => {
    setFocusedId(id)
    onSelect(id)
  }
```

with:

```tsx
  const handleRowSelect = useCallback((id: string) => {
    setFocusedId(id)
    onSelect(id)
  }, [onSelect])
```

(`setFocusedId` is a `useState` setter — React guarantees it is stable, so it is not in the deps array.)

- [ ] **Step 3: Run the ListingsTable tests**

Run: `npm test -- src/components/__tests__/ListingsTable.test.tsx --run`
Expected: all tests PASS. No behavior changed.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListingsTable.tsx
git commit -m "perf(table): stabilize handleRowSelect with useCallback"
```

---

### Task 2: Stabilize `toggleCompare` in `app/page.tsx`

`toggleCompare` is recreated every render. It only uses state setters, which are stable, so the dep array is empty.

**Files:**
- Modify: `src/app/page.tsx:3` (import) and `src/app/page.tsx:51-68` (function)

- [ ] **Step 1: Add `useCallback` to the React import**

Change line 3:

```tsx
import { useState, useEffect, Suspense } from 'react'
```

to:

```tsx
import { useState, useEffect, useCallback, Suspense } from 'react'
```

- [ ] **Step 2: Wrap `toggleCompare` in `useCallback`**

Replace lines 51-68:

```tsx
  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        setCompareMaxWarning(false)
        return next
      }
      if (prev.size >= 5) {
        setCompareMaxWarning(true)
        return prev
      }
      const next = new Set(prev)
      next.add(id)
      setCompareMaxWarning(false)
      return next
    })
  }
```

with:

```tsx
  const toggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.has(id)) {
        const next = new Set(prev)
        next.delete(id)
        setCompareMaxWarning(false)
        return next
      }
      if (prev.size >= 5) {
        setCompareMaxWarning(true)
        return prev
      }
      const next = new Set(prev)
      next.add(id)
      setCompareMaxWarning(false)
      return next
    })
  }, [])
```

(All references inside — `setCompareIds`, `setCompareMaxWarning` — are state setters, which are stable. Empty deps are correct.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS. Compare-button selection still works.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "perf(home): stabilize toggleCompare with useCallback"
```

---

### Task 3: Stabilize `updateListing` in `useListings`

`updateListing` reads `listings` state. To make it dep-free (so its identity stays stable across renders), mirror `listings` into a `useRef` and read from the ref inside the callback.

**Files:**
- Modify: `src/hooks/useListings.ts`

- [ ] **Step 1: Add `useRef` to the React import**

Change line 3:

```ts
import { useState, useEffect, useCallback } from 'react'
```

to:

```ts
import { useState, useEffect, useCallback, useRef } from 'react'
```

- [ ] **Step 2: Add a `listingsRef` mirror**

Just after line 14 (`const [trashCount, setTrashCount] = useState(0)`), add:

```ts
  const listingsRef = useRef<Listing[]>([])
  useEffect(() => {
    listingsRef.current = listings
  }, [listings])
```

- [ ] **Step 3: Convert `updateListing` to `useCallback` and read from the ref**

Replace lines 49-84 (the entire `updateListing` function):

```ts
  const updateListing = async (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => {
    const updates: Record<string, unknown> = { [field]: value }

    // Recalculate derived fields if a source field changed
    const recalcFields = ['price', 'taxes_yearly', 'common_fees_yearly', 'hydro_yearly', 'liveable_area_sqft']
    if (recalcFields.includes(field)) {
      const current = listings.find(l => l.id === id)
      if (current) {
        const input = {
          price: field === 'price' ? (value as number) : current.price,
          taxes_yearly: field === 'taxes_yearly' ? (value as number) : current.taxes_yearly,
          common_fees_yearly: field === 'common_fees_yearly' ? (value as number) : current.common_fees_yearly,
          hydro_yearly: field === 'hydro_yearly' ? (value as number) : current.hydro_yearly,
          liveable_area_sqft: field === 'liveable_area_sqft' ? (value as number) : current.liveable_area_sqft,
        }
        const calculated = recalculateListing(input)
        Object.assign(updates, calculated)
      }
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Update local state
    setListings(prev =>
      prev.map(l => (l.id === id ? { ...l, ...updates } as Listing : l))
    )
    return true
  }
```

with:

```ts
  const updateListing = useCallback(async (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => {
    const updates: Record<string, unknown> = { [field]: value }

    // Recalculate derived fields if a source field changed
    const recalcFields = ['price', 'taxes_yearly', 'common_fees_yearly', 'hydro_yearly', 'liveable_area_sqft']
    if (recalcFields.includes(field)) {
      const current = listingsRef.current.find(l => l.id === id)
      if (current) {
        const input = {
          price: field === 'price' ? (value as number) : current.price,
          taxes_yearly: field === 'taxes_yearly' ? (value as number) : current.taxes_yearly,
          common_fees_yearly: field === 'common_fees_yearly' ? (value as number) : current.common_fees_yearly,
          hydro_yearly: field === 'hydro_yearly' ? (value as number) : current.hydro_yearly,
          liveable_area_sqft: field === 'liveable_area_sqft' ? (value as number) : current.liveable_area_sqft,
        }
        const calculated = recalculateListing(input)
        Object.assign(updates, calculated)
      }
    }

    const { error: updateError } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
      return false
    }

    // Update local state
    setListings(prev =>
      prev.map(l => (l.id === id ? { ...l, ...updates } as Listing : l))
    )
    return true
  }, [])
```

(Two changes: function wrapped in `useCallback(..., [])`; `listings.find` → `listingsRef.current.find`.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS, including any inline-edit tests that exercise `updateListing` (e.g. `EditableCell.test.tsx`, `ListingsTable.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useListings.ts
git commit -m "perf(useListings): stabilize updateListing with ref + useCallback"
```

---

### Task 4: Wrap `TableRow` in `React.memo`

With all three callbacks now stable, memoization will actually skip re-renders.

**Files:**
- Modify: `src/components/TableRow.tsx:1` (import) and `src/components/TableRow.tsx:59` + end of function (export wrap)
- Modify: `src/components/__tests__/TableRow.test.tsx` (add structural test)

- [ ] **Step 1: Write the failing structural test**

Open `src/components/__tests__/TableRow.test.tsx`. Add this test at the top of the existing `describe` block (or in a new `describe('memoization', ...)` block at the bottom of the file — pick whichever fits the file's existing layout):

```tsx
  it('is wrapped in React.memo', () => {
    const REACT_MEMO_TYPE = Symbol.for('react.memo')
    expect((TableRow as unknown as { $$typeof?: symbol }).$$typeof).toBe(REACT_MEMO_TYPE)
  })
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- src/components/__tests__/TableRow.test.tsx --run`
Expected: the new `is wrapped in React.memo` test FAILS (received `undefined` or a different symbol). All other tests pass.

- [ ] **Step 3: Add `memo` to the React import in `TableRow.tsx`**

Change line 1:

```tsx
import { useEffect, useRef } from 'react'
```

to:

```tsx
import { memo, useEffect, useRef } from 'react'
```

- [ ] **Step 4: Rename the inner function and re-export wrapped in `memo`**

Find line 59:

```tsx
export function TableRow({ listing, isSelected, isFocused = false, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
```

Change `export function TableRow` to just `function TableRowImpl`:

```tsx
function TableRowImpl({ listing, isSelected, isFocused = false, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
```

Then at the very end of the file (after the closing `}` of the function on line 216), add:

```tsx

export const TableRow = memo(TableRowImpl)
```

(Default shallow-comparison is correct: `listing` references stay equal for unchanged rows because `setListings(prev => prev.map(...))` preserves non-matching items, and bools / stable callbacks compare by value/identity.)

- [ ] **Step 5: Run the test and confirm it passes**

Run: `npm test -- src/components/__tests__/TableRow.test.tsx --run`
Expected: ALL tests PASS, including the new memo test.

- [ ] **Step 6: Run the full test suite**

Run: `npm test -- --run`
Expected: all tests PASS. No behavior change anywhere.

- [ ] **Step 7: Run the type-checker**

Run: `npx tsc --noEmit`
Expected: no errors. (If there are any "TableRow is not assignable" errors at consumer sites, they indicate `memo` changed the inferred type — unlikely, but check.)

- [ ] **Step 8: Commit**

```bash
git add src/components/TableRow.tsx src/components/__tests__/TableRow.test.tsx
git commit -m "perf(table): wrap TableRow in React.memo"
```

---

### Task 5: Manual verification with React DevTools Profiler

The structural test proves `memo` is applied. This step proves the optimization actually works under real conditions.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open the app in Chrome and log in.

- [ ] **Step 2: Open the React DevTools Profiler**

Install [React DevTools](https://chromewebstore.google.com/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi) if not installed. Open DevTools → "Profiler" tab. Check the gear icon → "Highlight updates when components render" so re-renders flash visually.

- [ ] **Step 3: Record a favorite-toggle**

With at least 10 listings visible in the table:
1. Click "Record" in the Profiler tab.
2. Click the favorite star on ONE row.
3. Click "Stop".
4. Inspect the flame graph for that commit.

**Expected:** Only the toggled `TableRow` (and its children) appear in the rendered set. The other ~9 `TableRow` instances appear grayed-out with the label "Did not render" or are absent from the commit. With "Highlight updates" on, only the one toggled row should flash.

If many rows still render, one of the callbacks is still unstable — re-check Tasks 1–3.

- [ ] **Step 4: Record a row-click (selection change)**

1. Record again. Click a different row to select it. Stop recording.

**Expected:** Only the previously-selected row and the newly-selected row re-render (their `isSelected` prop changed). All other rows skip rendering.

- [ ] **Step 5: Report findings to the user**

Tell the user what you observed in the Profiler — specifically the row-render count before vs. after the optimization, in plain language. Example: "On a favorite-toggle with 12 rows visible, only 1 row re-renders now instead of 12."

- [ ] **Step 6: No commit** (verification only).

---

## Summary

After all 5 tasks: `TableRow` is wrapped in `React.memo`; the three callback props it receives (`onSelect`, `onUpdate`, `onToggleCompare`) have stable identities across parent renders; existing tests still pass; manual Profiler check confirms unrelated rows skip renders. Total touched files: 4 source + 1 test.
