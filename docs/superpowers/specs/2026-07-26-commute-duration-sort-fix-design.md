# Commute duration sort fix — design

**Date:** 2026-07-26
**Status:** Approved (design)

## Problem

Sorting the listings table by the **School** column (`commute_school_car`) puts
single-digit-minute listings at the bottom even though they are the shortest
commute. Three listings showing `0:09` sort after every `10 min`+ listing.

### Root cause

Commute times are stored as **strings** in the auto format `"<n> min"` (e.g.
`"9 min"`, `"32 min"`), written by `calculateAndStoreCommute` in
`src/lib/commute.ts`. The displayed `0:09` is just `formatDuration` reformatting
`"9 min"`.

The sort comparator in `src/hooks/useSort.ts` only does numeric comparison when
**both** values are `typeof === 'number'`. Because these values are strings, it
falls back to `String(aVal).localeCompare(bVal)` — a lexicographic (dictionary)
comparison. Two-digit values (`"10 min"`…`"45 min"`) happen to sort correctly
that way, which is why everything else looks right; but `"9 min"` begins with the
character `9`, which is "greater than" `1`/`2`/`3`/`4`, so single-digit values are
pushed to the end. It is not specific to `0:09` — any single-digit-minute value
behaves the same.

### The deeper issue

Four separate places convert these duration strings to numbers, and they do not
agree:

| Location | Purpose | Handles `"9 min"`? | Status |
|---|---|---|---|
| `src/hooks/useSort.ts` | Sorting | No (text compare) | Broken — the reported bug |
| `src/lib/comparison.ts` `parseDuration` | Green "best value" highlight | No (only `"H:MM"`) | Broken — highlight never fires |
| `src/lib/criteria.ts` `parseLeadingInt` | "within 20 min" criteria | Yes | Works |
| `src/lib/filters.ts` `parseCommuteMinutes` | Commute filters | Yes | Works |

Having four parsers is the underlying defect: it is why the bug exists and why it
is broken inconsistently. There is also a latent display bug — `formatDuration`
turns an `"0:09"`-shaped input into `"0:00"`.

## Goal

One canonical duration parser, used everywhere, so:

- Sorting the School / PVM columns orders by actual minutes, shortest first, with
  blank/unknown values last.
- The green "best value" (shortest commute) highlight fires correctly.
- Criteria derivation and filters keep working, now sharing the same parser.
- This class of bug cannot recur through parser drift.

## Approach (chosen: A — one shared parser, consolidate all four call sites)

### 1. New module `src/lib/duration.ts`

```
parseDurationToMinutes(value: string | null | undefined): number | null
```

Rules:
- `null` / `undefined` / empty / whitespace-only → `null`.
- `"H:MM"` shape (e.g. `"0:09"`, `"1:15"`) → `hours * 60 + minutes`. Checked
  first because it must not fall through to the leading-integer branch.
- Otherwise extract hours (`N hour|hr|h`) and minutes (`N min|m`), summed. If
  neither unit is present, treat a leading integer as minutes (`"9 min"` → 9,
  `"9"` → 9).
- No parseable number (e.g. `"unknown"`) → `null`.

This is a strict superset of the two currently-working parsers, so criteria and
filter behavior is unchanged for real data.

### 2. `src/hooks/useSort.ts`

`getValue` (or the comparator) consults the column's format. For columns whose
`format === 'duration'`, return `parseDurationToMinutes(value)` — a number or
`null`. The existing numeric-comparison branch and null-sorts-last logic then work
unchanged. Format is looked up from the existing `columns` definition
(`src/lib/columns.ts`), so no column keys are hard-coded.

### 3. `src/lib/comparison.ts`

Remove the local `"H:MM"`-only `parseDuration`; use `parseDurationToMinutes` for
`commute_school_car` and `commute_pvm_transit` in `getBestValues`.

### 4. `src/lib/criteria.ts` and `src/lib/filters.ts`

Point the commute conversions at the shared parser:
- `criteria.ts`: `schoolMin` / `pvmMin` use `parseDurationToMinutes` (bedrooms
  keeps its own `parseLeadingInt`).
- `filters.ts`: `parseCommuteMinutes` delegates to (or is replaced by) the shared
  parser.

Behavior is identical for existing data; this removes the duplicate parsers.

### 5. `src/lib/formatting.ts`

`formatDuration` reuses `parseDurationToMinutes` for the parse step, then renders
`H:MM`. This also fixes the latent `"0:09" → "0:00"` case.

## Testing

- **`duration.ts` unit tests:** `"9 min"` → 9, `"32 min"` → 32, `"1 hour 15 min"`
  → 75, `"0:09"` → 9, `"1:15"` → 75, `"9"` → 9, `null`/`""`/`"unknown"` → `null`.
- **`useSort` test:** sorting by `commute_school_car` ascending orders
  `"9 min"` < `"10 min"` < `"32 min"`, with `null` last; descending keeps `null`
  last.
- **`comparison` test:** shortest commute is highlighted for realistic `"N min"`
  data (update the existing `"0:45"`/`"1:15"` fixtures, which used an unrealistic
  format).
- **`formatting` test:** `formatDuration("0:09")` → `"0:09"` (regression guard).
- Existing criteria and filter tests must continue to pass unchanged.

## Out of scope

- No database/schema change; storage stays as `"<n> min"` strings (Approach C
  rejected — migration/backfill not justified).
- No change to `bedrooms` or `parking` parsing.
- Display components that merely render the string (map popups, share card,
  detail panel) are untouched.
```
