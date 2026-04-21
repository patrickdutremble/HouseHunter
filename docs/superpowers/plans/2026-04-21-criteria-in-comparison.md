# Criteria in Comparison Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the 5 good-to-have criteria in each listing's card on the `/compare` page, with editable checkboxes, a "Criteria met: X / 5" summary row, and the green "best" highlight applied to both the count row (tied-at-max) and each individual criterion row (only when there's differentiation).

**Architecture:** Extend `getBestValues` in `src/lib/comparison.ts` with two new kinds of entries — a `criteria_count` set using the existing `findBest` pattern, and one set per criterion using a new `findBestBinary` helper that only marks listings as "best" when not all listings agree. Update `/compare` page to render the new section above the existing fields, and add an optimistic-update handler that writes `criteria` back to Supabase.

**Tech Stack:** Next.js 15 (App Router, Client Components), TypeScript, Supabase JS client, Vitest + Testing Library.

---

## File Structure

**Files to modify:**

- `src/lib/comparison.ts` — extend `BestMap` type and `getBestValues()` to include criteria-related sets; add `findBestBinary` helper.
- `src/lib/__tests__/comparison.test.ts` — add tests for the new criteria logic.
- `src/app/compare/page.tsx` — add criteria section (summary row + 5 criterion rows) to each card and wire editable checkboxes with an optimistic-update handler.

**No new files.** The `criteria` definitions already live in `src/lib/criteria.ts` and are imported as-is.

---

## Task 1: Extend `getBestValues` with criteria logic

**Files:**
- Modify: `src/lib/comparison.ts`
- Test: `src/lib/__tests__/comparison.test.ts`

### Step 1: Write the failing tests

- [ ] Append the following tests to `src/lib/__tests__/comparison.test.ts` (before the final closing `})`). These cover the count summary and per-criterion behaviors.

```ts
describe('getBestValues — criteria', () => {
  it('picks listing with highest criteria_count', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { no_above_neighbors: true, three_bedrooms: true } }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: true, three_bedrooms: true, has_garage: true } }),
      makeListing({ id: 'c', criteria: { no_above_neighbors: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.criteria_count).toEqual(new Set(['b']))
  })

  it('treats missing criteria as zero checked', () => {
    const listings = [
      makeListing({ id: 'a', criteria: null }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.criteria_count).toEqual(new Set(['b']))
  })

  it('ties on criteria_count highlight all tied listings', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { no_above_neighbors: true, three_bedrooms: true } }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: true, has_garage: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.criteria_count).toEqual(new Set(['a', 'b']))
  })

  it('per-criterion: highlights listings with criterion checked when others do not', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { no_above_neighbors: true } }),
      makeListing({ id: 'b', criteria: { no_above_neighbors: false } }),
      makeListing({ id: 'c', criteria: null }),
    ]
    const best = getBestValues(listings)
    expect(best.no_above_neighbors).toEqual(new Set(['a']))
  })

  it('per-criterion: no highlight when all listings have the criterion checked', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { has_garage: true } }),
      makeListing({ id: 'b', criteria: { has_garage: true } }),
    ]
    const best = getBestValues(listings)
    expect(best.has_garage).toEqual(new Set())
  })

  it('per-criterion: no highlight when no listing has the criterion checked', () => {
    const listings = [
      makeListing({ id: 'a', criteria: { has_garage: false } }),
      makeListing({ id: 'b', criteria: null }),
    ]
    const best = getBestValues(listings)
    expect(best.has_garage).toEqual(new Set())
  })
})
```

### Step 2: Run the tests to verify they fail

- [ ] Run: `npm run test -- comparison.test.ts`
- [ ] Expected: the new tests fail with TypeScript errors like "Property 'criteria_count' does not exist on type 'BestMap'" (or equivalent at runtime).

### Step 3: Implement the changes in `src/lib/comparison.ts`

- [ ] Add an import for `criteria` at the top of the file:

```ts
import { criteria, countChecked } from '@/lib/criteria'
import type { Listing } from '@/types/listing'
```

- [ ] Extend the `BestMap` type. Replace the existing `BestMap` type with:

```ts
export type BestMap = {
  price: Set<string>
  bedrooms: Set<string>
  liveable_area_sqft: Set<string>
  price_per_sqft: Set<string>
  parking: Set<string>
  year_built: Set<string>
  taxes_yearly: Set<string>
  common_fees_yearly: Set<string>
  hydro_yearly: Set<string>
  downpayment: Set<string>
  monthly_mortgage: Set<string>
  total_monthly_cost: Set<string>
  commute_school_car: Set<string>
  commute_pvm_transit: Set<string>
  criteria_count: Set<string>
  // One entry per criterion key — see src/lib/criteria.ts
  [criterionKey: string]: Set<string>
}
```

- [ ] Add a helper for binary-criterion highlighting, below the existing `findBest` function:

```ts
/**
 * Highlight listings where a criterion is checked, but only when at least one
 * other listing does not have it checked. If all listings agree (all checked
 * or all unchecked/missing), nothing is highlighted.
 */
function findBestBinary(
  listings: Listing[],
  criterionKey: string,
): Set<string> {
  if (listings.length < 2) return new Set()

  const checkedIds: string[] = []
  let anyUnchecked = false

  for (const l of listings) {
    const isChecked = l.criteria?.[criterionKey] === true
    if (isChecked) {
      checkedIds.push(l.id)
    } else {
      anyUnchecked = true
    }
  }

  if (checkedIds.length === 0 || !anyUnchecked) return new Set()
  return new Set(checkedIds)
}
```

- [ ] Update `getBestValues` to include the new entries. Replace the existing `getBestValues` function body with:

```ts
export function getBestValues(listings: Listing[]): BestMap {
  const base = {
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
    criteria_count: findBest(listings, l => countChecked(l.criteria), 'max'),
  } as BestMap

  for (const c of criteria) {
    base[c.key] = findBestBinary(listings, c.key)
  }

  return base
}
```

### Step 4: Run the tests to verify they pass

- [ ] Run: `npm run test -- comparison.test.ts`
- [ ] Expected: all tests in the file pass (the existing 9 + the 6 new ones).

### Step 5: Commit

- [ ] Run:

```bash
git add src/lib/comparison.ts src/lib/__tests__/comparison.test.ts
git commit -m "feat(comparison): add criteria_count and per-criterion best values"
```

---

## Task 2: Render the criteria section in the comparison page

**Files:**
- Modify: `src/app/compare/page.tsx`

### Step 1: Add imports

- [ ] In `src/app/compare/page.tsx`, add an import for the criteria definitions and for `countChecked`. Update the imports block near the top of the file so it includes:

```tsx
import { criteria, countChecked } from '@/lib/criteria'
```

(Add it alongside the existing `@/lib/...` imports.)

### Step 2: Add the update handler inside `CompareContent`

- [ ] Inside `CompareContent`, after the existing `useEffect` that loads listings and before the `bestValues` `useMemo`, add an update handler that optimistically updates local state then writes to Supabase:

```tsx
async function updateCriteria(id: string, next: Record<string, boolean>) {
  setListings(prev =>
    prev.map(l => (l.id === id ? { ...l, criteria: next } : l))
  )
  const { error } = await supabase
    .from('listings')
    .update({ criteria: next })
    .eq('id', id)
  if (error) console.error('Failed to update criteria:', error)
}
```

### Step 3: Add a helper to render criteria rows inside the card

- [ ] Inside the returned JSX, locate the block `<div className="divide-y divide-slate-50">` that renders `compareFields.map(...)`. Insert a new criteria section *before* the existing `divide-y` block so it appears at the top of each card (below the location header).

Replace this existing section:

```tsx
              {/* Data rows */}
              <div className="divide-y divide-slate-50">
                {compareFields.map(field => {
```

with:

```tsx
              {/* Criteria section */}
              <div className="divide-y divide-slate-50">
                {(() => {
                  const checkedCount = countChecked(listing.criteria ?? null)
                  const countIsBest = bestValues.criteria_count.has(listing.id)
                  return (
                    <div
                      className={`flex items-start justify-between px-4 py-2 ${countIsBest ? 'bg-green-50' : ''}`}
                    >
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide shrink-0">
                        Criteria met
                      </span>
                      <span className={`text-sm text-right ${countIsBest ? 'text-green-700 font-medium' : 'text-slate-700'}`}>
                        {checkedCount} / {criteria.length}
                      </span>
                    </div>
                  )
                })()}
                {criteria.map(c => {
                  const checked = listing.criteria?.[c.key] === true
                  const rowIsBest = bestValues[c.key]?.has(listing.id) ?? false
                  return (
                    <div
                      key={`crit-${c.key}`}
                      className={`flex items-center justify-between px-4 py-2 ${rowIsBest ? 'bg-green-50' : ''}`}
                    >
                      <span className={`text-xs font-medium uppercase tracking-wide shrink-0 ${rowIsBest ? 'text-green-700' : 'text-slate-400'}`}>
                        {c.label}
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const current = listing.criteria ?? {}
                          const next = { ...current, [c.key]: !checked }
                          updateCriteria(listing.id, next)
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  )
                })}
              </div>

              {/* Data rows */}
              <div className="divide-y divide-slate-50">
                {compareFields.map(field => {
```

Note: this leaves the existing `compareFields.map(...)` block and its closing braces untouched.

### Step 4: Manually verify in the browser

- [ ] Start the dev server (via `preview_start` if using Claude Preview, otherwise `npm run dev`).
- [ ] Navigate to `/` and select 2+ listings to compare (check their compare boxes), then click "Compare".
- [ ] Confirm in each listing's card:
  - A "Criteria met: X / 5" row appears at the top, below the location header.
  - Five criterion rows follow with checkboxes reflecting the stored state.
  - Toggling a checkbox updates the count row immediately and persists (refresh the page — value is still there).
  - The listing with the highest count has the green highlight on the summary row; ties are both highlighted.
  - A row where one listing has the criterion checked and another does not shows green on the checked listing's row only. When all listings have a criterion equally (all checked or all unchecked), no row gets the green highlight.

### Step 5: Commit

- [ ] Run:

```bash
git add src/app/compare/page.tsx
git commit -m "feat(compare): render good-to-have criteria in comparison cards"
```

---

## Verification after both tasks

- [ ] Run the full unit test suite: `npm run test`
  - Expected: all tests pass.
- [ ] Run the type checker: `npm run build` (or `npx tsc --noEmit` if available in package.json scripts)
  - Expected: no TypeScript errors.
