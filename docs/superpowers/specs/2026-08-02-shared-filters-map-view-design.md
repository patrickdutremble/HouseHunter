# Shared filters across list and map views

**Date:** 2026-08-02
**Status:** Approved

## Problem

Filters set on the list view (bedrooms, price, favorites, flag status, garage, commute,
monthly cost) do not carry over when the user switches to the map view. The search box,
by contrast, does carry over. The user wants the filters to behave like search: applied to
the map as well, and adjustable from either view.

## Root cause

- The search `query` lives in the parent page (`HomeContent` in `src/app/page.tsx`) and is
  applied via `filterListings(listings, query)` *before* the data is handed to both the
  table and the map. That is why search persists across the view toggle.
- The filters live **inside** `ListingsTable` as local `useState` (`src/components/ListingsTable.tsx`)
  and are applied there via `applyFilters`. When the user switches to the map, `ListingsTable`
  unmounts, that state is discarded, and `MapView` only ever receives the search-filtered
  listings.

## Approach (chosen)

Lift the filter and sort state up to the parent and apply filtering once, before the data
is split to the two views — mirroring how search already works. Move the `FilterBar` into
the shared top toolbar so it is visible and editable in both views.

Rejected alternatives:
- **Split the sort control off FilterBar** so sort stays in the table — extra surgery to
  FilterBar for a cosmetic gain that a single `showSort` prop already handles.
- **Keep the table mounted (hidden) under the map** to preserve its state — a hack that
  keeps an invisible component alive purely to hold state; fragile and confusing later.

## Design

### 1. State lifts into `HomeContent` (`src/app/page.tsx`)

- `filters: Filters` state (initialised to `EMPTY_FILTERS`) moves from `ListingsTable` up to
  `HomeContent`.
- The `useSort` hook moves up to `HomeContent`.
- `propertyTypes` (filter dropdown options, derived from `listings`) is computed in the
  parent, since the FilterBar now lives there.

### 2. One filtering pipeline in the parent

```
searched = filterListings(listings, query)   // search box (already exists)
filtered = applyFilters(searched, filters)   // NEW: filters applied in the parent
sorted   = useSort(filtered)                 // sort, for the table
```

- `MapView` receives `filtered` (unsorted — marker order is irrelevant).
- `ListingsTable` receives `sorted`.

Search and filters stack (both are AND predicates; application order does not affect the
result).

### 3. FilterBar moves to the shared top toolbar

- Rendered once in the top bar, next to the search box, visible in both views.
- New prop `showSort: boolean` — `true` on the list view, `false` on the map view — hides
  the sort popover button on the map (sort has no visual effect on markers).
- The column-header click-to-sort in `TableHeader` keeps working because it shares the same
  lifted sort state (`toggleSort`).

### 4. `ListingsTable` slims down

Removes:
- its `filters` state and `applyFilters` call,
- its `useSort` call,
- its `propertyTypes` derivation,
- its embedded `<FilterBar>`.

Keeps in its own header (list-view only): refresh-statuses button, batch-delete-unavailable
button, "last checked" text, listing count, keyboard hints.

Now receives via props: the already-filtered-and-sorted `listings`, plus `sort` and
`toggleSort` for the column headers.

### 5. Behavior

- Set filters on the list → switch to map → same subset of pins.
- Change filters on the map → switch back to list → list reflects them.
- Filters and search stack.
- Persistence is in-memory for the session, matching how search behaves today. No URL or
  localStorage persistence (consistent with the current app; out of scope).

## Testing

- `applyFilters` (`src/lib/__tests__/filters.test.ts`) and `filterListings`
  (`src/lib/__tests__/search-listings.test.ts` if present) logic is unchanged — existing
  unit tests stand.
- `FilterBar.test.tsx`: add a `showSort={false}` case asserting the sort button is absent.
- `ListingsTable.test.tsx`: update — it no longer renders the FilterBar or owns filters;
  it renders whatever listings it is given and still handles column-header sorting.
- Add a page-level test asserting that a filter set in one view still constrains the data
  passed to the other view after toggling.

## Out of scope

- Persisting filters to the URL or localStorage.
- Moving refresh/batch-delete/count controls into the shared toolbar.
- Any change to the filter predicates themselves.
