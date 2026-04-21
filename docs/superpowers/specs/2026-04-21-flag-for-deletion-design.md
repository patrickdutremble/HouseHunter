# Flag Listings for Deletion — Design

**Date:** 2026-04-21
**Status:** Approved

## Problem

HouseHunter is used by two people (Patrick and his girlfriend). Either user may want to remove a listing, but deletion should be a joint decision. Today, the only options are keep or soft-delete — there's no way to mark "I want to discuss removing this."

## Goal

Let a user flag a listing as a candidate for deletion, visually highlight flagged rows, and filter the table by flag state — without altering the existing soft-delete flow.

## Non-Goals

- Map marker styling for flagged listings
- Bulk flag/unflag actions
- A separate `/flagged` page analogous to `/trash`
- Auto-clearing the flag on any action (soft-delete, restore, price change, etc.)
- Keyboard shortcut for flagging
- Shared/per-user flag attribution (both users share a single `flagged_for_deletion` state)

## Data Model

Add one column to the `listings` table in Supabase (project `erklsdwrhscuzkntomxu`):

```sql
ALTER TABLE listings
  ADD COLUMN flagged_for_deletion boolean NOT NULL DEFAULT false;
```

Rationale: mirrors the existing `favorite` boolean column. Orthogonal to `deleted_at` — a listing can be flagged without being trashed. If a flagged listing is later soft-deleted, the flag is preserved (no special handling).

Update `Listing` in `src/types/listing.ts`:

```ts
flagged_for_deletion: boolean
```

Existing `select('*')` queries pick up the new field automatically.

## UI Components

### FlagButton (new)

New file: `src/components/FlagButton.tsx`, modeled exactly on `FavoriteButton.tsx`.

- Icon: red "✕"
- Size/padding: identical to `FavoriteButton`
- Unflagged state: faint outline X, slate on idle, red on hover
- Flagged state: filled red X, always red
- Tooltip: "Flag for deletion" / "Unflag" (mirrors the favorite button's `title` attribute)
- Props: `value: boolean`, `onToggle: () => void`
- Click behavior: same optimistic-update pattern as the favorite button

### TableRow integration

Place the `FlagButton` immediately to the right of `FavoriteButton` in the existing favorite column cell of `src/components/TableRow.tsx`. No new column — both buttons share the existing action cell.

Row background precedence (updating `src/components/TableRow.tsx:70`):

1. Selected (blue `bg-blue-50`) — highest
2. Flagged (`bg-red-50`, hover `bg-red-100`)
3. Favorite (amber `bg-amber-50`, hover `bg-amber-100`)
4. Default (`hover:bg-slate-50`)

The favorite star itself remains amber on a flagged row — only the row background switches to red. This matches the user's stated preference when both states are active.

### FilterBar — three-state toggle

In `src/components/FilterBar.tsx`, add a segmented control next to the existing Favorites toggle:

```
[ All  |  Flagged only  |  Hide flagged ]
```

- Default: `All`
- `Flagged only` — red tint when active (`bg-red-50 border-red-300 text-red-700`)
- `Hide flagged` — neutral slate tint when active

Extend the `Filters` interface:

```ts
export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: 'all' | 'only' | 'hide'
}
```

Default value: `flagStatus: 'all'`. `EMPTY_FILTERS` updated accordingly. The `hasActiveFilters` check includes `flagStatus !== 'all'`. Clear button resets it to `'all'`.

Interaction with Favorites filter: the two are independent and compose via intersection. E.g., `favoritesOnly = true` + `flagStatus = 'only'` → listings that are both favorited *and* flagged.

## Data Flow

No new API routes, no new hooks.

1. User clicks `FlagButton` in a row.
2. Local optimistic update via the existing `onUpdate(id, 'flagged_for_deletion', next)` callback plumbed from `ListingsTable` → `TableRow`.
3. Supabase `update({ flagged_for_deletion: next }).eq('id', id)`.
4. On error, revert local state (same error path as favorites).

Filtering happens in the same location where `favoritesOnly` is currently applied (in the consumer of `useListings`, matching the existing pattern — no new abstraction).

## Testing

- **Unit test** for the filter predicate: `flagStatus` × `flagged_for_deletion` → included/excluded. Added alongside existing filter tests in `src/lib/__tests__` or wherever the current filter tests live.
- **Component test** for `FlagButton`: toggles visual state, invokes `onToggle`. Parallel to any existing favorite button test.
- Skip E2E for this feature (matches the lightweight testing convention used for favorites).

## Open Questions

None. Design approved in conversation on 2026-04-21.

## Migration / Rollout

1. Run the `ALTER TABLE` migration on the production Supabase project.
2. Deploy frontend changes.
3. No data backfill needed — default `false` is correct for all existing rows.
