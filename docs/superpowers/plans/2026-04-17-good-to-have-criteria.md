# Good-to-have Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a checklist of "good-to-have" criteria to each listing — checkable in the DetailPanel, with a count column (e.g. `3/5`) in the main table. Adding a new criterion later must only require editing one config file (no DB migration).

**Architecture:** Store criteria as a JSONB column `criteria` on the `listings` table. A single config file `src/lib/criteria.ts` is the source of truth for the list of criteria and a `countChecked` helper. The DetailPanel renders a 2-column grid of checkboxes that writes the full JSON via the existing `onUpdate` flow. The main table adds a virtual `criteria_count` column rendered as `N/M` and sorted via a special case in `useSort`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Vitest, @testing-library/react, Supabase JS

---

## Files

| File | Change |
|------|--------|
| Supabase `listings` table | Add `criteria JSONB DEFAULT '{}'::jsonb` (nullable) |
| `src/types/listing.ts` | Add `criteria: Record<string, boolean> \| null` field |
| `src/lib/criteria.ts` | **Create** — config + `countChecked` helper |
| `src/lib/__tests__/criteria.test.ts` | **Create** — unit tests for `countChecked` |
| `src/lib/columns.ts` | Add virtual `criteria_count` column entry before `commute_school_car` |
| `src/hooks/useListings.ts` | Widen `updateListing` value type to allow JSON object |
| `src/hooks/useSort.ts` | Special-case `criteria_count` to sort by computed count |
| `src/components/TableRow.tsx` | Special-case `criteria_count` to render `N/M` |
| `src/components/DetailPanel.tsx` | Add "Good-to-have criteria" section under quick-links |
| `src/components/__tests__/DetailPanel.test.tsx` | **Create** — checkbox toggling tests |
| `src/components/__tests__/CriteriaCountCell.test.tsx` | **Create** — count rendering tests |

---

### Task 1: Add `criteria` column to the Supabase `listings` table

**Files:**
- Apply migration via Supabase MCP (`mcp__269d13ab-9dbe-4b22-856f-bfe6261f406f__apply_migration`)

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP tool with `project_id = "erklsdwrhscuzkntomxu"` and this SQL:

```sql
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS criteria JSONB DEFAULT '{}'::jsonb;
```

Migration name: `add_criteria_column`.

- [ ] **Step 2: Verify the column exists**

Run via MCP `execute_sql`:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'listings' AND column_name = 'criteria';
```

Expected: one row with `data_type = 'jsonb'` and `column_default = "'{}'::jsonb"`.

- [ ] **Step 3: Commit (no code change yet — note in commit message)**

Nothing to git-commit for this task; the migration lives in Supabase. Move on.

---

### Task 2: Extend the `Listing` type

**Files:**
- Modify: `src/types/listing.ts`

- [ ] **Step 1: Add the `criteria` field**

Open `src/types/listing.ts` and add this line right after `deleted_at: string | null` (last field before the closing brace):

```ts
  criteria: Record<string, boolean> | null
```

Final file should look like:

```ts
export interface Listing {
  id: string
  centris_link: string | null
  broker_link: string | null
  location: string | null
  full_address: string | null
  mls_number: string | null
  property_type: string | null
  price: number | null
  taxes_yearly: number | null
  common_fees_yearly: number | null
  bedrooms: string | null
  liveable_area_sqft: number | null
  price_per_sqft: number | null
  parking: string | null
  year_built: number | null
  hydro_yearly: number | null
  downpayment: number | null
  monthly_mortgage: number | null
  total_monthly_cost: number | null
  commute_school_car: string | null
  commute_pvm_transit: string | null
  notes: string | null
  personal_rating: string | null
  status: string | null
  favorite: boolean
  image_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  criteria: Record<string, boolean> | null
}
```

- [ ] **Step 2: Type-check**

Run: `npm run build` (or `npx tsc --noEmit`).
Expected: build fails at `src/hooks/useListings.ts` because `updateListing`'s value parameter doesn't accept `Record<string, boolean>`. That's expected — Task 4 fixes it. Do NOT commit yet.

(If build passes, no problem either — proceed.)

---

### Task 3: Create `src/lib/criteria.ts` with config and helper, TDD-style

**Files:**
- Create: `src/lib/criteria.ts`
- Create: `src/lib/__tests__/criteria.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `src/lib/__tests__/criteria.test.ts` with this exact content:

```ts
import { describe, it, expect } from 'vitest'
import { criteria, countChecked } from '../criteria'

describe('criteria config', () => {
  it('contains the 5 initial criteria with unique keys', () => {
    expect(criteria.length).toBe(5)
    const keys = criteria.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every criterion has a non-empty label', () => {
    for (const c of criteria) {
      expect(c.label.length).toBeGreaterThan(0)
    }
  })
})

describe('countChecked', () => {
  it('returns 0 when value is null', () => {
    expect(countChecked(null)).toBe(0)
  })

  it('returns 0 when value is undefined', () => {
    expect(countChecked(undefined)).toBe(0)
  })

  it('returns 0 when value is an empty object', () => {
    expect(countChecked({})).toBe(0)
  })

  it('returns the number of true entries that match a known criterion key', () => {
    const value = {
      no_above_neighbors: true,
      school_within_20min: true,
      pvm_within_1h: false,
    }
    expect(countChecked(value)).toBe(2)
  })

  it('ignores keys that are not in the config', () => {
    const value = { unknown_key: true, no_above_neighbors: true }
    expect(countChecked(value)).toBe(1)
  })

  it('ignores entries that are explicitly false', () => {
    const value = {
      no_above_neighbors: false,
      school_within_20min: false,
    }
    expect(countChecked(value)).toBe(0)
  })
})
```

- [ ] **Step 2: Run the tests — they should fail**

Run: `npx vitest run src/lib/__tests__/criteria.test.ts`
Expected: FAIL with "Cannot find module '../criteria'".

- [ ] **Step 3: Create the implementation**

Create `src/lib/criteria.ts` with this exact content:

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

export function countChecked(
  value: Record<string, boolean> | null | undefined
): number {
  if (!value) return 0
  return criteria.reduce((n, c) => n + (value[c.key] ? 1 : 0), 0)
}
```

- [ ] **Step 4: Run the tests — they should pass**

Run: `npx vitest run src/lib/__tests__/criteria.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit Tasks 2 + 3 together**

```bash
git add src/types/listing.ts src/lib/criteria.ts src/lib/__tests__/criteria.test.ts
git commit -m "feat: add criteria config and Listing type field"
```

---

### Task 4: Widen the `update` value type across the prop chain

The same value-union type appears in 4 files (the hook + 3 components that pass `onUpdate` down). All four must be widened together so the type checks.

**Files:**
- Modify: `src/hooks/useListings.ts:47`
- Modify: `src/components/ListingsTable.tsx:14`
- Modify: `src/components/DetailPanel.tsx:12`
- Modify: `src/components/TableRow.tsx:11`

- [ ] **Step 1: Widen the type in each file**

In all four files, find this exact substring:

```
value: string | number | boolean | null
```

and replace it with:

```
value: string | number | boolean | null | Record<string, boolean>
```

There is exactly one occurrence in each of the four files (per `grep` at plan-write time). The line numbers above are the current locations — verify with `grep` if they've shifted.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useListings.ts src/components/ListingsTable.tsx src/components/DetailPanel.tsx src/components/TableRow.tsx
git commit -m "feat: allow JSON object values in update prop chain"
```

---

### Task 5: Add the `criteria_count` virtual column to `columns.ts`

**Files:**
- Modify: `src/lib/columns.ts`

- [ ] **Step 1: Insert the column entry**

Open `src/lib/columns.ts`. Find this line (currently line 43):

```ts
  { key: 'commute_school_car', label: 'School', align: 'right', format: 'duration', editable: true, showInTable: true, showInDetail: true, width: '70px' },
```

Insert this line **immediately above** it:

```ts
  { key: 'criteria_count', label: 'Criteria', align: 'right', format: 'text', editable: false, showInTable: true, showInDetail: false, width: '70px' },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/columns.ts
git commit -m "feat: add criteria_count column definition"
```

---

### Task 6: Special-case `criteria_count` in the table row renderer

**Files:**
- Modify: `src/components/TableRow.tsx`
- Create: `src/components/__tests__/CriteriaCountCell.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/CriteriaCountCell.test.tsx` with this exact content:

```tsx
import { render, screen } from '@testing-library/react'
import { TableRow } from '../TableRow'
import type { Listing } from '@/types/listing'

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'test-id',
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
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

function renderRow(listing: Listing) {
  return render(
    <table>
      <tbody>
        <TableRow
          listing={listing}
          isSelected={false}
          onSelect={() => {}}
          onUpdate={() => {}}
          isCompared={false}
          onToggleCompare={() => {}}
        />
      </tbody>
    </table>
  )
}

describe('Criteria count cell', () => {
  it('renders 0/5 when criteria is null', () => {
    renderRow(makeListing({ criteria: null }))
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('renders 0/5 when criteria is empty object', () => {
    renderRow(makeListing({ criteria: {} }))
    expect(screen.getByText('0/5')).toBeInTheDocument()
  })

  it('renders 3/5 when three criteria are checked', () => {
    renderRow(makeListing({
      criteria: {
        no_above_neighbors: true,
        school_within_20min: true,
        pvm_within_1h: true,
      },
    }))
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })

  it('renders 5/5 when all criteria are checked', () => {
    renderRow(makeListing({
      criteria: {
        no_above_neighbors: true,
        school_within_20min: true,
        pvm_within_1h: true,
        three_bedrooms: true,
        has_garage: true,
      },
    }))
    expect(screen.getByText('5/5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test — it should fail**

Run: `npx vitest run src/components/__tests__/CriteriaCountCell.test.tsx`
Expected: FAIL — text `0/5` (or similar) is not found because TableRow renders criteria_count via the default `EditableCell` path, which would render the raw value.

- [ ] **Step 3: Add the special case in TableRow**

Open `src/components/TableRow.tsx`. At the top of the file, add this import alongside the existing imports:

```ts
import { criteria, countChecked } from '@/lib/criteria'
```

Then, inside `tableColumns.map(col => { ... })`, add this special case **immediately before** the `if (col.key === 'location')` block (so the order is favorite → criteria_count → location → default):

```tsx
        if (col.key === 'criteria_count') {
          const checked = countChecked(listing.criteria)
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-slate-700 text-right"
              style={{ width: col.width, minWidth: col.width }}
            >
              {checked}/{criteria.length}
            </td>
          )
        }
```

- [ ] **Step 4: Run the test — it should pass**

Run: `npx vitest run src/components/__tests__/CriteriaCountCell.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run all tests to check for regressions**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TableRow.tsx src/components/__tests__/CriteriaCountCell.test.tsx
git commit -m "feat: render Criteria count cell in table row"
```

---

### Task 7: Make the `criteria_count` column sortable

**Files:**
- Modify: `src/hooks/useSort.ts`

- [ ] **Step 1: Update the sort logic**

Open `src/hooks/useSort.ts`. At the top, add this import alongside the existing import:

```ts
import { countChecked } from '@/lib/criteria'
```

Then replace the entire `sorted` `useMemo` block (lines 24–43) with:

```ts
  const sorted = useMemo(() => {
    if (!sort.column || !sort.direction) return listings

    return [...listings].sort((a, b) => {
      let aVal: unknown
      let bVal: unknown

      if (sort.column === 'criteria_count') {
        aVal = countChecked(a.criteria)
        bVal = countChecked(b.criteria)
      } else {
        aVal = a[sort.column as keyof Listing]
        bVal = b[sort.column as keyof Listing]
      }

      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal))
      }

      return sort.direction === 'desc' ? -comparison : comparison
    })
  }, [listings, sort])
```

- [ ] **Step 2: Type-check and run tests**

Run: `npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSort.ts
git commit -m "feat: sort table by criteria_count column"
```

---

### Task 8: Add the "Good-to-have criteria" section to DetailPanel

**Files:**
- Modify: `src/components/DetailPanel.tsx`
- Create: `src/components/__tests__/DetailPanel.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/DetailPanel.test.tsx` with this exact content:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { DetailPanel } from '../DetailPanel'
import type { Listing } from '@/types/listing'

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'test-id',
    centris_link: null,
    broker_link: null,
    location: 'Test Location',
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
    created_at: '2026-04-17T00:00:00Z',
    updated_at: '2026-04-17T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

describe('DetailPanel — Good-to-have criteria section', () => {
  it('renders the section header', () => {
    render(
      <DetailPanel
        listing={makeListing()}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByText(/Good-to-have criteria/i)).toBeInTheDocument()
  })

  it('renders all 5 criteria labels as checkboxes', () => {
    render(
      <DetailPanel
        listing={makeListing()}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByLabelText('No above neighbors')).toBeInTheDocument()
    expect(screen.getByLabelText('<20 min from school')).toBeInTheDocument()
    expect(screen.getByLabelText('<1 hour from PVM')).toBeInTheDocument()
    expect(screen.getByLabelText('3 bedrooms')).toBeInTheDocument()
    expect(screen.getByLabelText('At least 1 garage')).toBeInTheDocument()
  })

  it('shows checkboxes as checked based on the criteria object', () => {
    render(
      <DetailPanel
        listing={makeListing({ criteria: { no_above_neighbors: true } })}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByLabelText('No above neighbors')).toBeChecked()
    expect(screen.getByLabelText('3 bedrooms')).not.toBeChecked()
  })

  it('treats null criteria as all unchecked', () => {
    render(
      <DetailPanel
        listing={makeListing({ criteria: null })}
        onClose={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    )
    expect(screen.getByLabelText('No above neighbors')).not.toBeChecked()
  })

  it('calls onUpdate with the merged criteria object when a checkbox is toggled on', () => {
    const onUpdate = vi.fn()
    render(
      <DetailPanel
        listing={makeListing({ criteria: { school_within_20min: true } })}
        onClose={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('No above neighbors'))
    expect(onUpdate).toHaveBeenCalledWith('test-id', 'criteria', {
      school_within_20min: true,
      no_above_neighbors: true,
    })
  })

  it('calls onUpdate with the criterion set to false when a checked box is toggled off', () => {
    const onUpdate = vi.fn()
    render(
      <DetailPanel
        listing={makeListing({ criteria: { no_above_neighbors: true } })}
        onClose={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    )
    fireEvent.click(screen.getByLabelText('No above neighbors'))
    expect(onUpdate).toHaveBeenCalledWith('test-id', 'criteria', {
      no_above_neighbors: false,
    })
  })
})
```

- [ ] **Step 2: Run the tests — they should fail**

Run: `npx vitest run src/components/__tests__/DetailPanel.test.tsx`
Expected: FAIL — "Good-to-have criteria" header not found.

- [ ] **Step 3: Add the criteria section to DetailPanel**

Open `src/components/DetailPanel.tsx`. At the top, add this import alongside the existing imports:

```ts
import { criteria } from '@/lib/criteria'
```

Find the closing `</div>` of the "Quick Links" wrapper (currently line 68: `</div>` after the broker_link block). **Immediately after** that closing `</div>`, insert this new section:

```tsx
        {/* Good-to-have criteria */}
        <div className="mb-5">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">
            Good-to-have criteria
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {criteria.map(c => {
              const checked = listing.criteria?.[c.key] === true
              return (
                <label key={c.key} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = { ...(listing.criteria ?? {}), [c.key]: !checked }
                      onUpdate(listing.id, 'criteria', next)
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{c.label}</span>
                </label>
              )
            })}
          </div>
        </div>
```

- [ ] **Step 4: Run the DetailPanel tests — they should pass**

Run: `npx vitest run src/components/__tests__/DetailPanel.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run all tests to check for regressions**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/DetailPanel.tsx src/components/__tests__/DetailPanel.test.tsx
git commit -m "feat: add Good-to-have criteria section in DetailPanel"
```

---

### Task 9: Manual verification in the browser

**Files:** none — this is a verification task.

- [ ] **Step 1: Start the dev server (if not already running)**

Use the preview tool: `preview_start`.

- [ ] **Step 2: Open a listing's detail panel**

Click on any row in the main table. The DetailPanel should slide in on the right.

- [ ] **Step 3: Verify the new section appears**

Confirm:
- A section labeled "Good-to-have criteria" appears between the Centris/Broker links and the listing image.
- The 5 checkboxes are arranged in a 2-column grid with the correct labels.
- Initially all 5 checkboxes are unchecked (assuming this is an existing listing with `criteria = null`).

- [ ] **Step 4: Toggle a checkbox and verify persistence**

- Check "No above neighbors". Watch the table — the row's "Criteria" column should change from `0/5` to `1/5`.
- Check 2 more boxes. The count should now read `3/5`.
- Reload the page (`preview_eval: window.location.reload()`).
- Re-open the same listing — the same 3 boxes should still be checked.

- [ ] **Step 5: Verify sorting works**

- Click the "Criteria" column header in the main table. Rows should sort ascending by checked count.
- Click again — they should sort descending.

- [ ] **Step 6: Verify the column is positioned correctly**

The "Criteria" header should appear immediately to the left of "School".

- [ ] **Step 7: Capture proof**

Use `preview_screenshot` to take a screenshot showing both the DetailPanel section (with some checked) and the table column with the count visible. Share with the user.

---

## Out of scope (per spec)

- Filtering / sorting by individual criteria.
- Per-criterion weights or scoring.
- Per-user criteria.
- Hiding/reordering criteria from the UI without code changes.
