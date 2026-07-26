# Commute Duration Sort Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the School / PVM commute columns sort by actual minutes (shortest first, blanks last) by routing all duration-string parsing through one shared parser.

**Architecture:** Commute times are stored as strings like `"9 min"`. Today four different call sites parse them into numbers and disagree, which is why sorting breaks on single-digit minutes and the "best value" highlight never fires. This plan adds one canonical `parseDurationToMinutes` in `src/lib/duration.ts` and points sorting, the best-value highlight, criteria derivation, filtering, and display formatting at it.

**Tech Stack:** TypeScript, Next.js 16, React 19, Vitest 4 for tests. Test runner: `npx vitest run <path>` (single test: add `-t "<name>"`).

---

## Preliminary: Create a working branch

- [ ] **Step 0: Branch off master**

The repo is currently on `master`. Create a branch before making changes.

Run:
```bash
git checkout -b fix/commute-duration-sort
```
Expected: `Switched to a new branch 'fix/commute-duration-sort'`

---

## Task 1: Shared duration parser

Create the single source of truth for turning a stored duration string into minutes.

**Files:**
- Create: `src/lib/duration.ts`
- Test: `src/lib/__tests__/duration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/duration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseDurationToMinutes } from '@/lib/duration'

describe('parseDurationToMinutes', () => {
  it('parses the stored "N min" format', () => {
    expect(parseDurationToMinutes('9 min')).toBe(9)
    expect(parseDurationToMinutes('32 min')).toBe(32)
  })

  it('parses hours and combined hours/minutes', () => {
    expect(parseDurationToMinutes('1 hour')).toBe(60)
    expect(parseDurationToMinutes('1 hour 15 mins')).toBe(75)
  })

  it('parses the H:MM display format defensively', () => {
    expect(parseDurationToMinutes('0:09')).toBe(9)
    expect(parseDurationToMinutes('1:15')).toBe(75)
  })

  it('parses a bare integer as minutes', () => {
    expect(parseDurationToMinutes('9')).toBe(9)
  })

  it('returns null for blank or non-numeric values', () => {
    expect(parseDurationToMinutes(null)).toBeNull()
    expect(parseDurationToMinutes(undefined)).toBeNull()
    expect(parseDurationToMinutes('')).toBeNull()
    expect(parseDurationToMinutes('   ')).toBeNull()
    expect(parseDurationToMinutes('unknown')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/duration.test.ts`
Expected: FAIL — cannot resolve `@/lib/duration` / `parseDurationToMinutes is not a function`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/duration.ts`:

```ts
/**
 * Canonical parser for commute duration strings.
 *
 * Handles every shape these values appear in:
 *   - stored auto format: "9 min", "32 min"
 *   - hours: "1 hour", "1 hour 15 mins"
 *   - display format (defensive): "0:09", "1:15"
 *   - bare integer minutes: "9"
 *
 * Returns whole minutes, or null for blank / unparseable values so callers can
 * sort them last and skip them in comparisons.
 */
export function parseDurationToMinutes(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (s === '') return null

  // H:MM form, e.g. "0:09", "1:15"
  const hm = s.match(/^(\d+):([0-5]?\d)$/)
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10)

  // "N hour(s)" and/or "N min(s)" form
  const hoursMatch = s.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i)
  const minsMatch = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i)
  if (hoursMatch || minsMatch) {
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0
    return hours * 60 + mins
  }

  // Bare integer → minutes
  const bare = s.match(/^-?\d+$/)
  if (bare) {
    const n = parseInt(bare[0], 10)
    return Number.isFinite(n) ? n : null
  }

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/duration.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/duration.ts src/lib/__tests__/duration.test.ts
git commit -m "feat(duration): add canonical parseDurationToMinutes helper"
```

---

## Task 2: Fix the sort (the reported bug)

Make `useSort` compare duration columns by parsed minutes instead of by text.

**Files:**
- Modify: `src/hooks/useSort.ts`
- Test: `src/hooks/__tests__/useSort.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test inside the `describe('useSort — multi-level', ...)` block in `src/hooks/__tests__/useSort.test.ts` (after the existing `'nulls sort last in asc and desc'` test):

```ts
  it('sorts commute_school_car by minutes, not text, with blanks last', () => {
    const ls = [
      mk({ id: 'a', commute_school_car: '32 min' }),
      mk({ id: 'b', commute_school_car: '9 min' }),
      mk({ id: 'c', commute_school_car: null }),
      mk({ id: 'd', commute_school_car: '10 min' }),
    ]
    const { result } = renderHook(() => useSort(ls))
    act(() => result.current.setSort([{ column: 'commute_school_car', direction: 'asc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['b', 'd', 'a', 'c'])
    act(() => result.current.setSort([{ column: 'commute_school_car', direction: 'desc' }]))
    expect(result.current.sorted.map(l => l.id)).toEqual(['a', 'd', 'b', 'c'])
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useSort.test.ts -t "sorts commute_school_car by minutes"`
Expected: FAIL — current text sort returns `['d', 'a', 'b', 'c']` (the `"9 min"` row `b` sorts after the two-digit rows).

- [ ] **Step 3: Modify `getValue` to parse duration columns**

In `src/hooks/useSort.ts`, add two imports at the top of the import block (below the existing `import { countChecked, deriveCriteria } from '@/lib/criteria'` line):

```ts
import { columns } from '@/lib/columns'
import { parseDurationToMinutes } from '@/lib/duration'
```

Add a module-level set of duration column keys, directly above the `getValue` function:

```ts
const durationColumnKeys = new Set(
  columns.filter(c => c.format === 'duration').map(c => c.key)
)
```

Replace the existing `getValue` function:

```ts
function getValue(l: Listing, column: string): unknown {
  if (column === 'criteria_count') return countChecked(deriveCriteria(l))
  return l[column as keyof Listing]
}
```

with:

```ts
function getValue(l: Listing, column: string): unknown {
  if (column === 'criteria_count') return countChecked(deriveCriteria(l))
  if (durationColumnKeys.has(column)) {
    return parseDurationToMinutes(l[column as keyof Listing] as string | null)
  }
  return l[column as keyof Listing]
}
```

No change is needed to `compareByColumn`: it already handles `null` (sorts last, direction-invariant) and numeric subtraction.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useSort.test.ts`
Expected: PASS (new test plus all existing useSort tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useSort.ts src/hooks/__tests__/useSort.test.ts
git commit -m "fix(sort): sort commute columns by minutes instead of text"
```

---

## Task 3: Fix the "best value" highlight

Replace the broken `"H:MM"`-only parser in the comparison module with the shared one.

**Files:**
- Modify: `src/lib/comparison.ts`
- Test: `src/lib/__tests__/comparison.test.ts:114-121`

- [ ] **Step 1: Update the existing test to use realistic stored data**

In `src/lib/__tests__/comparison.test.ts`, replace the existing test (currently lines 114-121):

```ts
  it('picks shortest commute (parses "1:15" as 75 minutes)', () => {
    const listings = [
      makeListing({ id: 'a', commute_school_car: '0:45' }),
      makeListing({ id: 'b', commute_school_car: '1:15' }),
    ]
    const best = getBestValues(listings)
    expect(best.commute_school_car).toEqual(new Set(['a']))
  })
```

with:

```ts
  it('picks shortest commute from stored "N min" values', () => {
    const listings = [
      makeListing({ id: 'a', commute_school_car: '9 min' }),
      makeListing({ id: 'b', commute_school_car: '12 min' }),
    ]
    const best = getBestValues(listings)
    expect(best.commute_school_car).toEqual(new Set(['a']))
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/comparison.test.ts -t "picks shortest commute"`
Expected: FAIL — the old `parseDuration` returns `null` for `"9 min"` and `"12 min"` (neither matches `H:MM`), so `findBest` sees no entries and returns an empty set instead of `{'a'}`.

- [ ] **Step 3: Swap in the shared parser**

In `src/lib/comparison.ts`, add this import directly below the existing first import line (`import { criteria, countChecked, deriveCriteria, type CriterionKey } from '@/lib/criteria'`):

```ts
import { parseDurationToMinutes } from '@/lib/duration'
```

Delete the local `parseDuration` helper (currently lines 30-36):

```ts
/** Parse "H:MM" duration strings into total minutes. */
function parseDuration(value: string | null): number | null {
  if (value === null || value === '') return null
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return null
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
}
```

In `getBestValues`, update the two commute lines (currently lines 107-108):

```ts
    commute_school_car: findBest(listings, l => parseDuration(l.commute_school_car), 'min'),
    commute_pvm_transit: findBest(listings, l => parseDuration(l.commute_pvm_transit), 'min'),
```

to:

```ts
    commute_school_car: findBest(listings, l => parseDurationToMinutes(l.commute_school_car), 'min'),
    commute_pvm_transit: findBest(listings, l => parseDurationToMinutes(l.commute_pvm_transit), 'min'),
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/comparison.test.ts`
Expected: PASS (updated test plus all existing comparison tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/comparison.ts src/lib/__tests__/comparison.test.ts
git commit -m "fix(comparison): highlight shortest commute for stored min values"
```

---

## Task 4: Consolidate criteria and filter parsers

Point the two already-working parsers at the shared helper so all callers agree and can't drift apart. Behavior is unchanged; the existing tests are the safety net.

**Files:**
- Modify: `src/lib/criteria.ts`
- Modify: `src/lib/filters.ts`
- Test (existing, must stay green): `src/lib/__tests__/criteria.test.ts`, `src/lib/__tests__/filters.test.ts`

- [ ] **Step 1: Confirm the existing tests currently pass**

Run: `npx vitest run src/lib/__tests__/criteria.test.ts src/lib/__tests__/filters.test.ts`
Expected: PASS. This is the baseline these edits must preserve.

- [ ] **Step 2: Update `criteria.ts`**

In `src/lib/criteria.ts`, add an import at the very top of the file (line 1, above `export type CriterionKey`):

```ts
import { parseDurationToMinutes } from '@/lib/duration'
```

In `deriveCriteria`, change the two commute lines (currently lines 67-68):

```ts
  const schoolMin = parseLeadingInt(listing.commute_school_car)
  const pvmMin = parseLeadingInt(listing.commute_pvm_transit)
```

to:

```ts
  const schoolMin = parseDurationToMinutes(listing.commute_school_car)
  const pvmMin = parseDurationToMinutes(listing.commute_pvm_transit)
```

Leave `parseLeadingInt` in the file — it is still used for `bedrooms` on the line directly above (`const bedrooms = parseLeadingInt(listing.bedrooms)`).

- [ ] **Step 3: Update `filters.ts`**

In `src/lib/filters.ts`, add the import below the existing first import line (`import type { Listing } from '@/types/listing'`):

```ts
import { parseDurationToMinutes } from '@/lib/duration'
```

Delete the local `parseCommuteMinutes` helper (currently lines 31-35):

```ts
function parseCommuteMinutes(s: string | null): number | null {
  if (!s) return null
  const n = parseInt(s, 10)
  return isNaN(n) ? null : n
}
```

Update its two call sites inside `applyFilters` (currently lines 78 and 85):

```ts
        const mins = parseCommuteMinutes(l.commute_school_car)
```
becomes
```ts
        const mins = parseDurationToMinutes(l.commute_school_car)
```

and

```ts
        const mins = parseCommuteMinutes(l.commute_pvm_transit)
```
becomes
```ts
        const mins = parseDurationToMinutes(l.commute_pvm_transit)
```

- [ ] **Step 4: Run the tests to verify they still pass**

Run: `npx vitest run src/lib/__tests__/criteria.test.ts src/lib/__tests__/filters.test.ts`
Expected: PASS (unchanged behavior).

- [ ] **Step 5: Commit**

```bash
git add src/lib/criteria.ts src/lib/filters.ts
git commit -m "refactor: route criteria and filter commute parsing through shared helper"
```

---

## Task 5: Share the parser in display formatting

Have `formatDuration` reuse the shared parser. This removes the last duplicate parse logic and fixes a latent bug where an `"0:09"`-shaped value rendered as `"0:00"`.

**Files:**
- Modify: `src/lib/formatting.ts:24-48`
- Test: `src/lib/__tests__/formatting.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/formatting.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { formatCellValue } from '@/lib/formatting'

describe('formatCellValue — duration', () => {
  it('renders the stored "N min" format as H:MM', () => {
    expect(formatCellValue('9 min', 'duration')).toBe('0:09')
    expect(formatCellValue('75 min', 'duration')).toBe('1:15')
  })

  it('renders an already-H:MM value correctly (regression for 0:09 -> 0:00)', () => {
    expect(formatCellValue('0:09', 'duration')).toBe('0:09')
  })

  it('renders blank values as an em dash', () => {
    expect(formatCellValue(null, 'duration')).toBe('—')
    expect(formatCellValue('', 'duration')).toBe('—')
  })

  it('passes through non-numeric text unchanged', () => {
    expect(formatCellValue('unknown', 'duration')).toBe('unknown')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/__tests__/formatting.test.ts`
Expected: FAIL on the `0:09 -> 0:00` regression case — the current `formatDuration` treats `"0:09"` as a bare number `parseInt("0:09") === 0` and returns `"0:00"`.

- [ ] **Step 3: Rewrite `formatDuration` to use the shared parser**

In `src/lib/formatting.ts`, add this import below the existing `import type { ColumnFormat } from './columns'` line:

```ts
import { parseDurationToMinutes } from './duration'
```

Replace the entire `formatDuration` function (currently lines 24-48):

```ts
function formatDuration(value: string | null): string {
  if (value === null || value === undefined || value === '') return EM_DASH
  const s = String(value).trim()

  // Try to extract hours and minutes from the Google Directions text (e.g. "32 mins", "1 hour 15 mins", "2 hours").
  const hoursMatch = s.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i)
  const minsMatch = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i)

  let hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
  let mins = minsMatch ? parseInt(minsMatch[1], 10) : 0

  if (!hoursMatch && !minsMatch) {
    // Fall back to treating the whole string as a minute count.
    const pureNum = parseInt(s, 10)
    if (isNaN(pureNum)) return s
    hours = Math.floor(pureNum / 60)
    mins = pureNum % 60
  }

  // Normalize: carry minutes >= 60 into hours
  hours += Math.floor(mins / 60)
  mins = mins % 60

  return `${hours}:${mins.toString().padStart(2, '0')}`
}
```

with:

```ts
function formatDuration(value: string | null): string {
  if (value === null || value === undefined || value === '') return EM_DASH
  const total = parseDurationToMinutes(value)
  // Preserve non-numeric text (e.g. "unknown") rather than showing an em dash.
  if (total === null) return String(value).trim()
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/__tests__/formatting.test.ts`
Expected: PASS (all 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/formatting.ts src/lib/__tests__/formatting.test.ts
git commit -m "fix(formatting): parse durations via shared helper, fix H:MM display"
```

---

## Task 6: Full verification

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: PASS — all suites green, including the pre-existing ones (`TableRow`, `criteria`, `filters`, `comparison`, `useSort`, etc.).

- [ ] **Step 2: Type-check / lint the build surface**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: (Optional) Manual smoke check in the app**

Start the dev server and confirm: sorting by the **School** column ascending now puts the `0:09` listings at the top; the shortest-commute cell shows the green "best" highlight in the comparison view.

---

## Notes for the implementer

- **Do not** change how values are stored (`"<n> min"` in `commute.ts`). Storage is intentionally unchanged.
- **Do not** touch `bedrooms` or `parking` parsing — only commute durations move to the shared helper.
- Import style: lib files that already use the `@/lib/...` alias (comparison, criteria, filters, useSort) import the helper as `@/lib/duration`; `formatting.ts` uses relative imports, so it imports `./duration`.
- `parseDurationToMinutes` returning `null` is deliberate — the sort comparator relies on it to keep blank values last.
