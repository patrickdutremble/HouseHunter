# Flag For Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user flag a listing as a candidate for deletion, visually highlight flagged rows, and filter by flag state without touching the existing soft-delete flow.

**Architecture:** Add a single `flagged_for_deletion` boolean column on `listings`, mirroring the existing `favorite` pattern end-to-end. Add a new `FlagButton` component next to the favorite star. Extend the row-background precedence rule so flagged beats favorite. Extend the `Filters` interface with a three-state `flagStatus` field ('all' / 'only' / 'hide') and apply it in the existing `ListingsTable` filter predicate.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind, Supabase (project id `erklsdwrhscuzkntomxu`), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-21-flag-for-deletion-design.md`

---

## File Structure

**New files:**
- `src/components/FlagButton.tsx` — presentational toggle button, mirrors `FavoriteButton.tsx`
- `src/components/__tests__/FlagButton.test.tsx` — unit tests for `FlagButton`

**Modified files:**
- `src/types/listing.ts` — add `flagged_for_deletion: boolean` to the `Listing` interface
- `src/components/TableRow.tsx` — render `FlagButton` in the favorite cell; update row-background precedence
- `src/components/__tests__/TableRow.test.tsx` — extend `BASE` fixture with `flagged_for_deletion: false`; add precedence tests
- `src/components/FilterBar.tsx` — add `flagStatus` field with three-state segmented control
- `src/components/ListingsTable.tsx` — initialize filters default and apply the `flagStatus` predicate

**Database migration:**
- One `ALTER TABLE` via Supabase MCP (see Task 1).

---

## Task 1: Add `flagged_for_deletion` column in Supabase

**Files:**
- Database: `listings` table in Supabase project `erklsdwrhscuzkntomxu` (NEVER `blkfiegqlynchrgncdvr`)

- [ ] **Step 1: Apply migration**

Use the Supabase MCP tool `mcp__269d13ab-9dbe-4b22-856f-bfe6261f406f__apply_migration` with project_id `erklsdwrhscuzkntomxu`, a name like `add_flagged_for_deletion_to_listings`, and this SQL:

```sql
ALTER TABLE public.listings
  ADD COLUMN flagged_for_deletion boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Verify the column exists**

Use `mcp__269d13ab-9dbe-4b22-856f-bfe6261f406f__execute_sql` with project_id `erklsdwrhscuzkntomxu`:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'listings' AND column_name = 'flagged_for_deletion';
```

Expected: one row, `data_type = boolean`, `is_nullable = NO`, `column_default = false`.

- [ ] **Step 3: No commit**

No code changes yet — Task 1 is a DB-only migration.

---

## Task 2: Extend the `Listing` type

**Files:**
- Modify: `src/types/listing.ts`

- [ ] **Step 1: Add the field**

Edit `src/types/listing.ts`. Insert the new line immediately after the `favorite: boolean` line so related fields stay grouped:

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
  status: 'active' | 'unavailable'
  status_checked_at: string | null
  previous_price: number | null
  price_changed_at: string | null
  favorite: boolean
  flagged_for_deletion: boolean
  image_url: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  criteria: Record<string, boolean> | null
}
```

- [ ] **Step 2: Update the TableRow test fixture**

Edit `src/components/__tests__/TableRow.test.tsx`. Find the `BASE: Listing = { ... }` object and add `flagged_for_deletion: false,` right after the `favorite: false,` line. This keeps the fixture valid after the type change so later steps don't have to revisit it.

- [ ] **Step 3: Run type check**

Run: `npm run type-check`
(If the project uses a different type-check script, run `npx tsc --noEmit` instead.)
Expected: no new type errors. If any existing test fixture or call site fails because it's missing `flagged_for_deletion`, add `flagged_for_deletion: false` to it and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/types/listing.ts src/components/__tests__/TableRow.test.tsx
git commit -m "feat(types): add flagged_for_deletion to Listing"
```

---

## Task 3: Build the `FlagButton` component (TDD)

**Files:**
- Create: `src/components/FlagButton.tsx`
- Create: `src/components/__tests__/FlagButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/FlagButton.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FlagButton } from '../FlagButton'

describe('FlagButton', () => {
  it('shows "Flag for deletion" title when unflagged', () => {
    render(<FlagButton value={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Flag for deletion')
  })

  it('shows "Unflag" title when flagged', () => {
    render(<FlagButton value={true} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('title', 'Unflag')
  })

  it('sets aria-pressed to reflect value', () => {
    const { rerender } = render(<FlagButton value={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    rerender(<FlagButton value={true} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onToggle when clicked', async () => {
    const onToggle = vi.fn()
    render(<FlagButton value={false} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('applies red color classes when flagged', () => {
    render(<FlagButton value={true} onToggle={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn.className).toMatch(/text-red-/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/FlagButton.test.tsx`
Expected: all FAIL with "Cannot find module '../FlagButton'" (or similar).

- [ ] **Step 3: Implement `FlagButton`**

Create `src/components/FlagButton.tsx`:

```tsx
'use client'

interface FlagButtonProps {
  value: boolean
  onToggle: () => void
  size?: number
}

export function FlagButton({ value, onToggle, size = 18 }: FlagButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={value ? 'Unflag' : 'Flag for deletion'}
      aria-pressed={value}
      className={`
        inline-flex items-center justify-center rounded transition-colors
        ${value ? 'text-red-500 hover:text-red-600' : 'text-slate-300 hover:text-red-400'}
      `}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={value ? 2.5 : 1.75}
        strokeLinecap="round"
      >
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </button>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/FlagButton.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FlagButton.tsx src/components/__tests__/FlagButton.test.tsx
git commit -m "feat(ui): add FlagButton component"
```

---

## Task 4: Wire `FlagButton` into `TableRow` with correct row-background precedence (TDD)

**Files:**
- Modify: `src/components/TableRow.tsx`
- Modify: `src/components/__tests__/TableRow.test.tsx`

### Context

`TableRow.tsx` has a single cell for `col.key === 'favorite'` (currently at lines ~90–104) that renders `<FavoriteButton>`. We will render both buttons in that same cell so no table column is added.

The current row-background rule is at `src/components/TableRow.tsx:70`:

```tsx
${isSelected ? 'bg-blue-50 border-blue-200' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
```

New precedence (highest wins): selected → flagged → favorite → default.

- [ ] **Step 1: Add failing precedence tests to `TableRow.test.tsx`**

Open `src/components/__tests__/TableRow.test.tsx`. Add these test cases inside the existing `describe` block (or at the end of the file if tests are declared at top level). Each test uses the existing `renderRow` helper and the `BASE` fixture:

```tsx
it('applies red background when flagged but not selected', () => {
  const { container } = renderRow({ ...BASE, flagged_for_deletion: true })
  const tr = container.querySelector('tr')!
  expect(tr.className).toMatch(/bg-red-50/)
  expect(tr.className).not.toMatch(/bg-amber-50/)
})

it('flagged beats favorite for row background', () => {
  const { container } = renderRow({
    ...BASE,
    favorite: true,
    flagged_for_deletion: true,
  })
  const tr = container.querySelector('tr')!
  expect(tr.className).toMatch(/bg-red-50/)
  expect(tr.className).not.toMatch(/bg-amber-50/)
})

it('selected beats flagged for row background', () => {
  const { container } = renderRow(
    { ...BASE, flagged_for_deletion: true },
    { isSelected: true },
  )
  const tr = container.querySelector('tr')!
  expect(tr.className).toMatch(/bg-blue-50/)
  expect(tr.className).not.toMatch(/bg-red-50/)
})

it('renders a flag button in the favorite cell', () => {
  const { container } = renderRow({ ...BASE, flagged_for_deletion: false })
  const flagBtn = container.querySelector('button[title="Flag for deletion"]')
  expect(flagBtn).not.toBeNull()
})

it('flag button shows unflag title when flagged', () => {
  const { container } = renderRow({ ...BASE, flagged_for_deletion: true })
  const flagBtn = container.querySelector('button[title="Unflag"]')
  expect(flagBtn).not.toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/TableRow.test.tsx`
Expected: the five new tests FAIL. First three fail because the row still uses the old precedence; last two fail because no flag button is rendered yet.

- [ ] **Step 3: Import `FlagButton` in `TableRow.tsx`**

Edit `src/components/TableRow.tsx`. Add the import next to the existing `FavoriteButton` import:

```tsx
import { FavoriteButton } from './FavoriteButton'
import { FlagButton } from './FlagButton'
```

- [ ] **Step 4: Update row-background precedence**

In `src/components/TableRow.tsx`, replace the line at ~70:

Old:
```tsx
${isSelected ? 'bg-blue-50 border-blue-200' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
```

New:
```tsx
${isSelected ? 'bg-blue-50 border-blue-200' : listing.flagged_for_deletion ? 'bg-red-50 hover:bg-red-100' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
```

- [ ] **Step 5: Render `FlagButton` in the favorite cell**

In `src/components/TableRow.tsx`, find the block for `col.key === 'favorite'` (currently around lines 90–104). Replace the inner `<FavoriteButton>` with both buttons wrapped in a flex row:

Old:
```tsx
if (col.key === 'favorite') {
  return (
    <td
      key={col.key}
      className="px-3 py-2.5 text-sm text-center"
      style={{ width: col.width, minWidth: col.width }}
      onClick={e => e.stopPropagation()}
    >
      <FavoriteButton
        value={listing.favorite}
        onToggle={() => onUpdate(listing.id, 'favorite', !listing.favorite)}
      />
    </td>
  )
}
```

New:
```tsx
if (col.key === 'favorite') {
  return (
    <td
      key={col.key}
      className="px-3 py-2.5 text-sm text-center"
      style={{ width: col.width, minWidth: col.width }}
      onClick={e => e.stopPropagation()}
    >
      <div className="inline-flex items-center gap-1">
        <FavoriteButton
          value={listing.favorite}
          onToggle={() => onUpdate(listing.id, 'favorite', !listing.favorite)}
        />
        <FlagButton
          value={listing.flagged_for_deletion}
          onToggle={() => onUpdate(listing.id, 'flagged_for_deletion', !listing.flagged_for_deletion)}
        />
      </div>
    </td>
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/TableRow.test.tsx`
Expected: all tests PASS (new and existing).

- [ ] **Step 7: Commit**

```bash
git add src/components/TableRow.tsx src/components/__tests__/TableRow.test.tsx
git commit -m "feat(table): render FlagButton and tint flagged rows red"
```

---

## Task 5: Extend the `Filters` interface with `flagStatus` and add the three-state toggle in `FilterBar` (TDD)

**Files:**
- Modify: `src/components/FilterBar.tsx`
- Create: `src/components/__tests__/FilterBar.test.tsx`

### Context

`FilterBar` currently owns the filter state locally and calls `onFilterChange` on every update. The default shape is `EMPTY_FILTERS` defined at the top of the file. We extend the interface with `flagStatus: 'all' | 'only' | 'hide'`, default `'all'`. `hasActiveFilters` must include `flagStatus !== 'all'`.

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/FilterBar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilterBar } from '../FilterBar'

describe('FilterBar flag status control', () => {
  it('renders three flag-status options', () => {
    render(<FilterBar propertyTypes={[]} onFilterChange={() => {}} />)
    expect(screen.getByRole('button', { name: /^All$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Flagged only/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hide flagged/ })).toBeInTheDocument()
  })

  it('defaults to flagStatus="all"', () => {
    const onChange = vi.fn()
    render(<FilterBar propertyTypes={[]} onFilterChange={onChange} />)
    // "All" should carry the active styling (red-free, just checking aria-pressed true)
    expect(screen.getByRole('button', { name: /^All$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Flagged only/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Hide flagged/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onFilterChange with flagStatus="only" when Flagged only is clicked', async () => {
    const onChange = vi.fn()
    render(<FilterBar propertyTypes={[]} onFilterChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Flagged only/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flagStatus: 'only' }))
  })

  it('calls onFilterChange with flagStatus="hide" when Hide flagged is clicked', async () => {
    const onChange = vi.fn()
    render(<FilterBar propertyTypes={[]} onFilterChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: /Hide flagged/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flagStatus: 'hide' }))
  })

  it('Clear button resets flagStatus to "all"', async () => {
    const onChange = vi.fn()
    render(<FilterBar propertyTypes={[]} onFilterChange={onChange} />)
    // Open the filter panel (needed for Clear to appear)
    await userEvent.click(screen.getByRole('button', { name: /^Filters/ }))
    await userEvent.click(screen.getByRole('button', { name: /Flagged only/ }))
    await userEvent.click(screen.getByRole('button', { name: /^Clear$/ }))
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ flagStatus: 'all' }))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/FilterBar.test.tsx`
Expected: all FAIL (buttons don't exist yet).

- [ ] **Step 3: Update `FilterBar.tsx`**

Replace the full contents of `src/components/FilterBar.tsx` with:

```tsx
'use client'

import { useState } from 'react'

export type FlagStatus = 'all' | 'only' | 'hide'

export interface Filters {
  type: string
  minPrice: string
  maxPrice: string
  favoritesOnly: boolean
  flagStatus: FlagStatus
}

const EMPTY_FILTERS: Filters = {
  type: '',
  minPrice: '',
  maxPrice: '',
  favoritesOnly: false,
  flagStatus: 'all',
}

interface FilterBarProps {
  propertyTypes: string[]
  onFilterChange: (filters: Filters) => void
}

export function FilterBar({ propertyTypes, onFilterChange }: FilterBarProps) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [open, setOpen] = useState(false)

  const update = <K extends keyof Filters>(field: K, value: Filters[K]) => {
    const next = { ...filters, [field]: value }
    setFilters(next)
    onFilterChange(next)
  }

  const clear = () => {
    setFilters(EMPTY_FILTERS)
    onFilterChange(EMPTY_FILTERS)
  }

  const hasActiveFilters =
    filters.type !== '' ||
    filters.minPrice !== '' ||
    filters.maxPrice !== '' ||
    filters.favoritesOnly ||
    filters.flagStatus !== 'all'

  const flagBtnBase = 'px-3 py-1.5 text-sm border transition-colors'
  const flagBtnActive = 'bg-red-50 border-red-300 text-red-700'
  const flagBtnHideActive = 'bg-slate-100 border-slate-300 text-slate-700'
  const flagBtnAllActive = 'bg-white border-slate-300 text-slate-700'
  const flagBtnIdle = 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setOpen(!open)}
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${hasActiveFilters
            ? 'bg-blue-50 border-blue-300 text-blue-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }
        `}
      >
        Filters{hasActiveFilters ? ' \u25cf' : ''}
      </button>

      <button
        onClick={() => update('favoritesOnly', !filters.favoritesOnly)}
        aria-pressed={filters.favoritesOnly}
        title={filters.favoritesOnly ? 'Showing favorites only' : 'Show favorites only'}
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${filters.favoritesOnly
            ? 'bg-amber-50 border-amber-300 text-amber-700'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          }
        `}
      >
        {filters.favoritesOnly ? '\u2605' : '\u2606'} Favorites
      </button>

      <div className="inline-flex rounded-lg overflow-hidden border border-slate-200">
        <button
          type="button"
          onClick={() => update('flagStatus', 'all')}
          aria-pressed={filters.flagStatus === 'all'}
          className={`${flagBtnBase} border-0 border-r border-slate-200 ${filters.flagStatus === 'all' ? flagBtnAllActive : flagBtnIdle}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => update('flagStatus', 'only')}
          aria-pressed={filters.flagStatus === 'only'}
          className={`${flagBtnBase} border-0 border-r border-slate-200 ${filters.flagStatus === 'only' ? flagBtnActive : flagBtnIdle}`}
        >
          Flagged only
        </button>
        <button
          type="button"
          onClick={() => update('flagStatus', 'hide')}
          aria-pressed={filters.flagStatus === 'hide'}
          className={`${flagBtnBase} border-0 ${filters.flagStatus === 'hide' ? flagBtnHideActive : flagBtnIdle}`}
        >
          Hide flagged
        </button>
      </div>

      {open && (
        <div className="flex items-center gap-3">
          <select
            value={filters.type}
            onChange={e => update('type', e.target.value)}
            className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
          >
            <option value="">All types</option>
            {propertyTypes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Min $"
            value={filters.minPrice}
            onChange={e => update('minPrice', e.target.value)}
            className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />

          <input
            type="text"
            placeholder="Max $"
            value={filters.maxPrice}
            onChange={e => update('maxPrice', e.target.value)}
            className="w-24 px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          />

          {hasActiveFilters && (
            <button
              onClick={clear}
              className="px-2 py-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/FilterBar.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/FilterBar.tsx src/components/__tests__/FilterBar.test.tsx
git commit -m "feat(filters): add flag-status three-state toggle"
```

---

## Task 6: Apply the `flagStatus` predicate in `ListingsTable` (TDD)

**Files:**
- Modify: `src/components/ListingsTable.tsx`
- Create: `src/components/__tests__/ListingsTable.test.tsx`

### Context

`ListingsTable.tsx` owns `filters` state and computes `filtered` via a `useMemo`. The initial state literal (line ~24) must include the new `flagStatus` default. The filter predicate must handle the three cases.

- [ ] **Step 1: Write failing tests**

Create `src/components/__tests__/ListingsTable.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ListingsTable } from '../ListingsTable'
import type { Listing } from '@/types/listing'

const BASE: Listing = {
  id: '1',
  centris_link: null,
  broker_link: null,
  location: 'Laval',
  full_address: null,
  mls_number: null,
  property_type: 'Condo',
  price: 100000,
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
  status: 'active',
  status_checked_at: null,
  previous_price: null,
  price_changed_at: null,
  favorite: false,
  flagged_for_deletion: false,
  image_url: null,
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

beforeAll(() => {
  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = vi.fn()
  }
})

function flagged(id: string): Listing {
  return { ...BASE, id, flagged_for_deletion: true, location: `F-${id}` }
}
function unflagged(id: string): Listing {
  return { ...BASE, id, flagged_for_deletion: false, location: `U-${id}` }
}

function renderTable(listings: Listing[]) {
  return render(
    <ListingsTable
      listings={listings}
      selectedId={null}
      onSelect={() => {}}
      onUpdate={() => {}}
      compareIds={new Set()}
      onToggleCompare={() => {}}
    />,
  )
}

describe('ListingsTable flagStatus filtering', () => {
  it('shows all listings by default', () => {
    renderTable([flagged('a'), unflagged('b')])
    expect(screen.getByText('F-a')).toBeInTheDocument()
    expect(screen.getByText('U-b')).toBeInTheDocument()
  })

  it('shows only flagged listings when Flagged only is active', async () => {
    renderTable([flagged('a'), unflagged('b')])
    await userEvent.click(screen.getByRole('button', { name: /Flagged only/ }))
    expect(screen.getByText('F-a')).toBeInTheDocument()
    expect(screen.queryByText('U-b')).not.toBeInTheDocument()
  })

  it('hides flagged listings when Hide flagged is active', async () => {
    renderTable([flagged('a'), unflagged('b')])
    await userEvent.click(screen.getByRole('button', { name: /Hide flagged/ }))
    expect(screen.queryByText('F-a')).not.toBeInTheDocument()
    expect(screen.getByText('U-b')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/ListingsTable.test.tsx`
Expected: the "Flagged only" and "Hide flagged" tests FAIL because the default filter state is missing `flagStatus` and the predicate doesn't apply it. The "shows all listings by default" test may pass coincidentally.

- [ ] **Step 3: Update `ListingsTable.tsx`**

Edit `src/components/ListingsTable.tsx`. Two changes:

(a) Update the initial filters state (currently on line ~24) from:
```tsx
const [filters, setFilters] = useState<Filters>({ type: '', minPrice: '', maxPrice: '', favoritesOnly: false })
```
to:
```tsx
const [filters, setFilters] = useState<Filters>({ type: '', minPrice: '', maxPrice: '', favoritesOnly: false, flagStatus: 'all' })
```

(b) Extend the `filter` predicate inside the `useMemo` (currently lines ~27–41). Add the `flagStatus` branch at the top:

```tsx
const filtered = useMemo(() => {
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
}, [listings, filters])
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/ListingsTable.test.tsx`
Expected: all PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/ListingsTable.tsx src/components/__tests__/ListingsTable.test.tsx
git commit -m "feat(filters): apply flagStatus predicate in ListingsTable"
```

---

## Task 7: End-to-end smoke check in the browser

**Files:**
- None (manual verification only)

- [ ] **Step 1: Start the dev server**

If using the preview tool, call `preview_start`. Otherwise: `npm run dev`. Open the app in the browser.

- [ ] **Step 2: Flag a listing**

Click the red "✕" next to any listing's favorite star. Verify:
- The button fills red
- The row gains a faint red background
- Refreshing the page keeps the flag

- [ ] **Step 3: Verify the three-state filter**

- Click "Flagged only" → only the flagged row appears
- Click "Hide flagged" → the flagged row disappears
- Click "All" → everything is shown again

- [ ] **Step 4: Verify precedence**

- Favorite + flag the same listing → row stays red (not amber); star stays amber
- Click the row to select it → row shows blue (selected beats red)

- [ ] **Step 5: Verify Supabase persistence**

Use `mcp__269d13ab-9dbe-4b22-856f-bfe6261f406f__execute_sql` with project_id `erklsdwrhscuzkntomxu`:
```sql
SELECT id, flagged_for_deletion FROM public.listings WHERE flagged_for_deletion = true;
```
Expected: the listing you flagged in Step 2 appears in the result.

- [ ] **Step 6: No commit**

No code changes in this task.

---

## Summary of Commits

1. `feat(types): add flagged_for_deletion to Listing`
2. `feat(ui): add FlagButton component`
3. `feat(table): render FlagButton and tint flagged rows red`
4. `feat(filters): add flag-status three-state toggle`
5. `feat(filters): apply flagStatus predicate in ListingsTable`

DB migration is applied directly against Supabase (no code commit).
