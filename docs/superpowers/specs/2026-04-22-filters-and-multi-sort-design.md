# Column filters + multi-column sort — Design

**Date:** 2026-04-22
**Status:** Draft

## Goal

Expand the listings table's filtering and sorting to better match how Patrick narrows down shortlisted houses. Add filters for beds, commute time, max monthly cost, and garage availability; add literal multi-column sort so primary-sort ties break predictably. No DB, API, or persistence changes.

## Non-goals

- Saved filter presets.
- Filter/sort persistence across reloads (URL or localStorage).
- Server-side filtering.
- Column visibility controls.
- Range filters beyond what's listed below.

## Current state

- [FilterBar.tsx](../../../src/components/FilterBar.tsx): inline controls for `type`, `minPrice`, `maxPrice`, `favoritesOnly`, `flagStatus`.
- Filter logic lives inline in [ListingsTable.tsx:28-43](../../../src/components/ListingsTable.tsx).
- [useSort.ts](../../../src/hooks/useSort.ts): single-column click-to-sort with asc→desc→none cycle; nulls sort last.
- [TableHeader.tsx](../../../src/components/TableHeader.tsx): renders a single ↑/↓ arrow on the active sort column.

## Data model

Extend the `Filters` interface (in [FilterBar.tsx](../../../src/components/FilterBar.tsx)):

```ts
export interface Filters {
  // existing
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
  // new
  minBeds: string              // integer parsed; rows with unparseable beds are excluded when active
  maxCommuteSchool: string     // minutes; excludes rows with null commute when active
  maxCommutePvm: string        // minutes; excludes rows with null commute when active
  maxMonthlyCost: string       // dollars; excludes rows with null total_monthly_cost when active
  hasGarage: boolean           // true → parking text matches /\b\d+\s*garage/i
}
```

Replace the sort state (in [useSort.ts](../../../src/hooks/useSort.ts)):

```ts
type SortLevel = { column: string; direction: 'asc' | 'desc' }
type SortState = SortLevel[]     // empty = unsorted; apply in order, tiebreak left→right
```

The comparator walks levels in order; the first non-zero comparison wins. Nulls always sort last regardless of direction — preserves current behavior.

## Components

### `FilterPanel` (new)

Replaces the inline expanded row at [FilterBar.tsx:116-154](../../../src/components/FilterBar.tsx).

- Triggered by the existing "Filters" button → opens as a popover anchored below it. Tailwind `absolute`-positioned; click-outside closes.
- Grouped sections with labels:
  - **Property** — type dropdown
  - **Price** — min / max inputs (existing fields)
  - **Beds** — min input (integer)
  - **Commute** — two sliders: "Max School (min)" 0–90, "Max PVM (min)" 0–120. Each is gated by an enabling checkbox ("Limit School commute" / "Limit PVM commute"). Unchecking the box clears the value and deactivates the filter.
  - **Costs** — max total monthly cost input
  - **Features** — "At least 1 garage" toggle
- Footer: active-filter count + "Clear all" button.
- The "Filters" button shows count: `Filters (3)` when any fields are non-default.

### `SortPanel` (new)

Triggered by a new **"Sort"** button placed next to "Filters" in the top bar.

- Lists current sort levels top-to-bottom (primary → tiebreakers). Each row shows: column name, ↑/↓ direction toggle, × remove, ↑/↓ reorder arrows.
- Footer: `+ Add sort` dropdown listing columns not already in the sort array.
- Button label: `Sort` when empty, `Sort (2)` when 2 levels active.

### `TableHeader` (modify)

- Plain click on a header:
  - If column is not in the sort array, replace sort with `[{column, asc}]`.
  - If column is the sole active sort column, flip direction (asc → desc); clicking a third time clears.
  - If column is one of several in the sort array, replace sort with just that column, asc (predictable "reset to just this" behavior).
- Shift-click on a header:
  - If column is absent, append as new level with asc.
  - If column is present, flip its direction.
  - Third shift-click on the same column: remove that level (keeps other levels intact).
- Badge rendering: replace the single ↑/↓ arrow with a compact pill like `1↑` or `2↓` showing rank + direction. Only rendered for columns in the sort array.

## Logic & data flow

Pipeline stays: `fetch → applyFilters → useSort → render`. No DB changes, no API changes.

### Filter application

Extract the inline filter at [ListingsTable.tsx:28-43](../../../src/components/ListingsTable.tsx) into a pure helper `applyFilters(listings, filters)` in a new `src/lib/filters.ts`. Easier to unit-test.

New predicates (all skipped when their field is empty/false):

- `minBeds`: `parseInt(l.bedrooms, 10) >= min`. NaN → excluded.
- `maxCommuteSchool`: `l.commute_school_car != null && l.commute_school_car <= max`.
- `maxCommutePvm`: `l.commute_pvm_transit != null && l.commute_pvm_transit <= max`.
- `maxMonthlyCost`: `l.total_monthly_cost != null && l.total_monthly_cost <= max`.
- `hasGarage`: `/\b\d+\s*garage/i.test(l.parking ?? '')`. Matches "1 garage", "2 garages", "1 garage + 1 outdoor"; rejects "1 outdoor", null, "".

**Unit conversion check (implementation-time):** verify whether `commute_school_car` and `commute_pvm_transit` are stored in minutes (integer) or seconds. Slider labels show minutes either way; if seconds, the predicate converts the user's max to seconds before comparing. This is a small implementation detail, not a design decision.

### Sort application

`useSort` becomes:

```ts
const sorted = useMemo(() => {
  if (sort.length === 0) return listings
  return [...listings].sort((a, b) => {
    for (const { column, direction } of sort) {
      const cmp = compareByColumn(a, b, column)  // nulls-last, existing rules
      if (cmp !== 0) return direction === 'desc' ? -cmp : cmp
    }
    return 0
  })
}, [listings, sort])
```

`compareByColumn` preserves the existing rules from [useSort.ts:32-49](../../../src/hooks/useSort.ts): `criteria_count` special case, number vs. localeCompare for strings, nulls always last.

## Persistence

None. Filters and sort reset to empty on page reload (per explicit user decision during brainstorm — see "no persistence" in review).

## Testing

### Unit tests — new `src/lib/__tests__/filters.test.ts`

- Each new filter independently: empty field = no-op, active field = correct inclusion/exclusion.
- Null handling: null `commute_school_car`, `commute_pvm_transit`, `total_monthly_cost`, or unparseable `bedrooms` are excluded when the relevant filter is active.
- Garage regex: "1 garage", "2 garages", "1 garage + 1 outdoor" match; "1 outdoor", "", null do not.
- Combining filters = logical AND.
- Regression guard: existing filters (type, price, favorites, flag) still behave as before.

### Unit tests — extend existing sort tests

- Empty sort array → original input order.
- Single-level sort matches current behavior (regression guard).
- Multi-level: primary sorts; ties broken by secondary; ties of both broken by tertiary.
- Nulls sort last in both asc and desc (preserves current convention).
- `criteria_count` works as both primary and secondary sort.

### Component tests

- `TableHeader`: click cycles asc → desc → clear on sole-column. Shift-click adds, flips, and on third shift-click removes. Plain-click when multi-level is active collapses to `[{column, asc}]`.
- `FilterPanel`: the slider-enable checkbox enables/disables the slider control; disabling clears the value so the filter deactivates.
- `SortPanel`: add, remove, reorder (up/down), direction toggle all dispatch the correct next state.

## Edge cases

- **Beds "3+1" legacy rows:** `parseInt("3+1", 10)` returns 3. Consistent with "minimum 3" semantics. No special handling.
- **Plain click vs. shift-click on active single sort:** plain click cycles (asc → desc → clear); does NOT demote to secondary. Predictable.
- **Active-filter count:** counts any field not at its default (empty string, `false`, `'all'`). Drives the "Filters (N)" badge.
- **Empty sort panel state:** `Sort` button opens a panel with just the `+ Add sort` dropdown.

## Files touched

New:
- `src/lib/filters.ts` — pure filter helper.
- `src/lib/__tests__/filters.test.ts` — unit tests.
- `src/components/FilterPanel.tsx` — popover.
- `src/components/SortPanel.tsx` — popover.

Modified:
- `src/components/FilterBar.tsx` — extend `Filters` interface, replace inline expansion with `<FilterPanel>` trigger, add `<SortPanel>` trigger.
- `src/hooks/useSort.ts` — change `SortState` to `SortLevel[]`, rewrite comparator.
- `src/components/TableHeader.tsx` — shift-click handling, rank+direction badges.
- `src/components/ListingsTable.tsx` — swap inline filter for `applyFilters()` call; initialize new Filters fields.
- Any sort-related tests under `src/hooks/__tests__/` or `src/components/__tests__/`.

No DB migrations. No API route changes. No changes to the extraction flow or bookmarklet.
