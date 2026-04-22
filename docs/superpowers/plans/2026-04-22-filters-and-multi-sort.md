# Column Filters + Multi-Column Sort Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the listings table with filters for beds / commute / max monthly cost / has-garage, and replace single-column sort with multi-column sort (shift-click + a Sort panel).

**Architecture:** Pure functional refactor of filter logic into `src/lib/filters.ts`. `useSort` becomes multi-level (`SortLevel[]`). New `FilterPanel` and `SortPanel` popover components replace the inline expanded row. No DB/API changes. State resets on reload.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind, Vitest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-04-22-filters-and-multi-sort-design.md](../specs/2026-04-22-filters-and-multi-sort-design.md)

---

## Context

**Relevant files to read before starting:**

- [src/components/FilterBar.tsx](../../../src/components/FilterBar.tsx) — current filter UI and `Filters` interface.
- [src/components/ListingsTable.tsx:23-45](../../../src/components/ListingsTable.tsx) — inline filter application; call site for `useSort` and `<FilterBar>`.
- [src/hooks/useSort.ts](../../../src/hooks/useSort.ts) — current single-column sort.
- [src/components/TableHeader.tsx](../../../src/components/TableHeader.tsx) — renders sort arrows, receives `sort` + `onSort`.
- [src/lib/columns.ts](../../../src/lib/columns.ts) — column registry; `showInTable` flag.
- [src/types/listing.ts](../../../src/types/listing.ts) — listing schema. **Note:** `commute_school_car` and `commute_pvm_transit` are **strings** like `"23 min"`, not numbers. Parsing required.
- [src/components/__tests__/FilterBar.test.tsx](../../../src/components/__tests__/FilterBar.test.tsx) — existing test patterns.

**Test command:** `npm test` (runs `vitest run`). For a single file: `npx vitest run path/to/file.test.ts`.

**Commute string format:** `${integer} min` (e.g. `"23 min"`). `null` when unknown. Parse with `parseInt(s, 10)`; NaN → treat as null.

**useSort / TableHeader call sites:** only [ListingsTable.tsx](../../../src/components/ListingsTable.tsx). Safe to change their signatures.

---

## File Structure

**New files:**
- `src/lib/filters.ts` — `applyFilters(listings, filters)` pure helper + `Filters` type (moved from FilterBar).
- `src/lib/__tests__/filters.test.ts` — filter tests.
- `src/components/FilterPanel.tsx` — grouped filter controls in a popover.
- `src/components/SortPanel.tsx` — multi-level sort controls in a popover.
- `src/components/__tests__/FilterPanel.test.tsx`
- `src/components/__tests__/SortPanel.test.tsx`
- `src/components/__tests__/TableHeader.test.tsx` — new tests for shift-click + badges.
- `src/hooks/__tests__/useSort.test.ts` — new tests for multi-level sort.

**Modified:**
- `src/components/FilterBar.tsx` — slim down to top-bar orchestration; trigger `FilterPanel` + `SortPanel`.
- `src/hooks/useSort.ts` — `SortLevel[]` state; new comparator.
- `src/components/TableHeader.tsx` — shift-click + rank badges.
- `src/components/ListingsTable.tsx` — initialize new Filters fields; use `applyFilters`; pass multi-level sort state to TableHeader.

**No DB migrations. No API changes.**

---

## Task 1 — Extract filter logic into `src/lib/filters.ts` (pure refactor)

**Goal:** Move filter logic out of `ListingsTable.tsx` and `Filters` out of `FilterBar.tsx` into a pure module, covered by tests. No behavior change.

**Files:**
- Create: `src/lib/filters.ts`
- Create: `src/lib/__tests__/filters.test.ts`
- Modify: `src/components/FilterBar.tsx` (re-export `Filters` from new location)
- Modify: `src/components/ListingsTable.tsx:27-43` (replace inline filter with `applyFilters`)

- [ ] **Step 1.1: Write failing tests for existing filter behavior**

Create `src/lib/__tests__/filters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyFilters, EMPTY_FILTERS } from '@/lib/filters'
import type { Listing } from '@/types/listing'

function mk(partial: Partial<Listing> = {}): Listing {
  return {
    id: 'x', centris_link: null, broker_link: null, location: null,
    full_address: null, mls_number: null, property_type: null,
    price: null, taxes_yearly: null, common_fees_yearly: null,
    bedrooms: null, liveable_area_sqft: null, price_per_sqft: null,
    parking: null, year_built: null, hydro_yearly: null,
    downpayment: null, monthly_mortgage: null, total_monthly_cost: null,
    commute_school_car: null, commute_school_has_toll: null,
    commute_pvm_transit: null, notes: null, personal_rating: null,
    status: 'active', status_checked_at: null, previous_price: null,
    price_changed_at: null, favorite: false, flagged_for_deletion: false,
    image_url: null, latitude: null, longitude: null,
    created_at: '2026-04-01', updated_at: '2026-04-01',
    deleted_at: null, criteria: null,
    ...partial,
  }
}

describe('applyFilters — existing behavior', () => {
  it('EMPTY_FILTERS returns all listings unchanged', () => {
    const listings = [mk({ id: 'a' }), mk({ id: 'b' })]
    expect(applyFilters(listings, EMPTY_FILTERS)).toEqual(listings)
  })

  it('filters by property type', () => {
    const ls = [mk({ id: 'a', property_type: 'Condo' }), mk({ id: 'b', property_type: 'House' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, type: 'Condo' })).toHaveLength(1)
  })

  it('filters by minPrice (keeps rows at or above; drops null/below)', () => {
    const ls = [mk({ id: 'a', price: 500000 }), mk({ id: 'b', price: 1000000 }), mk({ id: 'c', price: null })]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minPrice: '600000' })
    expect(out.map(l => l.id)).toEqual(['b'])
  })

  it('filters by maxPrice (null price passes through as +∞ → excluded)', () => {
    const ls = [mk({ id: 'a', price: 500000 }), mk({ id: 'b', price: 1000000 }), mk({ id: 'c', price: null })]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxPrice: '800000' })
    expect(out.map(l => l.id)).toEqual(['a'])
  })

  it('strips $ and commas from price inputs', () => {
    const ls = [mk({ id: 'a', price: 500000 })]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minPrice: '$400,000' })
    expect(out).toHaveLength(1)
  })

  it('filters by favoritesOnly', () => {
    const ls = [mk({ id: 'a', favorite: true }), mk({ id: 'b', favorite: false })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, favoritesOnly: true }).map(l => l.id)).toEqual(['a'])
  })

  it('filters by flagStatus=only and hide', () => {
    const ls = [mk({ id: 'a', flagged_for_deletion: true }), mk({ id: 'b', flagged_for_deletion: false })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, flagStatus: 'only' }).map(l => l.id)).toEqual(['a'])
    expect(applyFilters(ls, { ...EMPTY_FILTERS, flagStatus: 'hide' }).map(l => l.id)).toEqual(['b'])
  })
})
```

- [ ] **Step 1.2: Run — expect failure (module not found)**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: FAIL — `Cannot find module '@/lib/filters'`.

- [ ] **Step 1.3: Create `src/lib/filters.ts`**

```ts
import type { Listing } from '@/types/listing'

export type FlagStatus = 'all' | 'only' | 'hide'

export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
}

export const EMPTY_FILTERS: Filters = {
  type: '',
  minPrice: '',
  maxPrice: '',
  favoritesOnly: false,
  flagStatus: 'all',
}

export function applyFilters(listings: Listing[], filters: Filters): Listing[] {
  return listings.filter(l => {
    if (filters.flagStatus === 'only' && !l.flagged_for_deletion) return false
    if (filters.flagStatus === 'hide' && l.flagged_for_deletion) return false
    if (filters.favoritesOnly && !l.favorite) return false
    if (filters.type && l.property_type !== filters.type) return false
    if (filters.minPrice) {
      const min = Number(filters.minPrice.replace(/[$,\s]/g, ''))
      if (!isNaN(min) && (l.price ?? 0) < min) return false
    }
    if (filters.maxPrice) {
      const max = Number(filters.maxPrice.replace(/[$,\s]/g, ''))
      if (!isNaN(max) && (l.price ?? Infinity) > max) return false
    }
    return true
  })
}
```

- [ ] **Step 1.4: Run — expect pass**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 1.5: Update `FilterBar.tsx` to re-export from new module**

In `src/components/FilterBar.tsx`, replace the top block (lines 1-21) with:

```ts
'use client'

import { useState } from 'react'
import { type Filters, type FlagStatus, EMPTY_FILTERS } from '@/lib/filters'

export type { Filters, FlagStatus }
```

Remove the old `FlagStatus`, `Filters`, and `EMPTY_FILTERS` definitions from `FilterBar.tsx`.

- [ ] **Step 1.6: Update `ListingsTable.tsx` to use `applyFilters`**

In `src/components/ListingsTable.tsx`:

- Add import: `import { applyFilters, EMPTY_FILTERS } from '@/lib/filters'`
- Replace `useState<Filters>({ type: '', minPrice: '', maxPrice: '', favoritesOnly: false, flagStatus: 'all' })` at line 24 with `useState<Filters>(EMPTY_FILTERS)`.
- Replace the `useMemo` block at lines 27-43 with:

```ts
const filtered = useMemo(() => applyFilters(listings, filters), [listings, filters])
```

- [ ] **Step 1.7: Run all tests — expect pass**

Run: `npm test`
Expected: All tests pass. FilterBar tests unchanged, filters tests new.

- [ ] **Step 1.8: Commit**

```bash
git add src/lib/filters.ts src/lib/__tests__/filters.test.ts src/components/FilterBar.tsx src/components/ListingsTable.tsx
git commit -m "refactor(filters): extract filter logic into pure helper"
```

---

## Task 2 — Add `minBeds` filter

**Files:**
- Modify: `src/lib/filters.ts`
- Modify: `src/lib/__tests__/filters.test.ts`

- [ ] **Step 2.1: Write failing tests**

Append to `src/lib/__tests__/filters.test.ts`:

```ts
describe('applyFilters — minBeds', () => {
  it('includes rows where bedrooms parses >= min', () => {
    const ls = [
      mk({ id: 'a', bedrooms: '2' }),
      mk({ id: 'b', bedrooms: '3' }),
      mk({ id: 'c', bedrooms: '4' }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '3' })
    expect(out.map(l => l.id)).toEqual(['b', 'c'])
  })

  it('treats "3+1" legacy value as 3 (parseInt)', () => {
    const ls = [mk({ id: 'a', bedrooms: '3+1' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '3' })).toHaveLength(1)
    expect(applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '4' })).toHaveLength(0)
  })

  it('excludes rows with null/unparseable bedrooms when active', () => {
    const ls = [
      mk({ id: 'a', bedrooms: null }),
      mk({ id: 'b', bedrooms: 'studio' }),
      mk({ id: 'c', bedrooms: '3' }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '1' })
    expect(out.map(l => l.id)).toEqual(['c'])
  })

  it('empty minBeds = no filtering', () => {
    const ls = [mk({ id: 'a', bedrooms: null })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, minBeds: '' })).toHaveLength(1)
  })
})
```

- [ ] **Step 2.2: Run — expect failure**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: FAIL — TypeScript error on `minBeds` not in `Filters`.

- [ ] **Step 2.3: Extend `Filters` and `applyFilters`**

In `src/lib/filters.ts`:

```ts
export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
  minBeds: string
}

export const EMPTY_FILTERS: Filters = {
  type: '',
  minPrice: '',
  maxPrice: '',
  favoritesOnly: false,
  flagStatus: 'all',
  minBeds: '',
}
```

Add to the `applyFilters` body, before `return true`:

```ts
if (filters.minBeds) {
  const min = parseInt(filters.minBeds, 10)
  if (!isNaN(min)) {
    const beds = parseInt(l.bedrooms ?? '', 10)
    if (isNaN(beds) || beds < min) return false
  }
}
```

- [ ] **Step 2.4: Run — expect pass**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: PASS.

- [ ] **Step 2.5: Commit**

```bash
git add src/lib/filters.ts src/lib/__tests__/filters.test.ts
git commit -m "feat(filters): add minBeds filter"
```

---

## Task 3 — Add commute filters (school + PVM)

**Files:**
- Modify: `src/lib/filters.ts`
- Modify: `src/lib/__tests__/filters.test.ts`

- [ ] **Step 3.1: Write failing tests**

Append to `src/lib/__tests__/filters.test.ts`:

```ts
describe('applyFilters — commute', () => {
  it('maxCommuteSchool: includes rows at or below the threshold', () => {
    const ls = [
      mk({ id: 'a', commute_school_car: '15 min' }),
      mk({ id: 'b', commute_school_car: '30 min' }),
      mk({ id: 'c', commute_school_car: '45 min' }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxCommuteSchool: '30' })
    expect(out.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('maxCommuteSchool excludes rows with null commute', () => {
    const ls = [
      mk({ id: 'a', commute_school_car: '20 min' }),
      mk({ id: 'b', commute_school_car: null }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxCommuteSchool: '60' })
    expect(out.map(l => l.id)).toEqual(['a'])
  })

  it('maxCommuteSchool excludes rows with unparseable commute strings', () => {
    const ls = [
      mk({ id: 'a', commute_school_car: 'unknown' }),
      mk({ id: 'b', commute_school_car: '25 min' }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxCommuteSchool: '60' })
    expect(out.map(l => l.id)).toEqual(['b'])
  })

  it('maxCommutePvm applies the same rule to commute_pvm_transit', () => {
    const ls = [
      mk({ id: 'a', commute_pvm_transit: '40 min' }),
      mk({ id: 'b', commute_pvm_transit: '70 min' }),
      mk({ id: 'c', commute_pvm_transit: null }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxCommutePvm: '60' })
    expect(out.map(l => l.id)).toEqual(['a'])
  })

  it('school and PVM filters are independent (AND)', () => {
    const ls = [
      mk({ id: 'a', commute_school_car: '20 min', commute_pvm_transit: '40 min' }),
      mk({ id: 'b', commute_school_car: '20 min', commute_pvm_transit: '80 min' }),
      mk({ id: 'c', commute_school_car: '50 min', commute_pvm_transit: '40 min' }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxCommuteSchool: '30', maxCommutePvm: '60' })
    expect(out.map(l => l.id)).toEqual(['a'])
  })

  it('empty commute fields = no filtering', () => {
    const ls = [mk({ id: 'a', commute_school_car: null })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, maxCommuteSchool: '', maxCommutePvm: '' }))
      .toHaveLength(1)
  })
})
```

- [ ] **Step 3.2: Run — expect failure**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: FAIL — `maxCommuteSchool`/`maxCommutePvm` not in `Filters`.

- [ ] **Step 3.3: Extend `Filters` and `applyFilters`**

In `src/lib/filters.ts`, extend the interface and defaults:

```ts
export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
  minBeds: string
  maxCommuteSchool: string
  maxCommutePvm: string
}

export const EMPTY_FILTERS: Filters = {
  type: '',
  minPrice: '',
  maxPrice: '',
  favoritesOnly: false,
  flagStatus: 'all',
  minBeds: '',
  maxCommuteSchool: '',
  maxCommutePvm: '',
}
```

Add a helper and predicates above `applyFilters`:

```ts
function parseCommuteMinutes(s: string | null): number | null {
  if (!s) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}
```

Inside `applyFilters`, add before `return true`:

```ts
if (filters.maxCommuteSchool) {
  const max = parseInt(filters.maxCommuteSchool, 10)
  if (!isNaN(max)) {
    const mins = parseCommuteMinutes(l.commute_school_car)
    if (mins == null || mins > max) return false
  }
}
if (filters.maxCommutePvm) {
  const max = parseInt(filters.maxCommutePvm, 10)
  if (!isNaN(max)) {
    const mins = parseCommuteMinutes(l.commute_pvm_transit)
    if (mins == null || mins > max) return false
  }
}
```

- [ ] **Step 3.4: Run — expect pass**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/filters.ts src/lib/__tests__/filters.test.ts
git commit -m "feat(filters): add max-commute filters for school and PVM"
```

---

## Task 4 — Add `maxMonthlyCost` and `hasGarage` filters

**Files:**
- Modify: `src/lib/filters.ts`
- Modify: `src/lib/__tests__/filters.test.ts`

- [ ] **Step 4.1: Write failing tests**

Append:

```ts
describe('applyFilters — maxMonthlyCost', () => {
  it('keeps rows at or below threshold; excludes null', () => {
    const ls = [
      mk({ id: 'a', total_monthly_cost: 2500 }),
      mk({ id: 'b', total_monthly_cost: 4500 }),
      mk({ id: 'c', total_monthly_cost: null }),
    ]
    const out = applyFilters(ls, { ...EMPTY_FILTERS, maxMonthlyCost: '3000' })
    expect(out.map(l => l.id)).toEqual(['a'])
  })

  it('strips $ and commas', () => {
    const ls = [mk({ id: 'a', total_monthly_cost: 2500 })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, maxMonthlyCost: '$3,000' })).toHaveLength(1)
  })

  it('empty = no filter', () => {
    const ls = [mk({ id: 'a', total_monthly_cost: null })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, maxMonthlyCost: '' })).toHaveLength(1)
  })
})

describe('applyFilters — hasGarage', () => {
  it('matches "1 garage"', () => {
    const ls = [mk({ id: 'a', parking: '1 garage' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, hasGarage: true })).toHaveLength(1)
  })

  it('matches "2 garages"', () => {
    const ls = [mk({ id: 'a', parking: '2 garages' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, hasGarage: true })).toHaveLength(1)
  })

  it('matches "1 garage + 1 outdoor"', () => {
    const ls = [mk({ id: 'a', parking: '1 garage + 1 outdoor' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, hasGarage: true })).toHaveLength(1)
  })

  it('rejects "1 outdoor"', () => {
    const ls = [mk({ id: 'a', parking: '1 outdoor' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, hasGarage: true })).toHaveLength(0)
  })

  it('rejects null and empty parking', () => {
    const ls = [mk({ id: 'a', parking: null }), mk({ id: 'b', parking: '' })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, hasGarage: true })).toHaveLength(0)
  })

  it('hasGarage=false = no filtering', () => {
    const ls = [mk({ id: 'a', parking: null })]
    expect(applyFilters(ls, { ...EMPTY_FILTERS, hasGarage: false })).toHaveLength(1)
  })
})

describe('applyFilters — combined', () => {
  it('all active filters AND together', () => {
    const ls = [
      mk({ id: 'a', bedrooms: '3', commute_school_car: '20 min', parking: '1 garage', total_monthly_cost: 2500 }),
      mk({ id: 'b', bedrooms: '3', commute_school_car: '45 min', parking: '1 garage', total_monthly_cost: 2500 }),
      mk({ id: 'c', bedrooms: '2', commute_school_car: '20 min', parking: '1 garage', total_monthly_cost: 2500 }),
    ]
    const out = applyFilters(ls, {
      ...EMPTY_FILTERS,
      minBeds: '3',
      maxCommuteSchool: '30',
      hasGarage: true,
      maxMonthlyCost: '3000',
    })
    expect(out.map(l => l.id)).toEqual(['a'])
  })
})
```

- [ ] **Step 4.2: Run — expect failure**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: FAIL — new fields not in `Filters`.

- [ ] **Step 4.3: Extend `Filters`, defaults, and predicates**

In `src/lib/filters.ts`:

```ts
export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
  minBeds: string
  maxCommuteSchool: string
  maxCommutePvm: string
  maxMonthlyCost: string
  hasGarage: boolean
}

export const EMPTY_FILTERS: Filters = {
  type: '',
  minPrice: '',
  maxPrice: '',
  favoritesOnly: false,
  flagStatus: 'all',
  minBeds: '',
  maxCommuteSchool: '',
  maxCommutePvm: '',
  maxMonthlyCost: '',
  hasGarage: false,
}
```

Add `GARAGE_RE` at module scope:

```ts
const GARAGE_RE = /\b\d+\s*garage/i
```

Inside `applyFilters`, add before `return true`:

```ts
if (filters.maxMonthlyCost) {
  const max = Number(filters.maxMonthlyCost.replace(/[$,\s]/g, ''))
  if (!isNaN(max)) {
    if (l.total_monthly_cost == null || l.total_monthly_cost > max) return false
  }
}
if (filters.hasGarage) {
  if (!GARAGE_RE.test(l.parking ?? '')) return false
}
```

- [ ] **Step 4.4: Run — expect pass**

Run: `npx vitest run src/lib/__tests__/filters.test.ts`
Expected: PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/lib/filters.ts src/lib/__tests__/filters.test.ts
git commit -m "feat(filters): add maxMonthlyCost and hasGarage filters"
```

---

## Task 5 — Refactor `useSort` to multi-level sort

**Files:**
- Modify: `src/hooks/useSort.ts`
- Create: `src/hooks/__tests__/useSort.test.ts`
- Modify: `src/components/ListingsTable.tsx` (consume new API)
- Modify: `src/components/TableHeader.tsx` (accept new state shape — still single-column click; shift-click added in Task 6)

- [ ] **Step 5.1: Write failing tests**

Create `src/hooks/__tests__/useSort.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSort } from '@/hooks/useSort'
import type { Listing } from '@/types/listing'

function mk(partial: Partial<Listing> = {}): Listing {
  return {
    id: 'x', centris_link: null, broker_link: null, location: null,
    full_address: null, mls_number: null, property_type: null,
    price: null, taxes_yearly: null, common_fees_yearly: null,
    bedrooms: null, liveable_area_sqft: null, price_per_sqft: null,
    parking: null, year_built: null, hydro_yearly: null,
    downpayment: null, monthly_mortgage: null, total_monthly_cost: null,
    commute_school_car: null, commute_school_has_toll: null,
    commute_pvm_transit: null, notes: null, personal_rating: null,
    status: 'active', status_checked_at: null, previous_price: null,
    price_changed_at: null, favorite: false, flagged_for_deletion: false,
    image_url: null, latitude: null, longitude: null,
    created_at: '2026-04-01', updated_at: '2026-04-01',
    deleted_at: null, criteria: null,
    ...partial,
  }
}

describe('useSort — multi-level', () => {
  it('empty sort array = original order', () => {
    const ls = [mk({ id: 'a' }), mk({ id: 'b' })]
    const { result } = renderHook(() => useSort(ls))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('single-level asc sort on price', () => {
    const ls = [mk({ id: 'a', price: 800000 }), mk({ id: 'b', price: 500000 })]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'price', direction: 'asc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['b', 'a'])
  })

  it('single-level desc flips order', () => {
    const ls = [mk({ id: 'a', price: 800000 }), mk({ id: 'b', price: 500000 })]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'price', direction: 'desc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('two-level: ties in primary broken by secondary', () => {
    const ls = [
      mk({ id: 'a', price: 500000, liveable_area_sqft: 900 }),
      mk({ id: 'b', price: 500000, liveable_area_sqft: 1200 }),
      mk({ id: 'c', price: 600000, liveable_area_sqft: 800 }),
    ]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'desc' },
    ]))
    // price asc: [a,b]=500k (tie), c=600k. Tiebreaker sqft desc: b(1200) before a(900).
    expect(result.current.sorted.map(l => l.id)).toEqual(['b', 'a', 'c'])
  })

  it('nulls sort last in asc and desc', () => {
    const ls = [
      mk({ id: 'a', price: 500000 }),
      mk({ id: 'b', price: null }),
      mk({ id: 'c', price: 300000 }),
    ]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'price', direction: 'asc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['c', 'a', 'b'])
    act(() => result.current.setSort([{ column: 'price', direction: 'desc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'c', 'b'])
  })

  it('criteria_count still works as primary', () => {
    const ls = [
      mk({ id: 'a', criteria: { k1: true, k2: true } }),
      mk({ id: 'b', criteria: { k1: true } }),
    ]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'criteria_count', direction: 'desc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'b'])
  })

  it('toggleSort cycles asc → desc → clear on same column', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'asc' }])
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'desc' }])
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([])
  })

  it('plain click on different column replaces sort', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ]))
    act(() => result.current.toggleSort('bedrooms', false))
    expect(result.current.sort).toEqual([{ column: 'bedrooms', direction: 'asc' }])
  })

  it('plain click on a column that is one of several collapses to that column asc', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'desc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ]))
    act(() => result.current.toggleSort('price', false))
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'asc' }])
  })

  it('shift-click appends a new level', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.toggleSort('price', false))
    act(() => result.current.toggleSort('liveable_area_sqft', true))
    expect(result.current.sort).toEqual([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ])
  })

  it('shift-click on existing level flips its direction', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'asc' },
    ]))
    act(() => result.current.toggleSort('liveable_area_sqft', true))
    expect(result.current.sort).toEqual([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'desc' },
    ])
  })

  it('third shift-click removes that level only', () => {
    const { result } = renderHook(() => useSort([]))
    act(() => result.current.setSort([
      { column: 'price', direction: 'asc' },
      { column: 'liveable_area_sqft', direction: 'desc' },
    ]))
    act(() => result.current.toggleSort('liveable_area_sqft', true))
    // after third: direction was asc→desc, shift-click on desc removes
    expect(result.current.sort).toEqual([{ column: 'price', direction: 'asc' }])
  })
})
```

- [ ] **Step 5.2: Run — expect failure**

Run: `npx vitest run src/hooks/__tests__/useSort.test.ts`
Expected: FAIL on API shape (`setSort` doesn't exist; `toggleSort` signature is one-arg).

- [ ] **Step 5.3: Rewrite `src/hooks/useSort.ts`**

Replace the entire file contents with:

```ts
'use client'

import { useState, useMemo, useCallback } from 'react'
import { countChecked, deriveCriteria } from '@/lib/criteria'
import type { Listing } from '@/types/listing'

export type SortDirection = 'asc' | 'desc'
export interface SortLevel {
  column: string
  direction: SortDirection
}
export type SortState = SortLevel[]

function getValue(l: Listing, column: string): unknown {
  if (column === 'criteria_count') return countChecked(deriveCriteria(l))
  return l[column as keyof Listing]
}

function compareByColumn(a: Listing, b: Listing, column: string): number {
  const aVal = getValue(a, column)
  const bVal = getValue(b, column)
  if (aVal === null || aVal === undefined) return 1
  if (bVal === null || bVal === undefined) return -1
  if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal
  return String(aVal).localeCompare(String(bVal))
}

export function useSort(listings: Listing[]) {
  const [sort, setSort] = useState<SortState>([])

  const toggleSort = useCallback((column: string, shift: boolean) => {
    setSort(prev => {
      const idx = prev.findIndex(s => s.column === column)

      if (!shift) {
        // Plain click
        if (prev.length === 1 && idx === 0) {
          // sole active column: asc → desc → clear
          if (prev[0].direction === 'asc') return [{ column, direction: 'desc' }]
          return []
        }
        // not sorted, or one of several → set to just this column, asc
        return [{ column, direction: 'asc' }]
      }

      // Shift click
      if (idx === -1) {
        return [...prev, { column, direction: 'asc' }]
      }
      // existing level: asc → desc; desc → remove
      const existing = prev[idx]
      if (existing.direction === 'asc') {
        const next = [...prev]
        next[idx] = { column, direction: 'desc' }
        return next
      }
      return prev.filter((_, i) => i !== idx)
    })
  }, [])

  const sorted = useMemo(() => {
    if (sort.length === 0) return listings
    return [...listings].sort((a, b) => {
      for (const { column, direction } of sort) {
        const cmp = compareByColumn(a, b, column)
        if (cmp !== 0) return direction === 'desc' ? -cmp : cmp
      }
      return 0
    })
  }, [listings, sort])

  return { sorted, sort, toggleSort, setSort }
}
```

- [ ] **Step 5.4: Update `TableHeader.tsx` for new state shape (includes shift-click handling; tests for it arrive in Task 6)**

In `src/components/TableHeader.tsx`, replace the file with:

```tsx
import { tableColumns } from '@/lib/columns'
import type { SortState } from '@/hooks/useSort'

interface TableHeaderProps {
  sort: SortState
  onSort: (column: string, shift: boolean) => void
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
          const level = sort.find(s => s.column === col.key)
          const rank = level ? sort.findIndex(s => s.column === col.key) + 1 : 0
          const arrow = level ? (level.direction === 'asc' ? ' \u2191' : ' \u2193') : ''

          return (
            <th
              key={col.key}
              onClick={(e) => onSort(col.key, e.shiftKey)}
              className={`
                sticky top-0 z-10 bg-slate-50 px-3 py-2.5
                text-xs font-semibold uppercase tracking-wider text-slate-500
                cursor-pointer select-none hover:text-slate-800 hover:bg-slate-100
                transition-colors border-b border-slate-200
                ${col.align === 'right' ? 'text-right' : 'text-left'}
              `}
              style={{ width: col.width, minWidth: col.width }}
            >
              {col.label}{rank > 0 && sort.length > 1 ? ` ${rank}` : ''}{arrow}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
```

- [ ] **Step 5.5: Update `ListingsTable.tsx` — pass shift flag**

In `src/components/ListingsTable.tsx`:

- Line 45 already: `const { sorted, sort, toggleSort } = useSort(filtered)`. Keep it.
- Line 106: `<TableHeader sort={sort} onSort={toggleSort} hasCompare />` — no change needed; `toggleSort` now takes `(column, shift)` and `TableHeader` passes `e.shiftKey`.

- [ ] **Step 5.6: Run all tests — expect pass**

Run: `npm test`
Expected: All tests pass, including new useSort tests and existing FilterBar / ListingsTable tests.

- [ ] **Step 5.7: Commit**

```bash
git add src/hooks/useSort.ts src/hooks/__tests__/useSort.test.ts src/components/TableHeader.tsx src/components/ListingsTable.tsx
git commit -m "feat(sort): multi-level sort with shift-click semantics"
```

---

## Task 6 — `TableHeader` badge + click behavior tests (and rank badge polish)

**Files:**
- Create: `src/components/__tests__/TableHeader.test.tsx`

- [ ] **Step 6.1: Write tests**

Create `src/components/__tests__/TableHeader.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableHeader } from '../TableHeader'

describe('TableHeader', () => {
  it('renders no arrow when column is unsorted', () => {
    render(
      <table><TableHeader sort={[]} onSort={() => {}} /></table>
    )
    const priceHeader = screen.getByText(/^Price$/)
    expect(priceHeader.textContent).toBe('Price')
  })

  it('renders an arrow for the sorted column', () => {
    render(
      <table>
        <TableHeader sort={[{ column: 'price', direction: 'asc' }]} onSort={() => {}} />
      </table>
    )
    const priceHeader = screen.getByText(/Price/)
    expect(priceHeader.textContent).toContain('\u2191')
  })

  it('shows rank number only when multiple sort levels active', () => {
    render(
      <table>
        <TableHeader
          sort={[
            { column: 'price', direction: 'asc' },
            { column: 'liveable_area_sqft', direction: 'desc' },
          ]}
          onSort={() => {}}
        />
      </table>
    )
    const priceHeader = screen.getByText(/Price/)
    const areaHeader = screen.getByText(/Area \(sqft\)/)
    expect(priceHeader.textContent).toContain('1')
    expect(priceHeader.textContent).toContain('\u2191')
    expect(areaHeader.textContent).toContain('2')
    expect(areaHeader.textContent).toContain('\u2193')
  })

  it('calls onSort with shift=false on plain click', () => {
    const onSort = vi.fn()
    render(<table><TableHeader sort={[]} onSort={onSort} /></table>)
    fireEvent.click(screen.getByText(/^Price$/))
    expect(onSort).toHaveBeenLastCalledWith('price', false)
  })

  it('calls onSort with shift=true on shift-click', () => {
    const onSort = vi.fn()
    render(<table><TableHeader sort={[]} onSort={onSort} /></table>)
    fireEvent.click(screen.getByText(/^Price$/), { shiftKey: true })
    expect(onSort).toHaveBeenLastCalledWith('price', true)
  })
})
```

- [ ] **Step 6.2: Run — expect pass**

Run: `npx vitest run src/components/__tests__/TableHeader.test.tsx`
Expected: PASS.

- [ ] **Step 6.3: Commit**

```bash
git add src/components/__tests__/TableHeader.test.tsx
git commit -m "test(table-header): cover plain/shift click and multi-rank badges"
```

---

## Task 7 — `FilterPanel` component (new popover for all filter controls)

**Files:**
- Create: `src/components/FilterPanel.tsx`
- Create: `src/components/__tests__/FilterPanel.test.tsx`

- [ ] **Step 7.1: Write failing tests**

Create `src/components/__tests__/FilterPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterPanel } from '../FilterPanel'
import { EMPTY_FILTERS } from '@/lib/filters'

describe('FilterPanel', () => {
  it('renders all filter groups', () => {
    render(<FilterPanel propertyTypes={['Condo']} filters={EMPTY_FILTERS} onChange={() => {}} />)
    expect(screen.getByText(/^Property$/)).toBeInTheDocument()
    expect(screen.getByText(/^Price$/)).toBeInTheDocument()
    expect(screen.getByText(/^Beds$/)).toBeInTheDocument()
    expect(screen.getByText(/^Commute$/)).toBeInTheDocument()
    expect(screen.getByText(/^Costs$/)).toBeInTheDocument()
    expect(screen.getByText(/^Features$/)).toBeInTheDocument()
  })

  it('changing minBeds emits updated filters', () => {
    const onChange = vi.fn()
    render(<FilterPanel propertyTypes={[]} filters={EMPTY_FILTERS} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Min beds/i), { target: { value: '3' } })
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ minBeds: '3' }))
  })

  it('enabling the school-commute checkbox reveals the slider', () => {
    const onChange = vi.fn()
    render(<FilterPanel propertyTypes={[]} filters={EMPTY_FILTERS} onChange={onChange} />)
    expect(screen.queryByLabelText(/Max school commute/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Limit school commute/i))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxCommuteSchool: '60' }))
  })

  it('disabling the school-commute checkbox clears its value', () => {
    const onChange = vi.fn()
    render(<FilterPanel
      propertyTypes={[]}
      filters={{ ...EMPTY_FILTERS, maxCommuteSchool: '30' }}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByLabelText(/Limit school commute/i))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ maxCommuteSchool: '' }))
  })

  it('hasGarage toggle flips the flag', () => {
    const onChange = vi.fn()
    render(<FilterPanel propertyTypes={[]} filters={EMPTY_FILTERS} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText(/At least 1 garage/i))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ hasGarage: true }))
  })

  it('Clear all resets to EMPTY_FILTERS', () => {
    const onChange = vi.fn()
    render(<FilterPanel
      propertyTypes={[]}
      filters={{ ...EMPTY_FILTERS, minBeds: '3', hasGarage: true }}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Clear all/i }))
    expect(onChange).toHaveBeenLastCalledWith(EMPTY_FILTERS)
  })
})
```

- [ ] **Step 7.2: Run — expect failure (module not found)**

Run: `npx vitest run src/components/__tests__/FilterPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 7.3: Create `src/components/FilterPanel.tsx`**

```tsx
'use client'

import { type Filters, EMPTY_FILTERS } from '@/lib/filters'

interface FilterPanelProps {
  propertyTypes: string[]
  filters: Filters
  onChange: (next: Filters) => void
}

const DEFAULT_SCHOOL_MAX = '60'
const DEFAULT_PVM_MAX = '90'
const SCHOOL_RANGE = { min: 0, max: 90 }
const PVM_RANGE = { min: 0, max: 120 }

export function FilterPanel({ propertyTypes, filters, onChange }: FilterPanelProps) {
  const update = <K extends keyof Filters>(field: K, value: Filters[K]) => {
    onChange({ ...filters, [field]: value })
  }

  const activeCount = [
    filters.type !== '',
    filters.minPrice !== '',
    filters.maxPrice !== '',
    filters.favoritesOnly,
    filters.flagStatus !== 'all',
    filters.minBeds !== '',
    filters.maxCommuteSchool !== '',
    filters.maxCommutePvm !== '',
    filters.maxMonthlyCost !== '',
    filters.hasGarage,
  ].filter(Boolean).length

  const schoolEnabled = filters.maxCommuteSchool !== ''
  const pvmEnabled = filters.maxCommutePvm !== ''

  return (
    <div className="w-96 rounded-lg border border-slate-200 bg-white p-4 shadow-lg space-y-4">
      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Property</h4>
        <select
          value={filters.type}
          onChange={e => update('type', e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          aria-label="Property type"
        >
          <option value="">All types</option>
          {propertyTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Price</h4>
        <div className="flex gap-2">
          <input
            type="text" placeholder="Min $" aria-label="Minimum price"
            value={filters.minPrice}
            onChange={e => update('minPrice', e.target.value)}
            className="w-1/2 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />
          <input
            type="text" placeholder="Max $" aria-label="Maximum price"
            value={filters.maxPrice}
            onChange={e => update('maxPrice', e.target.value)}
            className="w-1/2 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Beds</h4>
        <input
          type="number" min={0} placeholder="Min beds" aria-label="Min beds"
          value={filters.minBeds}
          onChange={e => update('minBeds', e.target.value)}
          className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
        />
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Commute</h4>
        <div className="space-y-3">
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={schoolEnabled}
                aria-label="Limit school commute"
                onChange={e => update('maxCommuteSchool', e.target.checked ? DEFAULT_SCHOOL_MAX : '')}
              />
              Limit school commute
            </label>
            {schoolEnabled && (
              <div className="flex items-center gap-2 mt-1 pl-6">
                <input
                  type="range" min={SCHOOL_RANGE.min} max={SCHOOL_RANGE.max} step={1}
                  aria-label="Max school commute"
                  value={filters.maxCommuteSchool}
                  onChange={e => update('maxCommuteSchool', e.target.value)}
                  className="flex-1"
                />
                <span className="text-xs text-slate-600 w-12 text-right">{filters.maxCommuteSchool} min</span>
              </div>
            )}
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={pvmEnabled}
                aria-label="Limit PVM commute"
                onChange={e => update('maxCommutePvm', e.target.checked ? DEFAULT_PVM_MAX : '')}
              />
              Limit PVM commute
            </label>
            {pvmEnabled && (
              <div className="flex items-center gap-2 mt-1 pl-6">
                <input
                  type="range" min={PVM_RANGE.min} max={PVM_RANGE.max} step={1}
                  aria-label="Max PVM commute"
                  value={filters.maxCommutePvm}
                  onChange={e => update('maxCommutePvm', e.target.value)}
                  className="flex-1"
                />
                <span className="text-xs text-slate-600 w-12 text-right">{filters.maxCommutePvm} min</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Costs</h4>
        <input
          type="text" placeholder="Max total $/mo" aria-label="Max monthly cost"
          value={filters.maxMonthlyCost}
          onChange={e => update('maxMonthlyCost', e.target.value)}
          className="w-40 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
        />
      </section>

      <section>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Features</h4>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.hasGarage}
            aria-label="At least 1 garage"
            onChange={e => update('hasGarage', e.target.checked)}
          />
          At least 1 garage
        </label>
      </section>

      <footer className="flex items-center justify-between pt-3 border-t border-slate-200">
        <span className="text-xs text-slate-500">{activeCount} active</span>
        {activeCount > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Clear all
          </button>
        )}
      </footer>
    </div>
  )
}
```

- [ ] **Step 7.4: Run — expect pass**

Run: `npx vitest run src/components/__tests__/FilterPanel.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 7.5: Commit**

```bash
git add src/components/FilterPanel.tsx src/components/__tests__/FilterPanel.test.tsx
git commit -m "feat(ui): add FilterPanel popover with new filter controls"
```

---

## Task 8 — `SortPanel` component

**Files:**
- Create: `src/components/SortPanel.tsx`
- Create: `src/components/__tests__/SortPanel.test.tsx`

- [ ] **Step 8.1: Write failing tests**

Create `src/components/__tests__/SortPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SortPanel } from '../SortPanel'

describe('SortPanel', () => {
  it('shows "No sort" message when empty', () => {
    render(<SortPanel sort={[]} onChange={() => {}} />)
    expect(screen.getByText(/No sort/i)).toBeInTheDocument()
  })

  it('lists each active sort level in order', () => {
    render(<SortPanel
      sort={[
        { column: 'price', direction: 'asc' },
        { column: 'liveable_area_sqft', direction: 'desc' },
      ]}
      onChange={() => {}}
    />)
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain('Price')
    expect(items[1].textContent).toContain('Area (sqft)')
  })

  it('flips direction when ↑/↓ button is clicked', () => {
    const onChange = vi.fn()
    render(<SortPanel sort={[{ column: 'price', direction: 'asc' }]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /Flip direction of Price/i }))
    expect(onChange).toHaveBeenCalledWith([{ column: 'price', direction: 'desc' }])
  })

  it('removes a level when × is clicked', () => {
    const onChange = vi.fn()
    render(<SortPanel
      sort={[
        { column: 'price', direction: 'asc' },
        { column: 'liveable_area_sqft', direction: 'asc' },
      ]}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Remove Price/i }))
    expect(onChange).toHaveBeenCalledWith([{ column: 'liveable_area_sqft', direction: 'asc' }])
  })

  it('moves a level up when ↑ reorder is clicked', () => {
    const onChange = vi.fn()
    render(<SortPanel
      sort={[
        { column: 'price', direction: 'asc' },
        { column: 'liveable_area_sqft', direction: 'asc' },
      ]}
      onChange={onChange}
    />)
    fireEvent.click(screen.getByRole('button', { name: /Move Area \(sqft\) up/i }))
    expect(onChange).toHaveBeenCalledWith([
      { column: 'liveable_area_sqft', direction: 'asc' },
      { column: 'price', direction: 'asc' },
    ])
  })

  it('Add-sort dropdown appends a new level', () => {
    const onChange = vi.fn()
    render(<SortPanel sort={[]} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText(/Add sort/i), { target: { value: 'price' } })
    expect(onChange).toHaveBeenCalledWith([{ column: 'price', direction: 'asc' }])
  })

  it('Add-sort dropdown excludes columns already sorted', () => {
    render(<SortPanel
      sort={[{ column: 'price', direction: 'asc' }]}
      onChange={() => {}}
    />)
    const select = screen.getByLabelText(/Add sort/i) as HTMLSelectElement
    const options = Array.from(select.options).map(o => o.value)
    expect(options).not.toContain('price')
  })
})
```

- [ ] **Step 8.2: Run — expect failure**

Run: `npx vitest run src/components/__tests__/SortPanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 8.3: Create `src/components/SortPanel.tsx`**

```tsx
'use client'

import { tableColumns } from '@/lib/columns'
import type { SortState, SortLevel } from '@/hooks/useSort'

interface SortPanelProps {
  sort: SortState
  onChange: (next: SortState) => void
}

function labelFor(key: string): string {
  return tableColumns.find(c => c.key === key)?.label ?? key
}

export function SortPanel({ sort, onChange }: SortPanelProps) {
  const flip = (idx: number) => {
    const next = [...sort]
    next[idx] = {
      ...next[idx],
      direction: next[idx].direction === 'asc' ? 'desc' : 'asc',
    }
    onChange(next)
  }

  const remove = (idx: number) => {
    onChange(sort.filter((_, i) => i !== idx))
  }

  const move = (idx: number, delta: -1 | 1) => {
    const target = idx + delta
    if (target < 0 || target >= sort.length) return
    const next = [...sort]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  const add = (column: string) => {
    if (!column) return
    onChange([...sort, { column, direction: 'asc' } satisfies SortLevel])
  }

  const usedKeys = new Set(sort.map(s => s.column))
  const available = tableColumns.filter(c => !usedKeys.has(c.key) && c.key !== 'favorite' && c.key !== 'centris_link')

  return (
    <div className="w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg space-y-3">
      {sort.length === 0 ? (
        <p className="text-sm text-slate-500">No sort applied.</p>
      ) : (
        <ul className="space-y-1.5">
          {sort.map((level, idx) => (
            <li key={level.column} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-slate-400 tabular-nums">{idx + 1}.</span>
              <span className="flex-1 text-slate-700">{labelFor(level.column)}</span>
              <button
                onClick={() => flip(idx)}
                aria-label={`Flip direction of ${labelFor(level.column)}`}
                className="px-1.5 py-0.5 text-xs border border-slate-200 rounded hover:bg-slate-100"
              >
                {level.direction === 'asc' ? '\u2191' : '\u2193'}
              </button>
              <button
                onClick={() => move(idx, -1)}
                aria-label={`Move ${labelFor(level.column)} up`}
                disabled={idx === 0}
                className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30"
              >
                &#x25B2;
              </button>
              <button
                onClick={() => move(idx, 1)}
                aria-label={`Move ${labelFor(level.column)} down`}
                disabled={idx === sort.length - 1}
                className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800 disabled:opacity-30"
              >
                &#x25BC;
              </button>
              <button
                onClick={() => remove(idx)}
                aria-label={`Remove ${labelFor(level.column)}`}
                className="px-1.5 py-0.5 text-xs text-slate-500 hover:text-red-600"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-slate-200">
        <select
          aria-label="Add sort"
          value=""
          onChange={e => add(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
        >
          <option value="">+ Add sort…</option>
          {available.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
    </div>
  )
}
```

- [ ] **Step 8.4: Run — expect pass**

Run: `npx vitest run src/components/__tests__/SortPanel.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 8.5: Commit**

```bash
git add src/components/SortPanel.tsx src/components/__tests__/SortPanel.test.tsx
git commit -m "feat(ui): add SortPanel popover for multi-level sort management"
```

---

## Task 9 — Wire `FilterPanel` + `SortPanel` into `FilterBar` / `ListingsTable`

**Files:**
- Modify: `src/components/FilterBar.tsx`
- Modify: `src/components/ListingsTable.tsx`
- Modify: `src/components/__tests__/FilterBar.test.tsx` (update any tests that break due to UI shift)

- [ ] **Step 9.1: Replace `FilterBar.tsx` body**

Replace the full file contents of `src/components/FilterBar.tsx` with:

```tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { type Filters, type FlagStatus, EMPTY_FILTERS } from '@/lib/filters'
import { FilterPanel } from './FilterPanel'
import { SortPanel } from './SortPanel'
import type { SortState } from '@/hooks/useSort'

export type { Filters, FlagStatus }

interface FilterBarProps {
  propertyTypes: string[]
  filters: Filters
  onFilterChange: (filters: Filters) => void
  sort: SortState
  onSortChange: (next: SortState) => void
}

const flagBtnBase = 'px-3 py-1.5 text-sm border transition-colors'
const flagBtnActive = 'bg-red-50 border-red-300 text-red-700'
const flagBtnHideActive = 'bg-slate-100 border-slate-300 text-slate-700'
const flagBtnAllActive = 'bg-white border-slate-300 text-slate-700'
const flagBtnIdle = 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'

function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return { open, setOpen, ref }
}

export function FilterBar({
  propertyTypes,
  filters,
  onFilterChange,
  sort,
  onSortChange,
}: FilterBarProps) {
  const filterPopover = usePopover()
  const sortPopover = usePopover()

  const update = <K extends keyof Filters>(field: K, value: Filters[K]) => {
    onFilterChange({ ...filters, [field]: value })
  }

  const activeCount = [
    filters.type !== '',
    filters.minPrice !== '',
    filters.maxPrice !== '',
    filters.favoritesOnly,
    filters.flagStatus !== 'all',
    filters.minBeds !== '',
    filters.maxCommuteSchool !== '',
    filters.maxCommutePvm !== '',
    filters.maxMonthlyCost !== '',
    filters.hasGarage,
  ].filter(Boolean).length

  return (
    <div className="flex items-center gap-2">
      <div ref={filterPopover.ref} className="relative">
        <button
          onClick={() => filterPopover.setOpen(!filterPopover.open)}
          className={`
            px-3 py-1.5 text-sm rounded-lg border transition-colors
            ${activeCount > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
          `}
        >
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </button>
        {filterPopover.open && (
          <div className="absolute top-full left-0 mt-1 z-20">
            <FilterPanel
              propertyTypes={propertyTypes}
              filters={filters}
              onChange={onFilterChange}
            />
          </div>
        )}
      </div>

      <div ref={sortPopover.ref} className="relative">
        <button
          onClick={() => sortPopover.setOpen(!sortPopover.open)}
          className={`
            px-3 py-1.5 text-sm rounded-lg border transition-colors
            ${sort.length > 0
              ? 'bg-blue-50 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
          `}
        >
          Sort{sort.length > 0 ? ` (${sort.length})` : ''}
        </button>
        {sortPopover.open && (
          <div className="absolute top-full left-0 mt-1 z-20">
            <SortPanel sort={sort} onChange={onSortChange} />
          </div>
        )}
      </div>

      <button
        onClick={() => update('favoritesOnly', !filters.favoritesOnly)}
        aria-pressed={filters.favoritesOnly}
        title={filters.favoritesOnly ? 'Showing favorites only' : 'Show favorites only'}
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${filters.favoritesOnly
            ? 'bg-amber-50 border-amber-300 text-amber-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
        `}
      >
        {filters.favoritesOnly ? '\u2605' : '\u2606'} Favorites
      </button>

      <div role="radiogroup" aria-label="Flag status" className="inline-flex rounded-lg overflow-hidden border border-slate-200">
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'all')}
          aria-checked={filters.flagStatus === 'all'}
          className={`${flagBtnBase} border-0 border-r border-slate-200 ${filters.flagStatus === 'all' ? flagBtnAllActive : flagBtnIdle}`}
        >
          All
        </button>
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'only')}
          aria-checked={filters.flagStatus === 'only'}
          className={`${flagBtnBase} border-0 border-r border-slate-200 ${filters.flagStatus === 'only' ? flagBtnActive : flagBtnIdle}`}
        >
          Flagged only
        </button>
        <button
          type="button" role="radio"
          onClick={() => update('flagStatus', 'hide')}
          aria-checked={filters.flagStatus === 'hide'}
          className={`${flagBtnBase} border-0 ${filters.flagStatus === 'hide' ? flagBtnHideActive : flagBtnIdle}`}
        >
          Hide flagged
        </button>
      </div>
    </div>
  )
}

export { EMPTY_FILTERS }
```

- [ ] **Step 9.2: Update `ListingsTable.tsx` to pass new props**

In `src/components/ListingsTable.tsx`:

- Locate the `useSort` destructure and include `setSort`:

```ts
const { sorted, sort, toggleSort, setSort } = useSort(filtered)
```

- Replace the `<FilterBar … />` JSX (around line 85) with:

```tsx
<FilterBar
  propertyTypes={propertyTypes}
  filters={filters}
  onFilterChange={setFilters}
  sort={sort}
  onSortChange={setSort}
/>
```

- [ ] **Step 9.3: Update existing `FilterBar.test.tsx` to the new props shape**

In `src/components/__tests__/FilterBar.test.tsx`, update every `render(<FilterBar propertyTypes={[]} onFilterChange={…} />)` call to the new signature:

```tsx
render(
  <FilterBar
    propertyTypes={[]}
    filters={EMPTY_FILTERS}
    onFilterChange={onChange}
    sort={[]}
    onSortChange={() => {}}
  />
)
```

Add import at top of file:

```ts
import { EMPTY_FILTERS } from '@/lib/filters'
```

Where a test previously opened the inline panel via `fireEvent.click(screen.getByRole('button', { name: /^Filters/ }))` and then clicked `/^Clear$/`, change to open the popover and click `Clear all`. The "Clear button resets flagStatus" test should be rewritten to:

```ts
it('Flag status radios update flagStatus directly', () => {
  const onChange = vi.fn()
  render(
    <FilterBar
      propertyTypes={[]}
      filters={{ ...EMPTY_FILTERS, flagStatus: 'only' }}
      onFilterChange={onChange}
      sort={[]}
      onSortChange={() => {}}
    />
  )
  fireEvent.click(screen.getByRole('radio', { name: /^All$/ }))
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flagStatus: 'all' }))
})
```

Remove the now-irrelevant "Clear button" test (the Clear-all behavior is covered in `FilterPanel.test.tsx`).

The "defaults to flagStatus=all" test needs the `filters` prop now too:

```ts
it('defaults render with flagStatus=all', () => {
  render(
    <FilterBar
      propertyTypes={[]}
      filters={EMPTY_FILTERS}
      onFilterChange={() => {}}
      sort={[]}
      onSortChange={() => {}}
    />
  )
  expect(screen.getByRole('radio', { name: /^All$/ })).toHaveAttribute('aria-checked', 'true')
})
```

- [ ] **Step 9.4: Run all tests — expect pass**

Run: `npm test`
Expected: All tests pass (filters, useSort, TableHeader, FilterPanel, SortPanel, FilterBar, ListingsTable).

- [ ] **Step 9.5: Verify in browser**

Start the dev server with `preview_start`, load the app, and manually check:
- Filters button opens the popover; all groups visible; active count badge updates.
- Sort button opens the SortPanel; add a sort level; shift-click a column header to add a second; third shift-click removes it.
- Reloading the page clears all filters and sort (no persistence).

Report findings via `preview_screenshot`.

- [ ] **Step 9.6: Commit**

```bash
git add src/components/FilterBar.tsx src/components/ListingsTable.tsx src/components/__tests__/FilterBar.test.tsx
git commit -m "feat(ui): wire FilterPanel and SortPanel into listings toolbar"
```

---

## Task 10 — Final verification

- [ ] **Step 10.1: Run full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 10.2: Run typecheck and build**

Run: `npx tsc --noEmit && npx next build`
Expected: no type errors; build succeeds.

- [ ] **Step 10.3: Final commit (if any cleanup)**

If anything needed fixing beyond what the tasks covered, commit separately. Otherwise, nothing to do here.

---

## Self-review notes

- Spec sections mapped: data model → Tasks 1-5; components → Tasks 5, 6, 7, 8, 9; logic/data flow → Tasks 1-5; persistence (none) → implicit; testing → covered across 1, 3, 5, 6, 7, 8; edge cases (beds "3+1", plain-click-on-active-single, active-filter count, commute string parsing) → Tasks 2, 5, 7, 3.
- No placeholders. All code blocks complete.
- Type consistency: `Filters` grown incrementally, `SortLevel`/`SortState` defined in Task 5 and consumed in 6, 8, 9.
