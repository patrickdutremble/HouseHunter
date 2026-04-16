# Listing Comparison Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select up to 5 listings via checkboxes and compare them side-by-side on a dedicated page with green highlighting on the best values.

**Architecture:** Checkbox state lives in `page.tsx` as a `Set<string>`. A floating "Compare" button opens `/compare?ids=...` in a new tab. The comparison page fetches listings from Supabase and renders them as aligned vertical columns with a shared `getBestValues()` utility for green highlighting.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase, Tailwind CSS 4, TypeScript

---

### Task 1: Add comparison highlight logic

**Files:**
- Create: `src/lib/comparison.ts`
- Create: `src/lib/__tests__/comparison.test.ts`

This utility determines which listing has the "best" value for each comparable field.

- [ ] **Step 1: Write tests for `getBestValues`**

```ts
// src/lib/__tests__/comparison.test.ts
import { describe, it, expect } from 'vitest'
import { getBestValues } from '../comparison'
import type { Listing } from '@/types/listing'

function makeListing(overrides: Partial<Listing>): Listing {
  return {
    id: 'default',
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
    commute_pvm_transit: null,
    notes: null,
    personal_rating: null,
    status: null,
    favorite: false,
    image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  }
}

describe('getBestValues', () => {
  it('picks lowest price', () => {
    const listings = [
      makeListing({ id: 'a', price: 500000 }),
      makeListing({ id: 'b', price: 300000 }),
      makeListing({ id: 'c', price: 400000 }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set(['b']))
  })

  it('picks highest bedrooms (parses "2+1" as 3)', () => {
    const listings = [
      makeListing({ id: 'a', bedrooms: '2+1' }),
      makeListing({ id: 'b', bedrooms: '4' }),
      makeListing({ id: 'c', bedrooms: '3' }),
    ]
    const best = getBestValues(listings)
    expect(best.bedrooms).toEqual(new Set(['b']))
  })

  it('handles ties — both get highlighted', () => {
    const listings = [
      makeListing({ id: 'a', price: 300000 }),
      makeListing({ id: 'b', price: 300000 }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set(['a', 'b']))
  })

  it('ignores nulls', () => {
    const listings = [
      makeListing({ id: 'a', price: null }),
      makeListing({ id: 'b', price: 400000 }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set())
  })

  it('does not highlight when only one listing has a value', () => {
    const listings = [
      makeListing({ id: 'a', price: 400000 }),
      makeListing({ id: 'b', price: null }),
    ]
    const best = getBestValues(listings)
    expect(best.price).toEqual(new Set())
  })

  it('picks newest year_built', () => {
    const listings = [
      makeListing({ id: 'a', year_built: 1990 }),
      makeListing({ id: 'b', year_built: 2020 }),
    ]
    const best = getBestValues(listings)
    expect(best.year_built).toEqual(new Set(['b']))
  })

  it('picks largest liveable_area_sqft', () => {
    const listings = [
      makeListing({ id: 'a', liveable_area_sqft: 800 }),
      makeListing({ id: 'b', liveable_area_sqft: 1200 }),
    ]
    const best = getBestValues(listings)
    expect(best.liveable_area_sqft).toEqual(new Set(['b']))
  })

  it('picks shortest commute (parses "1:15" as 75 minutes)', () => {
    const listings = [
      makeListing({ id: 'a', commute_school_car: '0:45' }),
      makeListing({ id: 'b', commute_school_car: '1:15' }),
    ]
    const best = getBestValues(listings)
    expect(best.commute_school_car).toEqual(new Set(['a']))
  })

  it('picks most parking spaces', () => {
    const listings = [
      makeListing({ id: 'a', parking: '1' }),
      makeListing({ id: 'b', parking: '2' }),
    ]
    const best = getBestValues(listings)
    expect(best.parking).toEqual(new Set(['b']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/comparison.test.ts`
Expected: FAIL — module `../comparison` not found

- [ ] **Step 3: Implement `getBestValues`**

```ts
// src/lib/comparison.ts
import type { Listing } from '@/types/listing'

type BestMap = Record<string, Set<string>>

/** Parse bedroom strings like "2+1" into a number (3). */
function parseBedrooms(value: string | null): number | null {
  if (value === null) return null
  const parts = value.split('+').map(s => parseInt(s.trim(), 10))
  if (parts.some(isNaN)) return null
  return parts.reduce((a, b) => a + b, 0)
}

/** Parse "H:MM" duration strings into total minutes. */
function parseDuration(value: string | null): number | null {
  if (value === null || value === '') return null
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}

/** Parse parking string into a number. */
function parseParking(value: string | null): number | null {
  if (value === null) return null
  const n = parseInt(value, 10)
  return isNaN(n) ? null : n
}

type Direction = 'min' | 'max'

function findBest(
  listings: Listing[],
  extract: (l: Listing) => number | null,
  direction: Direction,
): Set<string> {
  const entries: { id: string; value: number }[] = []
  for (const l of listings) {
    const v = extract(l)
    if (v !== null) entries.push({ id: l.id, value: v })
  }
  if (entries.length < 2) return new Set()

  const bestValue = direction === 'min'
    ? Math.min(...entries.map(e => e.value))
    : Math.max(...entries.map(e => e.value))

  return new Set(entries.filter(e => e.value === bestValue).map(e => e.id))
}

export function getBestValues(listings: Listing[]): BestMap {
  return {
    price: findBest(listings, l => l.price, 'min'),
    bedrooms: findBest(listings, l => parseBedrooms(l.bedrooms), 'max'),
    liveable_area_sqft: findBest(listings, l => l.liveable_area_sqft, 'max'),
    price_per_sqft: findBest(listings, l => l.price_per_sqft, 'min'),
    parking: findBest(listings, l => parseParking(l.parking), 'max'),
    year_built: findBest(listings, l => l.year_built, 'max'),
    taxes_yearly: findBest(listings, l => l.taxes_yearly, 'min'),
    common_fees_yearly: findBest(listings, l => l.common_fees_yearly, 'min'),
    hydro_yearly: findBest(listings, l => l.hydro_yearly, 'min'),
    downpayment: findBest(listings, l => l.downpayment, 'min'),
    monthly_mortgage: findBest(listings, l => l.monthly_mortgage, 'min'),
    total_monthly_cost: findBest(listings, l => l.total_monthly_cost, 'min'),
    commute_school_car: findBest(listings, l => parseDuration(l.commute_school_car), 'min'),
    commute_pvm_transit: findBest(listings, l => parseDuration(l.commute_pvm_transit), 'min'),
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/comparison.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/comparison.ts src/lib/__tests__/comparison.test.ts
git commit -m "feat: add comparison highlight logic with tests"
```

---

### Task 2: Add checkbox column to the main table

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/ListingsTable.tsx`
- Modify: `src/components/TableRow.tsx`
- Modify: `src/components/TableHeader.tsx`

- [ ] **Step 1: Add `compareIds` state and handlers in `page.tsx`**

In `src/app/page.tsx`, add state and pass it down. After the existing `useState` calls (around line 13), add:

```tsx
const [compareIds, setCompareIds] = useState<Set<string>>(new Set())
const [compareMaxWarning, setCompareMaxWarning] = useState(false)

const toggleCompare = (id: string) => {
  setCompareIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) {
      next.delete(id)
      setCompareMaxWarning(false)
    } else {
      if (next.size >= 5) {
        setCompareMaxWarning(true)
        setTimeout(() => setCompareMaxWarning(false), 2000)
        return prev
      }
      next.add(id)
      setCompareMaxWarning(false)
    }
    return next
  })
}

const clearCompare = () => {
  setCompareIds(new Set())
  setCompareMaxWarning(false)
}

const openCompare = () => {
  const ids = Array.from(compareIds).join(',')
  window.open(`/compare?ids=${ids}`, '_blank')
}
```

Pass new props to `ListingsTable`:

```tsx
<ListingsTable
  listings={listings}
  selectedId={selectedId}
  onSelect={setSelectedId}
  onUpdate={updateListing}
  compareIds={compareIds}
  onToggleCompare={toggleCompare}
/>
```

- [ ] **Step 2: Add the floating Compare button in `page.tsx`**

Add this right before the closing `</div>` of the root element (just after the Trash `<Link>`):

```tsx
{compareIds.size >= 2 && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
    <button
      onClick={openCompare}
      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.166a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
      </svg>
      Compare ({compareIds.size})
    </button>
    <button
      onClick={clearCompare}
      className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg shadow-lg hover:text-slate-600 hover:bg-slate-50 transition-colors"
      title="Clear selection"
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
    {compareMaxWarning && (
      <span className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg shadow-lg">
        Maximum 5 listings
      </span>
    )}
  </div>
)}
```

- [ ] **Step 3: Update `ListingsTable` to accept and pass comparison props**

In `src/components/ListingsTable.tsx`, update the interface and pass props through:

```tsx
interface ListingsTableProps {
  listings: Listing[]
  selectedId: string | null
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null) => void
  compareIds: Set<string>
  onToggleCompare: (id: string) => void
}

export function ListingsTable({ listings, selectedId, onSelect, onUpdate, compareIds, onToggleCompare }: ListingsTableProps) {
```

Pass to `TableHeader`:

```tsx
<TableHeader sort={sort} onSort={toggleSort} hasCompare />
```

Pass to `TableRow`:

```tsx
<TableRow
  key={listing.id}
  listing={listing}
  isSelected={listing.id === selectedId}
  onSelect={onSelect}
  onUpdate={onUpdate}
  isCompared={compareIds.has(listing.id)}
  onToggleCompare={onToggleCompare}
/>
```

Update the empty state `colSpan` remains `{99}` (already large enough).

- [ ] **Step 4: Add checkbox column to `TableHeader`**

In `src/components/TableHeader.tsx`, accept the new prop and add a thin column before the existing columns:

```tsx
interface TableHeaderProps {
  sort: SortState
  onSort: (column: string) => void
  hasCompare?: boolean
}

export function TableHeader({ sort, onSort, hasCompare }: TableHeaderProps) {
  return (
    <thead>
      <tr className="border-b border-slate-200">
        {hasCompare && (
          <th
            className="sticky top-0 z-10 bg-slate-50 px-1 py-2.5 border-b border-slate-200"
            style={{ width: '32px', minWidth: '32px' }}
          />
        )}
        {tableColumns.map(col => {
          // ... existing code unchanged
        })}
      </tr>
    </thead>
  )
}
```

- [ ] **Step 5: Add checkbox cell to `TableRow`**

In `src/components/TableRow.tsx`, accept new props and add a checkbox `<td>` before the existing column loop:

```tsx
interface TableRowProps {
  listing: Listing
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null) => void
  isCompared: boolean
  onToggleCompare: (id: string) => void
}

export function TableRow({ listing, isSelected, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
```

Add a left-border style for compared rows on the `<tr>`:

```tsx
<tr
  onClick={() => onSelect(listing.id)}
  className={`
    border-b border-slate-100 cursor-pointer transition-colors
    ${isSelected ? 'bg-blue-50 border-blue-200' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
    ${hasFlags ? 'ring-1 ring-inset ring-amber-200' : ''}
    ${isCompared ? 'border-l-2 border-l-blue-400' : ''}
  `}
>
```

Add checkbox cell as the first child inside the `<tr>`, before the `{tableColumns.map(...)}`:

```tsx
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
```

- [ ] **Step 6: Verify the app builds**

Run: `npx next build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/components/ListingsTable.tsx src/components/TableRow.tsx src/components/TableHeader.tsx
git commit -m "feat: add comparison checkboxes and floating compare button"
```

---

### Task 3: Build the comparison page

**Files:**
- Create: `src/app/compare/page.tsx`

- [ ] **Step 1: Create the comparison page**

```tsx
// src/app/compare/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getBestValues } from '@/lib/comparison'
import { formatCellValue } from '@/lib/formatting'
import type { Listing } from '@/types/listing'

interface CompareField {
  key: string
  label: string
  format: 'currency' | 'integer' | 'year' | 'duration' | 'text'
}

const compareFields: CompareField[] = [
  { key: 'price', label: 'Price', format: 'currency' },
  { key: 'property_type', label: 'Type', format: 'text' },
  { key: 'bedrooms', label: 'Bedrooms', format: 'text' },
  { key: 'liveable_area_sqft', label: 'Area (sqft)', format: 'integer' },
  { key: 'price_per_sqft', label: '$/sqft', format: 'currency' },
  { key: 'parking', label: 'Parking', format: 'text' },
  { key: 'year_built', label: 'Year Built', format: 'year' },
  { key: 'taxes_yearly', label: 'Taxes/yr', format: 'currency' },
  { key: 'common_fees_yearly', label: 'Fees/yr', format: 'currency' },
  { key: 'hydro_yearly', label: 'Hydro/yr', format: 'currency' },
  { key: 'downpayment', label: 'Downpayment', format: 'currency' },
  { key: 'monthly_mortgage', label: 'Mortgage/mo', format: 'currency' },
  { key: 'total_monthly_cost', label: 'Total/mo', format: 'currency' },
  { key: 'commute_school_car', label: 'School (car)', format: 'duration' },
  { key: 'commute_pvm_transit', label: 'PVM (transit)', format: 'duration' },
  { key: 'notes', label: 'Notes', format: 'text' },
]

export default function ComparePage() {
  const searchParams = useSearchParams()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchListings() {
      const idsParam = searchParams.get('ids')
      if (!idsParam) {
        setLoading(false)
        return
      }

      const ids = idsParam.split(',').slice(0, 5)
      const { data } = await supabase
        .from('listings')
        .select('*')
        .in('id', ids)
        .is('deleted_at', null)

      setListings(data ?? [])
      setLoading(false)
    }

    fetchListings()
  }, [searchParams])

  const bestValues = useMemo(() => getBestValues(listings), [listings])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading comparison...</div>
      </div>
    )
  }

  if (listings.length < 2) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <p className="text-slate-500 text-sm">Select at least 2 listings to compare.</p>
        <Link
          href="/"
          className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
        >
          Back to listings
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            title="Back to listings"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">
            Compare Listings
            <span className="ml-2 text-sm font-normal text-slate-400">
              ({listings.length} listings)
            </span>
          </h1>
        </div>
      </div>

      {/* Comparison grid */}
      <div className="px-6 py-6">
        <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${listings.length}, minmax(0, 1fr))` }}>
          {/* Images */}
          {listings.map(listing => (
            <div key={listing.id} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              {/* Image */}
              {listing.image_url ? (
                <img
                  src={listing.image_url}
                  alt=""
                  className="w-full h-[180px] object-cover"
                />
              ) : (
                <div className="w-full h-[180px] bg-slate-100 flex items-center justify-center">
                  <svg className="text-slate-300" width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Location header */}
              <div className="px-4 py-3 border-b border-slate-100">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.full_address ?? listing.location ?? '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                >
                  {listing.location ?? 'Unknown location'}
                </a>
                {listing.centris_link && (
                  <a
                    href={listing.centris_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-xs text-blue-500 hover:text-blue-700"
                  >
                    Centris &#8599;
                  </a>
                )}
              </div>

              {/* Data rows */}
              <div className="divide-y divide-slate-50">
                {compareFields.map(field => {
                  const value = listing[field.key as keyof Listing]
                  const isBest = bestValues[field.key]?.has(listing.id) ?? false
                  const formatted = formatCellValue(value, field.format)

                  return (
                    <div
                      key={field.key}
                      className={`flex items-start justify-between px-4 py-2 ${isBest ? 'bg-green-50' : ''}`}
                    >
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide shrink-0">
                        {field.label}
                      </span>
                      <span className={`text-sm text-right ${isBest ? 'text-green-700 font-medium' : 'text-slate-700'} ${field.key === 'notes' ? 'whitespace-pre-wrap text-xs' : ''}`}>
                        {formatted}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the app builds**

Run: `npx next build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Commit**

```bash
git add src/app/compare/page.tsx
git commit -m "feat: add comparison page with side-by-side layout and green highlights"
```

---

### Task 4: Manual end-to-end verification

- [ ] **Step 1: Start the dev server and test the full flow**

Run: `npx next dev`

Test checklist:
1. Main table shows a new thin checkbox column on the far left
2. Clicking a checkbox does NOT open the detail panel
3. After checking 2 listings, a "Compare (2)" button appears at the bottom center
4. After checking 5 listings, a 6th cannot be checked
5. The "×" button next to "Compare" clears all checkboxes
6. Clicking "Compare (N)" opens `/compare?ids=...` in a new tab
7. The comparison page shows listings side-by-side as vertical columns
8. Images (or placeholders) display at the top of each column
9. All data rows align horizontally across columns
10. The best value for each numeric field is highlighted in green
11. Ties show green on both listings
12. Missing values are shown as "—" and are not highlighted
13. Location links to Google Maps, Centris link opens the listing page
14. "Back to listings" link works
15. Navigating to `/compare` with no IDs or only 1 valid ID shows the "Select at least 2" message

- [ ] **Step 2: Commit any fixes if needed**

If any issues were found and fixed:

```bash
git add -A
git commit -m "fix: address issues found during comparison tool verification"
```
