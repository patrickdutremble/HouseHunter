# Good-to-have Criteria — Design

## Goal

Add a checklist of "good-to-have" criteria to each listing. Patrick checks them off per listing in the DetailPanel. The main table shows a count column (e.g. `3/5`) so he can see at a glance which listings best fit his preferences.

The design must make it trivial to add a new criterion later: one line in a config file, no database migration, no UI changes.

## Initial criteria (5)

1. No above neighbors
2. <20 min from school
3. <1 hour from PVM
4. 3 bedrooms
5. At least 1 garage

## Architecture

### Storage

A single JSONB column `criteria` on the `listings` table.

- Type: `JSONB`, nullable, default `{}`
- Shape: `{ "<criterion_key>": true, ... }`
- A missing key means "unchecked" (so we never need to backfill or migrate when adding criteria)
- Existing rows: `criteria` is `null` → treated as all unchecked → count is `0/N`

### Single source of truth — `src/lib/criteria.ts`

```ts
export interface CriterionDef {
  key: string
  label: string
}

export const criteria: readonly CriterionDef[] = [
  { key: 'no_above_neighbors', label: 'No above neighbors' },
  { key: 'school_within_20min', label: '<20 min from school' },
  { key: 'pvm_within_1h',       label: '<1 hour from PVM' },
  { key: 'three_bedrooms',      label: '3 bedrooms' },
  { key: 'has_garage',          label: 'At least 1 garage' },
] as const

export function countChecked(value: Record<string, boolean> | null | undefined): number {
  if (!value) return 0
  return criteria.reduce((n, c) => n + (value[c.key] ? 1 : 0), 0)
}
```

To add a criterion later: append one line. Both the DetailPanel checklist and the table column update automatically.

### Type changes — `src/types/listing.ts`

Add one field:

```ts
criteria: Record<string, boolean> | null
```

The existing `onUpdate(id, field, value)` signature widens its `value` union to include `Record<string, boolean>`.

## UI

### DetailPanel section

A new section placed **immediately under the Centris/Broker quick-links row** in `src/components/DetailPanel.tsx`.

- Section header: **"Good-to-have criteria"** (same `text-xs font-medium uppercase tracking-wide` style as other section labels)
- Body: 2-column grid of checkboxes — `grid grid-cols-2 gap-x-4 gap-y-2`
- Each row: `<input type="checkbox">` + label text
- Clicking a checkbox immediately writes the full `criteria` object via `onUpdate(listing.id, 'criteria', newCriteria)`

### Main table column

A new column **"Criteria"** inserted into `src/lib/columns.ts` **right before the `commute_school_car` column**.

- Renders as plain text: `3/5`, `0/5`, etc.
- The denominator is `criteria.length` from the config (so it changes automatically when criteria are added/removed)
- Read-only in the table (editing happens in DetailPanel only)
- Sortable by N (number checked) — same sort behavior as other numeric columns

## Data flow

```
User clicks checkbox in DetailPanel
  → DetailPanel computes new criteria object: { ...listing.criteria, [key]: checked }
  → onUpdate(listing.id, 'criteria', newCriteria)
  → existing PATCH flow writes JSONB to Supabase
  → optimistic UI update; table count refreshes
```

No new API endpoints, no new state management.

## Implementation outline

1. **DB migration** — add `criteria JSONB` column, default `{}`, nullable.
2. **Types** — extend `Listing` with `criteria` field; widen `onUpdate` value type.
3. **Config** — create `src/lib/criteria.ts` with the 5 criteria and `countChecked` helper.
4. **Columns** — add a `criteria_count` virtual/computed column entry in `src/lib/columns.ts` (showInTable: true, showInDetail: false), inserted before `commute_school_car`. Render uses `countChecked(listing.criteria)`/`criteria.length`.
5. **DetailPanel** — render the new "Good-to-have criteria" section between quick-links and the listing image.
6. **Tests** — unit-test `countChecked`; component tests for DetailPanel checkbox toggling and the table count cell.

## Out of scope

- Filtering / sorting the table by individual criteria (just the count).
- Per-criterion weights or scoring.
- Per-user criteria (single shared list for now).
- Hiding/reordering criteria from the UI without code changes.

## Open question

None — Patrick has approved the approach (storage = JSONB, table position = before School, display = `3/5`).
