# Shared Filters Across List and Map Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make list-view filters (bedrooms, price, favorites, flag status, garage, commute, monthly cost) also constrain the map view, and let the user adjust filters from either view.

**Architecture:** Lift the filter state and the sort hook out of `ListingsTable` up into the parent page (`HomeContent` in `src/app/page.tsx`), apply filtering once before the data is split to the two views (mirroring how the existing search box already works), and move `<FilterBar>` into the shared top toolbar. The sort control is hidden on the map (a `showSort` prop) because it has no visual effect there.

**Tech Stack:** Next.js (App Router, client components), React, TypeScript, Vitest + Testing Library, Tailwind.

**Spec:** `docs/superpowers/specs/2026-08-02-shared-filters-map-view-design.md`

---

## File structure

Files touched:

- `src/components/FilterBar.tsx` — **modify**: add optional `showSort` prop that hides the sort popover button.
- `src/components/ListingsTable.tsx` — **modify (slim down)**: remove its internal `filters` state, `applyFilters`, `useSort`, `propertyTypes`, and embedded `<FilterBar>`. Receive already-filtered-and-sorted `listings` plus `sort` / `onToggleSort` / `hasAnyListings` via props.
- `src/app/page.tsx` — **modify**: own `filters` state + `useSort`, compute the filtering pipeline, render `<FilterBar>` in the toolbar, feed the filtered data to both `MapView` and `ListingsTable`.
- `src/components/__tests__/FilterBar.test.tsx` — **modify**: add `showSort` coverage.
- `src/components/__tests__/ListingsTable.test.tsx` — **modify**: it no longer owns filtering; test that it renders given listings and shows the right empty-state message.
- `src/app/__tests__/page.filters.test.tsx` — **create**: assert filters apply in the table view and carry over to the map view.

No data-model, API, or dependency changes.

---

## Task 1: Add a `showSort` prop to FilterBar

**Files:**
- Modify: `src/components/FilterBar.tsx`
- Test: `src/components/__tests__/FilterBar.test.tsx`

- [ ] **Step 1: Add the failing tests**

Append these two tests inside the existing `describe('FilterBar flag status control', ...)` block in `src/components/__tests__/FilterBar.test.tsx` (or add a new `describe` — either is fine), just before its closing `})`:

```tsx
  it('shows the sort button by default', () => {
    render(
      <FilterBar
        propertyTypes={[]}
        filters={EMPTY_FILTERS}
        onFilterChange={() => {}}
        sort={[]}
        onSortChange={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /^Sort$/ })).toBeInTheDocument()
  })

  it('hides the sort button when showSort is false', () => {
    render(
      <FilterBar
        propertyTypes={[]}
        filters={EMPTY_FILTERS}
        onFilterChange={() => {}}
        sort={[]}
        onSortChange={() => {}}
        showSort={false}
      />
    )
    expect(screen.queryByRole('button', { name: /^Sort$/ })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Run the tests to verify the new "hides" test fails**

Run: `npx vitest run src/components/__tests__/FilterBar.test.tsx`
Expected: the `hides the sort button when showSort is false` test FAILS (TypeScript will also flag `showSort` as an unknown prop). The `shows the sort button by default` test passes.

- [ ] **Step 3: Add the `showSort` prop to FilterBar**

In `src/components/FilterBar.tsx`, add `showSort` to the props interface:

```tsx
interface FilterBarProps {
  propertyTypes: string[]
  filters: Filters
  onFilterChange: (filters: Filters) => void
  sort: SortState
  onSortChange: (next: SortState) => void
  showSort?: boolean
}
```

Update the function signature to destructure it with a default of `true`:

```tsx
export function FilterBar({
  propertyTypes,
  filters,
  onFilterChange,
  sort,
  onSortChange,
  showSort = true,
}: FilterBarProps) {
```

Wrap the sort popover block in `{showSort && ( ... )}`. Replace this existing block:

```tsx
      <div ref={sortPopover.ref} className="relative">
        <button
          onClick={() => sortPopover.setOpen(!sortPopover.open)}
          aria-label={sort.length > 0 ? `Sort (${sort.length} active)` : 'Sort'}
          title="Sort"
          className={`${iconBtnBase} ${sort.length > 0 ? iconBtnFilterActive : iconBtnIdle}`}
        >
          <SortIcon />
          {sort.length > 0 && <CountBadge count={sort.length} />}
        </button>
        {sortPopover.open && (
          <div className="absolute top-full left-0 mt-1 z-20">
            <SortPanel sort={sort} onChange={onSortChange} />
          </div>
        )}
      </div>
```

with the same block wrapped in a `showSort` guard:

```tsx
      {showSort && (
        <div ref={sortPopover.ref} className="relative">
          <button
            onClick={() => sortPopover.setOpen(!sortPopover.open)}
            aria-label={sort.length > 0 ? `Sort (${sort.length} active)` : 'Sort'}
            title="Sort"
            className={`${iconBtnBase} ${sort.length > 0 ? iconBtnFilterActive : iconBtnIdle}`}
          >
            <SortIcon />
            {sort.length > 0 && <CountBadge count={sort.length} />}
          </button>
          {sortPopover.open && (
            <div className="absolute top-full left-0 mt-1 z-20">
              <SortPanel sort={sort} onChange={onSortChange} />
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/__tests__/FilterBar.test.tsx`
Expected: PASS (all tests, including both new ones).

- [ ] **Step 5: Commit**

```bash
git add src/components/FilterBar.tsx src/components/__tests__/FilterBar.test.tsx
git commit -m "feat(filters): add showSort prop to FilterBar"
```

---

## Task 2: Lift filters and sort to the page; slim down ListingsTable

`ListingsTable` and `page.tsx` are tightly coupled — the page constructs the table — so the table's prop-signature change and the page's state-lifting land together in one task. Both source files and the table's test are updated so the suite stays green at the end of the task.

**Files:**
- Modify: `src/components/ListingsTable.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/components/__tests__/ListingsTable.test.tsx`

- [ ] **Step 1: Rewrite the ListingsTable test to the new prop shape**

Replace the entire contents of `src/components/__tests__/ListingsTable.test.tsx` with:

```tsx
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ListingsTable } from '../ListingsTable'
import type { Listing } from '@/types/listing'

const BASE: Listing = {
  id: '1',
  centris_link: null,
  broker_link: null,
  location: 'Laval',
  full_address: null,
  mls_number: null,
  property_type: 'Condo',
  price: 100000,
  taxes_yearly: null,
  common_fees_yearly: null,
  bedrooms: null,
  liveable_area_sqft: null,
  price_per_sqft: null,
  parking: null,
  year_built: null,
  hydro_yearly: null,
  downpayment: null,
  monthly_mortgage: null,
  total_monthly_cost: null,
  commute_school_car: null,
  commute_school_has_toll: null,
  commute_pvm_transit: null,
  notes: null,
  personal_rating: null,
  status: 'active',
  status_checked_at: null,
  previous_price: null,
  price_changed_at: null,
  favorite: false,
  flagged_for_deletion: false,
  image_url: null,
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
})

function row(id: string): Listing {
  return { ...BASE, id, location: `L-${id}` }
}

function renderTable(listings: Listing[], overrides: Record<string, unknown> = {}) {
  return render(
    <ListingsTable
      listings={listings}
      sort={[]}
      onToggleSort={() => {}}
      hasAnyListings={listings.length > 0}
      selectedId={null}
      onSelect={() => {}}
      onUpdate={() => {}}
      compareIds={new Set()}
      onToggleCompare={() => {}}
      {...overrides}
    />,
  )
}

describe('ListingsTable', () => {
  it('renders the listings it is given', () => {
    renderTable([row('a'), row('b')])
    expect(screen.getByText('L-a')).toBeInTheDocument()
    expect(screen.getByText('L-b')).toBeInTheDocument()
  })

  it('does not render the filter bar (filters live in the page toolbar now)', () => {
    renderTable([row('a')])
    expect(screen.queryByRole('radiogroup', { name: /Flag status/ })).not.toBeInTheDocument()
  })

  it('shows the filtered-empty message when given no rows but listings exist', () => {
    renderTable([], { hasAnyListings: true })
    expect(screen.getByText(/No listings match your filters/i)).toBeInTheDocument()
  })

  it('shows the no-listings message when there are none at all', () => {
    renderTable([], { hasAnyListings: false })
    expect(screen.getByText(/No listings yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the table test to verify it fails**

Run: `npx vitest run src/components/__tests__/ListingsTable.test.tsx`
Expected: FAIL — TypeScript/prop errors, because `ListingsTable` does not yet accept `sort`, `onToggleSort`, or `hasAnyListings`.

- [ ] **Step 3: Rewrite ListingsTable to receive filtered/sorted data via props**

Replace the entire contents of `src/components/ListingsTable.tsx` with:

```tsx
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TableHeader } from './TableHeader'
import { TableRow } from './TableRow'
import { RefreshStatusesButton } from './RefreshStatusesButton'
import { BatchDeleteUnavailableButton } from './BatchDeleteUnavailableButton'
import { timeAgo } from '@/lib/time-ago'
import { useTableKeyboard } from '@/hooks/useTableKeyboard'
import type { SortState } from '@/hooks/useSort'
import type { Listing } from '@/types/listing'

interface ListingsTableProps {
  listings: Listing[]
  sort: SortState
  onToggleSort: (column: string, shift: boolean) => void
  hasAnyListings: boolean
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  compareIds: Set<string>
  onToggleCompare: (id: string) => void
  onRefreshed?: () => void
  beginBulkSoftDelete?: (ids: string[]) => { commit: () => Promise<boolean>; undo: () => void; count: number }
}

export function ListingsTable({
  listings,
  sort,
  onToggleSort,
  hasAnyListings,
  selectedId,
  onSelect,
  onUpdate,
  compareIds,
  onToggleCompare,
  onRefreshed,
  beginBulkSoftDelete,
}: ListingsTableProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null)

  useTableKeyboard({
    listings,
    focusedId,
    selectedId,
    setFocusedId,
    setSelectedId: onSelect,
    onToggleCompare,
  })

  const handleRowSelect = useCallback((id: string) => {
    setFocusedId(id)
    onSelect(id)
  }, [onSelect])

  useEffect(() => {
    if (focusedId !== null && !listings.some(l => l.id === focusedId)) {
      setFocusedId(null)
    }
  }, [listings, focusedId])

  const unavailableIds = useMemo(
    () => listings.filter(l => l.status === 'unavailable').map(l => l.id),
    [listings],
  )

  const lastCheckedAgo = useMemo(() => {
    const latest = listings
      .map(l => l.status_checked_at)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1)
    return timeAgo(latest ?? null)
  }, [listings])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <RefreshStatusesButton onRefreshed={() => onRefreshed?.()} />
          {beginBulkSoftDelete && (
            <BatchDeleteUnavailableButton
              unavailableIds={unavailableIds}
              beginBulkSoftDelete={beginBulkSoftDelete}
              onDeleted={() => onRefreshed?.()}
            />
          )}
          {lastCheckedAgo && (
            <span className="text-xs text-fg-subtle">Last checked: {lastCheckedAgo}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-xs text-fg-subtle" title="Keyboard shortcuts: Arrow keys to navigate, Enter to open, Esc to close, c to toggle compare">
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">↑↓</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">Enter</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">Esc</kbd>{' '}
            <kbd className="px-1 py-0.5 text-[10px] font-mono bg-surface-muted border border-border rounded">c</kbd>
          </span>
          <span className="text-sm text-fg-subtle">
            {listings.length} listing{listings.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <TableHeader sort={sort} onSort={onToggleSort} hasCompare />
          <tbody>
            {listings.map(listing => (
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
            {listings.length === 0 && (
              <tr>
                <td colSpan={99} className="px-4 py-12 text-center text-fg-subtle text-sm">
                  {!hasAnyListings
                    ? 'No listings yet. Click "Add listing" to get started.'
                    : 'No listings match your filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Note: `unavailableIds` and `lastCheckedAgo` are now derived from the filtered `listings` prop (they were already derived from the search-filtered list before). This is intentional — those list-view controls reflect what is currently shown.

- [ ] **Step 4: Run the table test to verify it passes**

Run: `npx vitest run src/components/__tests__/ListingsTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Lift filter + sort state into the page and render FilterBar in the toolbar**

Make the following edits to `src/app/page.tsx`.

**(a) Update imports.** Replace this line:

```tsx
import { useState, useEffect, useCallback, Suspense } from 'react'
```

with:

```tsx
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react'
```

Add these imports alongside the existing component/hook imports (near the `ListingsTable` import):

```tsx
import { FilterBar } from '@/components/FilterBar'
import { useSort } from '@/hooks/useSort'
import { applyFilters, EMPTY_FILTERS, type Filters } from '@/lib/filters'
```

(The file already imports `filterListings` from `@/lib/search-listings` and `ListingsTable` from `@/components/ListingsTable` — leave those.)

**(b) Add filter state.** Just after the existing `const [query, setQuery] = useState('')` line, add:

```tsx
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
```

**(c) Build the filtering pipeline.** Replace this single line:

```tsx
  const visibleListings = filterListings(listings, query)
```

with:

```tsx
  const searched = useMemo(() => filterListings(listings, query), [listings, query])
  const filtered = useMemo(() => applyFilters(searched, filters), [searched, filters])
  const { sorted, sort, toggleSort, setSort } = useSort(filtered)
  const propertyTypes = useMemo(() => {
    const types = new Set(listings.map(l => l.property_type).filter(Boolean) as string[])
    return Array.from(types).sort()
  }, [listings])
```

**(d) Render FilterBar in the toolbar.** The search box lives in a `<div className="relative flex-1 min-w-0"> ... </div>`. Immediately after that closing `</div>` (and before the `{/* Compare cluster ... */}` comment), insert:

```tsx
        <FilterBar
          propertyTypes={propertyTypes}
          filters={filters}
          onFilterChange={setFilters}
          sort={sort}
          onSortChange={setSort}
          showSort={view !== 'map'}
        />
```

**(e) Feed filtered data to both views.** Replace this block:

```tsx
          {view === 'map' ? (
            <MapView listings={visibleListings} onSelect={setSelectedId} />
          ) : query.trim() && visibleListings.length === 0 ? (
            <div className="h-full flex items-center justify-center text-fg-subtle text-sm px-4 text-center">
              No listings match &ldquo;{query.trim()}&rdquo;
            </div>
          ) : (
            <ListingsTable
              listings={visibleListings}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={updateListing}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              onRefreshed={fetchListings}
              beginBulkSoftDelete={beginBulkSoftDelete}
            />
          )}
```

with:

```tsx
          {view === 'map' ? (
            <MapView listings={filtered} onSelect={setSelectedId} />
          ) : (
            <ListingsTable
              listings={sorted}
              sort={sort}
              onToggleSort={toggleSort}
              hasAnyListings={listings.length > 0}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onUpdate={updateListing}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              onRefreshed={fetchListings}
              beginBulkSoftDelete={beginBulkSoftDelete}
            />
          )}
```

(The page-level search "no match" message is removed here on purpose — the table now shows a single unified empty-state message, which still contains the text "No listings match" that the existing search test asserts on.)

- [ ] **Step 6: Run the existing page + component suites to verify nothing regressed**

Run: `npx vitest run src/app/__tests__/page.search.test.tsx src/app/__tests__/page.mobile-redirect.test.tsx src/components/__tests__/ListingsTable.test.tsx src/components/__tests__/FilterBar.test.tsx`
Expected: PASS. In particular `page.search.test.tsx` still passes: typing `verd` shows only Verdun, and searching `zzzzz` shows "No listings match your filters." (matches `/No listings match/i`).

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/ListingsTable.tsx src/components/__tests__/ListingsTable.test.tsx
git commit -m "feat(filters): apply list filters to the map view"
```

---

## Task 3: Page-level test that filters apply in both views

**Files:**
- Test (create): `src/app/__tests__/page.filters.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/__tests__/page.filters.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Listing } from '@/types/listing'

// view is read from useSearchParams; make it controllable per test.
let view = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(view ? `view=${view}` : ''),
}))

// Replace the leaflet-backed map with a stub that just lists what it receives,
// so we can assert which listings reach the map view.
vi.mock('@/components/MapView', () => ({
  default: ({ listings }: { listings: Listing[] }) => (
    <div data-testid="map">
      {listings.map(l => (
        <span key={l.id}>{l.location}</span>
      ))}
    </div>
  ),
}))

const BASE: Listing = {
  id: '1', centris_link: null, broker_link: null, location: null, full_address: null,
  mls_number: null, property_type: null, price: null, taxes_yearly: null,
  common_fees_yearly: null, bedrooms: null, liveable_area_sqft: null, price_per_sqft: null,
  parking: null, year_built: null, hydro_yearly: null, downpayment: null,
  monthly_mortgage: null, total_monthly_cost: null, commute_school_car: null,
  commute_school_has_toll: null, commute_pvm_transit: null, notes: null,
  personal_rating: null, status: 'active', status_checked_at: null, previous_price: null,
  price_changed_at: null, favorite: false, flagged_for_deletion: false, image_url: null,
  latitude: null, longitude: null, created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z', deleted_at: null, criteria: null,
}
const verdun: Listing = { ...BASE, id: 'v', location: 'Verdun', flagged_for_deletion: false }
const rosemont: Listing = { ...BASE, id: 'r', location: 'Rosemont', flagged_for_deletion: true }

vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [verdun, rosemont],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    beginBulkSoftDelete: vi.fn(),
    trashCount: 0,
  }),
}))

import HomePage from '@/app/page'
import { ThemeProvider } from '@/components/ThemeProvider'

function mockDesktop() {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
}

function renderPage() {
  return render(<HomePage />, { wrapper: ThemeProvider })
}

describe('/ filters apply to both views', () => {
  beforeEach(() => { mockDesktop() })
  afterEach(() => { view = ''; vi.restoreAllMocks() })

  it('applies filters to the table view', () => {
    view = ''
    renderPage()
    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.getByText('Rosemont')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /Hide flagged/ }))

    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.queryByText('Rosemont')).toBeNull()
  })

  it('applies filters to the map view', async () => {
    view = 'map'
    renderPage()
    const map = await screen.findByTestId('map')
    expect(within(map).getByText('Verdun')).toBeTruthy()
    expect(within(map).getByText('Rosemont')).toBeTruthy()

    fireEvent.click(screen.getByRole('radio', { name: /Hide flagged/ }))

    expect(within(map).getByText('Verdun')).toBeTruthy()
    expect(within(map).queryByText('Rosemont')).toBeNull()
  })

  it('hides the sort button on the map view', async () => {
    view = 'map'
    renderPage()
    await screen.findByTestId('map')
    expect(screen.queryByRole('button', { name: /^Sort$/ })).toBeNull()
  })
})
```

- [ ] **Step 2: Run the new test to verify it passes**

Run: `npx vitest run src/app/__tests__/page.filters.test.tsx`
Expected: PASS. (If the map test flakes on the dynamic import, note that `findByTestId` already awaits it — the stub has no async work, so it resolves on the first microtask.)

- [ ] **Step 3: Commit**

```bash
git add src/app/__tests__/page.filters.test.tsx
git commit -m "test(filters): verify filters apply to table and map views"
```

---

## Task 4: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the entire test suite**

Run: `npm run test`
Expected: PASS — all suites green.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. (Watch for unused imports in `page.tsx` — `visibleListings` is gone; make sure nothing references it.)

- [ ] **Step 3: Typecheck via build**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 4: Manual smoke check (optional but recommended)**

Start the dev server, open the app on a desktop-width viewport, set a filter (e.g. "Hide flagged" or a min-bedrooms value) on the list, then toggle to the map — the map should show the same reduced set of pins. Change a filter while on the map, toggle back to the list — the list should reflect it. Confirm the sort button is absent on the map and present on the list.

- [ ] **Step 5: Final commit (only if Steps 1–3 required any fixes)**

```bash
git add -A
git commit -m "chore(filters): fixes from full verification"
```

---

## Self-review notes

- **Spec coverage:** state lift (Task 2 step 5a–c), one filtering pipeline feeding both views (Task 2 step 5c/5e), FilterBar in shared toolbar (Task 2 step 5d), `showSort` hiding sort on map (Task 1 + Task 2 step 5d), ListingsTable slim-down (Task 2 step 3), unchanged predicate logic (no edits to `applyFilters`/`filterListings`), tests for FilterBar `showSort` (Task 1), ListingsTable (Task 2 step 1), and cross-view carry-over (Task 3). All spec sections map to a task.
- **In scope only:** no URL/localStorage persistence, no moving of refresh/batch-delete/count controls, no predicate changes — matching the spec's "Out of scope".
- **Type consistency:** the table prop is `onToggleSort` (page passes `toggleSort` from `useSort`); `sort` is `SortState`; `hasAnyListings` is `boolean`; `filters` is `Filters` with `setFilters` as `onFilterChange`. `useSort` returns `{ sorted, sort, toggleSort, setSort }` — all consumed as named.
