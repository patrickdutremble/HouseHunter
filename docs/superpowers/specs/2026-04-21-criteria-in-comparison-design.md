# Good-to-have Criteria in Comparison Sheets

## Goal

Show the 5 good-to-have criteria (from `src/lib/criteria.ts`) in each listing's card on the comparison page (`/compare`), with the same editable checkbox behavior as the detail panel, plus a "Criteria met" summary row. Apply the green "best" highlight to listings that stand out on each row.

## Behavior

**Placement.** A new section at the top of each listing's card, just below the location/Centris link header and above the existing fields list.

**Rows.** The section contains 6 rows:

1. "Criteria met: X / 5" — summary row showing how many of the 5 criteria are checked for this listing.
2. One row per criterion (5 total), in the order defined in `criteria.ts`. Each row shows the label on the left and an editable checkbox on the right.

**Styling.** Rows match the existing field-row styling: same padding, same label typography (uppercase, tracking-wide, slate-400), same row divider.

**Editing.** Toggling a checkbox persists to Supabase immediately via an update handler (new on this page — comparison is currently read-only). Local state holds the pending value so the UI updates without waiting for the round-trip, mirroring the detail panel's pattern.

**Best-value highlight.** The green highlight is applied:

- **On the summary row**: to the listing(s) tied for the highest count of checked criteria.
- **On each individual criterion row**: to the listing(s) that have that criterion checked, when not all listings have it checked. Same "best = stands out" semantics used by other fields.

As with the existing `getBestValues` logic, nothing is highlighted when fewer than 2 listings are compared or when all listings are tied.

## Implementation notes

### `src/lib/comparison.ts`

Extend `getBestValues` so the returned map includes:

- `criteria_count: Set<string>` — listings tied for the highest count of checked criteria.
- One entry per criterion key (e.g. `no_above_neighbors: Set<string>`) — listings that have that criterion checked, only when at least one other listing does not.

Use the existing `findBest` helper where it fits; for per-criterion sets, use a small dedicated helper since the "don't highlight when all tied" rule is specific.

The `BestMap` type grows accordingly. All new entries are `Set<string>`.

### `src/app/compare/page.tsx`

1. Add `criteria` to the imports from `@/lib/criteria`.
2. Add an `onUpdateCriteria(id, next)` handler that:
   - Updates local `listings` state optimistically.
   - Writes `{ criteria: next }` to Supabase for that listing id.
   - Logs errors to the console (matching the existing fetch error pattern).
3. Render the new section at the top of each card, before the existing `compareFields.map` block.
4. The summary row uses the same "best" styling path as other rows when `bestValues.criteria_count.has(listing.id)` is true.
5. Each criterion row uses its own entry in `bestValues` for the highlight check.

### No schema change

The `listings.criteria` column already exists and already stores `Record<string, boolean>`.

## Out of scope

- Reordering or renaming criteria.
- Showing criteria counts on the main table (already handled by `CriteriaCountCell`).
- Offline/conflict handling beyond the existing optimistic-update pattern.
