# Search Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop toolbar's Centris URL input (+ Paste/Add/status) with a live search box that filters the visible listings by address and notes, in both table and map views.

**Architecture:** A pure `filterListings(listings, query)` helper does case-insensitive substring matching over `location`, `full_address`, and `notes`. `src/app/page.tsx` holds a `query` state, derives `visibleListings`, and passes that to both `ListingsTable` and `MapView`. The scrape endpoint, `extractCentrisUrl`, and the bookmarklet are left untouched — only this page stops using them.

**Tech Stack:** Next.js (App Router, client component), React, TypeScript, Vitest + @testing-library/react.

---

## File Structure

- **Create** `src/lib/search-listings.ts` — pure `filterListings` helper (one responsibility: filtering).
- **Create** `src/lib/__tests__/search-listings.test.ts` — unit tests for the helper.
- **Modify** `src/app/page.tsx` — remove URL/Paste/Add/status + scrape logic; add search box, `query` state, `visibleListings`, no-match message.
- **Create** `src/app/__tests__/page.search.test.tsx` — integration tests for the search UI.
- **Modify** `src/app/__tests__/page.mobile-redirect.test.tsx:61` — update a stale `input[type="url"]` selector.

Test command for the whole suite: `npm test`. Single file: `npx vitest run <path>`.

---

## Task 1: Pure filter helper

**Files:**
- Create: `src/lib/search-listings.ts`
- Test: `src/lib/__tests__/search-listings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/search-listings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { filterListings } from '../search-listings'
import type { Listing } from '@/types/listing'

const BASE: Listing = {
  id: '1',
  centris_link: null,
  broker_link: null,
  location: null,
  full_address: null,
  mls_number: null,
  property_type: null,
  price: null,
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

const verdun: Listing = { ...BASE, id: 'v', location: 'Verdun', full_address: '123 Rue Wellington, Verdun' }
const rosemont: Listing = { ...BASE, id: 'r', location: 'Rosemont', notes: 'great garage and yard' }

describe('filterListings', () => {
  it('returns all listings for an empty or whitespace query', () => {
    expect(filterListings([verdun, rosemont], '')).toEqual([verdun, rosemont])
    expect(filterListings([verdun, rosemont], '   ')).toEqual([verdun, rosemont])
  })

  it('matches on location substring', () => {
    expect(filterListings([verdun, rosemont], 'verd')).toEqual([verdun])
  })

  it('matches on full_address substring', () => {
    expect(filterListings([verdun, rosemont], 'wellington')).toEqual([verdun])
  })

  it('matches on notes substring', () => {
    expect(filterListings([verdun, rosemont], 'garage')).toEqual([rosemont])
  })

  it('is case-insensitive', () => {
    expect(filterListings([verdun, rosemont], 'ROSE')).toEqual([rosemont])
  })

  it('returns an empty array when nothing matches', () => {
    expect(filterListings([verdun, rosemont], 'zzz')).toEqual([])
  })

  it('treats null fields as non-matching, not errors', () => {
    expect(filterListings([BASE], 'anything')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/search-listings.test.ts`
Expected: FAIL — `filterListings` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/search-listings.ts`:

```ts
import type { Listing } from '@/types/listing'

/**
 * Case-insensitive substring filter over a listing's address and notes.
 * An empty/whitespace query returns the input list unchanged.
 */
export function filterListings(listings: Listing[], query: string): Listing[] {
  const q = query.trim().toLowerCase()
  if (!q) return listings
  return listings.filter(l =>
    [l.location, l.full_address, l.notes].some(
      f => (f ?? '').toLowerCase().includes(q)
    )
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/search-listings.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search-listings.ts src/lib/__tests__/search-listings.test.ts
git commit -m "feat(search): add filterListings helper for address/notes search"
```

---

## Task 2: Wire search into the page and remove the URL bar

**Files:**
- Modify: `src/app/page.tsx`
- Test: `src/app/__tests__/page.search.test.tsx` (create)

- [ ] **Step 1: Write the failing integration test**

Create `src/app/__tests__/page.search.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { Listing } from '@/types/listing'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
const verdun: Listing = { ...BASE, id: 'v', location: 'Verdun' }
const rosemont: Listing = { ...BASE, id: 'r', location: 'Rosemont' }

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

describe('/ search bar', () => {
  beforeEach(() => { mockDesktop() })
  afterEach(() => { vi.restoreAllMocks() })

  it('shows a search box and no URL/Paste/Add controls', () => {
    renderPage()
    expect(screen.getByPlaceholderText('Search address or notes…')).toBeTruthy()
    expect(document.querySelector('input[type="url"]')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Paste from clipboard' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Add$/ })).toBeNull()
  })

  it('filters the table as the user types', () => {
    renderPage()
    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.getByText('Rosemont')).toBeTruthy()

    const box = screen.getByPlaceholderText('Search address or notes…')
    fireEvent.change(box, { target: { value: 'verd' } })

    expect(screen.getByText('Verdun')).toBeTruthy()
    expect(screen.queryByText('Rosemont')).toBeNull()
  })

  it('clears the query when Escape is pressed', () => {
    renderPage()
    const box = screen.getByPlaceholderText('Search address or notes…')
    fireEvent.change(box, { target: { value: 'verd' } })
    expect(screen.queryByText('Rosemont')).toBeNull()

    fireEvent.keyDown(box, { key: 'Escape' })
    expect(screen.getByText('Rosemont')).toBeTruthy()
    expect((box as HTMLInputElement).value).toBe('')
  })

  it('shows a no-match message when nothing matches', () => {
    renderPage()
    const box = screen.getByPlaceholderText('Search address or notes…')
    fireEvent.change(box, { target: { value: 'zzzzz' } })
    expect(screen.getByText(/No listings match/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/__tests__/page.search.test.tsx`
Expected: FAIL — placeholder `Search address or notes…` not found (URL bar still present).

- [ ] **Step 3: Remove scrape state, handlers, and imports in `src/app/page.tsx`**

In `src/app/page.tsx`:

1. Delete the import:
```tsx
import { extractCentrisUrl } from '@/lib/extract-centris-url'
```
and add:
```tsx
import { filterListings } from '@/lib/search-listings'
```

2. Delete the `ScrapeStatus` type line:
```tsx
type ScrapeStatus = 'idle' | 'loading' | 'success' | 'error' | 'duplicate'
```

3. Delete these three state lines:
```tsx
const [centrisUrl, setCentrisUrl] = useState('')
const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatus>('idle')
const [scrapeMessage, setScrapeMessage] = useState<string | null>(null)
```
and add in their place:
```tsx
const [query, setQuery] = useState('')
```

4. Delete the entire `handlePaste` function and the entire `handleScrape` function.

5. Delete the `statusColor` const block (the `const statusColor = … 'text-fg-subtle'` assignment near the end, just before `return (`).

- [ ] **Step 4: Add the derived list in `src/app/page.tsx`**

Immediately after the `selectedListing` declaration, add:

```tsx
const visibleListings = filterListings(listings, query)
```

- [ ] **Step 5: Replace the toolbar's left slot in `src/app/page.tsx`**

Replace the whole block that begins with `{/* URL input */}` and ends with the closing of the status-message span (the `{scrapeStatus !== 'idle' … }` block) — i.e. the URL `<input>`, the Paste button, the Add button, and the status `<span>` — with this single search box:

```tsx
{/* Search */}
<div className="relative flex-1 min-w-0">
  <input
    type="text"
    value={query}
    onChange={e => setQuery(e.target.value)}
    onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
    placeholder="Search address or notes…"
    aria-label="Search listings"
    className="w-full px-3 py-1.5 pr-8 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-fg-subtle"
  />
  {query && (
    <button
      onClick={() => setQuery('')}
      aria-label="Clear search"
      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-fg-subtle hover:text-fg-muted rounded"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  )}
</div>
```

- [ ] **Step 6: Feed `visibleListings` to the views and add the no-match message**

Replace the view block (the `{view === 'map' ? (…) : (…)}` inside the main content `<div className="flex-1 overflow-hidden">`) with:

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

- [ ] **Step 7: Run the integration test to verify it passes**

Run: `npx vitest run src/app/__tests__/page.search.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/app/page.tsx src/app/__tests__/page.search.test.tsx
git commit -m "feat(search): replace Centris URL bar with a live search box"
```

---

## Task 3: Fix stale test, then verify the whole suite, lint, and build

**Files:**
- Modify: `src/app/__tests__/page.mobile-redirect.test.tsx:61`

- [ ] **Step 1: Update the stale selector**

In `src/app/__tests__/page.mobile-redirect.test.tsx`, the third test asserts the desktop URL input is absent on narrow viewports using `input[type="url"]`, which no longer exists. Replace that assertion line:

```tsx
expect(container.querySelector('input[type="url"]')).toBeNull()
```

with a check that the search box (the desktop-only control) does not render:

```tsx
expect(container.querySelector('input[aria-label="Search listings"]')).toBeNull()
```

- [ ] **Step 2: Run the two page test files to verify they pass**

Run: `npx vitest run src/app/__tests__/page.mobile-redirect.test.tsx src/app/__tests__/page.search.test.tsx`
Expected: PASS (3 + 4 = 7 tests).

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green (existing suites unchanged plus the two new files).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors. (In particular, confirm no unused-variable warnings from leftover scrape code — if any appear, remove the dead code they point to.)

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: build succeeds with no type errors. (Catches any missed reference to a removed symbol like `centrisUrl` or `handleScrape`.)

- [ ] **Step 6: Commit**

```bash
git add src/app/__tests__/page.mobile-redirect.test.tsx
git commit -m "test(search): update mobile-redirect selector for the new search box"
```

---

## Self-Review Notes

- **Spec coverage:** search box + placeholder (Task 2 Step 5); live filter as you type (Task 2 Steps 4–6 + test); case-insensitive substring over location/full_address/notes (Task 1); Esc + ✕ clear (Task 2 Step 5 + test); no-match message (Task 2 Step 6 + test); both table and map fed `visibleListings` (Task 2 Step 6); removals of URL/Paste/Add/status/scrape state/handlers/import (Task 2 Step 3–5); scrape endpoint & bookmarklet untouched (no tasks touch them); detail panel survives filtering because `selectedListing` still reads from full `listings` (unchanged code) — covered implicitly, no regression task needed. All spec sections map to a task.
- **Placeholder scan:** none — every code step has complete code.
- **Type consistency:** `filterListings(listings: Listing[], query: string): Listing[]` is defined in Task 1 and called identically in Task 2 Step 4. `visibleListings` is used consistently in Steps 4 and 6. Placeholder string `Search address or notes…` and `aria-label="Search listings"` match across page code and both test files.
