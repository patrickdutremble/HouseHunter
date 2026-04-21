# Listing Status / Staleness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect when Centris listings go unavailable or change price, and surface both in the UI so dead listings don't muddy comparisons.

**Architecture:** Daily Vercel Cron + manual button both call a shared helper that batch-fetches each active listing's Centris page, detects an "unavailable" banner, and writes status/price changes back to Supabase. The UI badges + dims unavailable rows/markers and shows a price-change badge when `price_changed_at` is recent.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase (Postgres), Vitest, Tailwind, Vercel Cron, Cheerio (HTML parsing).

**Spec:** [docs/superpowers/specs/2026-04-21-listing-status-staleness-design.md](../specs/2026-04-21-listing-status-staleness-design.md)

---

## Notes for the implementer

- The repo already has a `status: string | null` field on `Listing` that is unused. We will repurpose it to hold `'active' | 'unavailable'`. Existing rows may have `null`, which the migration backfills to `'active'`.
- Supabase project ID: `erklsdwrhscuzkntomxu`. Use the Supabase MCP tool `mcp__269d13ab-9dbe-4b22-856f-bfe6261f406f__apply_migration` for migrations. Do NOT write raw SQL files — use the MCP tool.
- The test runner is `vitest`. Run a single test with `npx vitest run <path>`.
- Always run `npm run lint` and `npm run build` before the final commit of a task that changes TS/TSX.
- Keep commits small and frequent (one per task).

---

## File Structure

**Create:**
- `src/lib/status-check.ts` — pure function that fetches a Centris URL and returns `{ status: 'active', price } | { status: 'unavailable' }`.
- `src/lib/__tests__/status-check.test.ts` — unit tests with fixture HTML.
- `src/lib/refresh-statuses.ts` — `refreshAllStatuses(supabase)` helper; batches + updates DB. Shared by cron + manual routes.
- `src/lib/__tests__/refresh-statuses.test.ts` — integration-style tests that stub `checkListingStatus`.
- `src/lib/time-ago.ts` — tiny helper turning a timestamp into `"3h ago"`, `"2d ago"`, etc.
- `src/lib/__tests__/time-ago.test.ts` — unit tests.
- `src/app/api/cron/refresh-statuses/route.ts` — GET, auth via `CRON_SECRET`.
- `src/app/api/refresh-statuses/route.ts` — POST, no extra auth.
- `src/components/RefreshStatusesButton.tsx` — button + spinner + toast.
- `src/components/__tests__/RefreshStatusesButton.test.tsx`.
- `vercel.json` — cron config.

**Modify:**
- `src/types/listing.ts` — add `status_checked_at`, `previous_price`, `price_changed_at`.
- `src/components/TableRow.tsx` — Unavailable pill + row dimming + price-change badge.
- `src/components/ListingMarker.tsx` — dim marker when unavailable.
- `src/app/page.tsx` — mount `<RefreshStatusesButton>` in the filter row, show last-checked text.
- `src/components/__tests__/*.test.tsx` fixtures — add the three new fields (null) to each mock listing so TS still compiles.

---

## Task 1: Database migration

**Files:**
- Apply via Supabase MCP (no local file).
- Test: run the listed `select` after apply.

- [ ] **Step 1: Apply migration**

Call the Supabase MCP migration tool with project `erklsdwrhscuzkntomxu` and this SQL (name the migration `add_listing_status_tracking`):

```sql
-- Backfill existing NULL statuses so the default applies going forward
UPDATE listings SET status = 'active' WHERE status IS NULL;

-- Enforce the two allowed values and the default
ALTER TABLE listings ALTER COLUMN status SET DEFAULT 'active';
ALTER TABLE listings ALTER COLUMN status SET NOT NULL;
ALTER TABLE listings ADD CONSTRAINT listings_status_check CHECK (status IN ('active', 'unavailable'));

-- New columns
ALTER TABLE listings ADD COLUMN status_checked_at timestamptz;
ALTER TABLE listings ADD COLUMN previous_price numeric;
ALTER TABLE listings ADD COLUMN price_changed_at timestamptz;
```

- [ ] **Step 2: Verify schema**

Call the Supabase MCP `execute_sql` tool with:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'listings' AND column_name IN ('status', 'status_checked_at', 'previous_price', 'price_changed_at')
ORDER BY column_name;
```

Expected: 4 rows. `status` is `text`, not-nullable, default `'active'::text`. The three others are nullable with no default.

- [ ] **Step 3: Verify backfill**

Run via `execute_sql`:

```sql
SELECT count(*) AS null_statuses FROM listings WHERE status IS NULL;
```

Expected: `0`.

---

## Task 2: Extend the Listing type

**Files:**
- Modify: `src/types/listing.ts`
- Modify: test fixtures in `src/lib/__tests__/comparison.test.ts`, `src/app/compare/__tests__/page.test.tsx`, `src/components/__tests__/ListingPopup.test.tsx`, `src/components/__tests__/CriteriaCountCell.test.tsx`, `src/components/__tests__/DetailPanel.test.tsx` (and any others that use a full `Listing` mock)

- [ ] **Step 1: Update the type**

In `src/types/listing.ts`, replace `status: string | null` and add the three new fields so the interface reads:

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
  image_url: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  criteria: Record<string, boolean> | null
}
```

- [ ] **Step 2: Find all mock Listing fixtures**

Run: `npx vitest run 2>&1 | head -200`
Expected: TypeScript errors in test files that construct a `Listing` without the new fields (e.g., "Property 'status_checked_at' is missing"). Record the failing files.

- [ ] **Step 3: Update each mock**

In every test file that has a `status: null,` line inside a `Listing`-shaped mock, replace that line with the following four lines (same indentation):

```ts
    status: 'active',
    status_checked_at: null,
    previous_price: null,
    price_changed_at: null,
```

Files known to contain such mocks:
- `src/lib/__tests__/comparison.test.ts`
- `src/app/compare/__tests__/page.test.tsx`
- `src/components/__tests__/ListingPopup.test.tsx`
- `src/components/__tests__/CriteriaCountCell.test.tsx`
- `src/components/__tests__/DetailPanel.test.tsx`

Run `grep -rn "status: null" src/` to find any stragglers, and update those too.

- [ ] **Step 4: Verify tests pass**

Run: `npx vitest run`
Expected: all tests pass (no TS errors, no failures).

- [ ] **Step 5: Commit**

```bash
git add src/types/listing.ts src/lib/__tests__ src/components/__tests__ src/app/compare/__tests__
git commit -m "refactor(types): add status/price-change tracking fields to Listing"
```

---

## Task 3: `checkListingStatus` — pure function (TDD)

**Files:**
- Create: `src/lib/status-check.ts`
- Test: `src/lib/__tests__/status-check.test.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/__tests__/status-check.test.ts`:

```ts
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { checkListingStatus } from '../status-check'

const ACTIVE_HTML = `
<!doctype html><html><body>
  <h1>Condo for sale</h1>
  <h2>123 rue Example, Laval</h2>
  <div class="price"><span class="text-nowrap">$499,000</span></div>
</body></html>
`

const UNAVAILABLE_BANNER_HTML = `
<!doctype html><html><body>
  <div class="alert">This property is no longer available. Here are similar listings.</div>
</body></html>
`

interface FakeResponse {
  url: string
  status: number
  ok: boolean
  text: () => Promise<string>
}

function fakeRes(opts: { url?: string; status?: number; body?: string }): FakeResponse {
  const status = opts.status ?? 200
  return {
    url: opts.url ?? 'https://www.centris.ca/en/condo/1',
    status,
    ok: status >= 200 && status < 300,
    text: async () => opts.body ?? '',
  }
}

function stubFetch(res: FakeResponse | (() => Promise<FakeResponse>)) {
  const impl = typeof res === 'function' ? res : async () => res
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('checkListingStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns unavailable when final URL contains listingnotfound=', async () => {
    stubFetch(fakeRes({
      url: 'https://www.centris.ca/en/search?listingnotfound=24767029',
      status: 200,
      body: '<html></html>',
    }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/24767029')
    expect(result).toEqual({ status: 'unavailable' })
  })

  it('returns unavailable when HTML contains "no longer available" (case-insensitive)', async () => {
    stubFetch(fakeRes({ status: 200, body: UNAVAILABLE_BANNER_HTML }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/1')
    expect(result).toEqual({ status: 'unavailable' })
  })

  it('returns unavailable on 404', async () => {
    stubFetch(fakeRes({ status: 404, body: 'Not Found' }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/1')
    expect(result).toEqual({ status: 'unavailable' })
  })

  it('returns active + price for a live listing', async () => {
    stubFetch(fakeRes({ status: 200, body: ACTIVE_HTML }))
    const result = await checkListingStatus('https://www.centris.ca/en/condo/1')
    expect(result).toEqual({ status: 'active', price: 499000 })
  })

  it('throws on non-404 non-2xx response', async () => {
    stubFetch(fakeRes({ status: 503, body: 'Server error' }))
    await expect(checkListingStatus('https://www.centris.ca/en/condo/1')).rejects.toThrow()
  })

  it('throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNRESET') }))
    await expect(checkListingStatus('https://www.centris.ca/en/condo/1')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/status-check.test.ts`
Expected: FAIL — `Cannot find module '../status-check'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/status-check.ts`:

```ts
import * as cheerio from 'cheerio'

export type StatusCheckResult =
  | { status: 'unavailable' }
  | { status: 'active'; price: number | null }

function parsePrice(html: string): number | null {
  const $ = cheerio.load(html)
  const priceText = $('.price span.text-nowrap').first().text() || $('.price span').first().text()
  if (!priceText) return null
  const digits = priceText.replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

export async function checkListingStatus(centrisUrl: string): Promise<StatusCheckResult> {
  const res = await fetch(centrisUrl, { redirect: 'follow' })

  if (res.url && res.url.includes('listingnotfound=')) {
    return { status: 'unavailable' }
  }

  if (res.status === 404) {
    return { status: 'unavailable' }
  }

  if (!res.ok) {
    throw new Error(`Centris returned HTTP ${res.status}`)
  }

  const html = await res.text()

  if (/no longer available/i.test(html)) {
    return { status: 'unavailable' }
  }

  return { status: 'active', price: parsePrice(html) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/status-check.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/status-check.ts src/lib/__tests__/status-check.test.ts
git commit -m "feat(status): add checkListingStatus helper with banner/redirect detection"
```

---

## Task 4: `refreshAllStatuses` — shared helper (TDD)

**Files:**
- Create: `src/lib/refresh-statuses.ts`
- Test: `src/lib/__tests__/refresh-statuses.test.ts`

This helper reads active listings, calls `checkListingStatus` in concurrency-bounded batches, and writes updates back. Tests mock both the Supabase client and `checkListingStatus`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/refresh-statuses.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { refreshAllStatuses } from '../refresh-statuses'
import * as statusCheck from '../status-check'

type Row = {
  id: string
  centris_link: string | null
  price: number | null
  status: string
}

function makeSupabaseStub(rows: Row[]) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = []
  const client = {
    from: (_table: string) => ({
      select: () => ({
        eq: async () => ({ data: rows, error: null }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: async (_col: string, id: string) => {
          updates.push({ id, patch })
          return { error: null }
        },
      }),
    }),
  }
  return { client, updates }
}

describe('refreshAllStatuses', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('marks a listing unavailable and records status_checked_at', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockResolvedValue({ status: 'unavailable' })
    const { client, updates } = makeSupabaseStub([
      { id: 'a', centris_link: 'https://x/1', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 1, priceChanged: 0, errors: 0 })
    expect(updates).toHaveLength(1)
    expect(updates[0].id).toBe('a')
    expect(updates[0].patch.status).toBe('unavailable')
    expect(updates[0].patch.status_checked_at).toBeTypeOf('string')
  })

  it('records a price drop with previous_price and price_changed_at', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockResolvedValue({ status: 'active', price: 90000 })
    const { client, updates } = makeSupabaseStub([
      { id: 'b', centris_link: 'https://x/2', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 0, priceChanged: 1, errors: 0 })
    expect(updates[0].patch).toMatchObject({
      price: 90000,
      previous_price: 100000,
    })
    expect(updates[0].patch.price_changed_at).toBeTypeOf('string')
    expect(updates[0].patch.status_checked_at).toBeTypeOf('string')
  })

  it('only updates status_checked_at when nothing changed', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockResolvedValue({ status: 'active', price: 100000 })
    const { client, updates } = makeSupabaseStub([
      { id: 'c', centris_link: 'https://x/3', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 0, priceChanged: 0, errors: 0 })
    expect(Object.keys(updates[0].patch).sort()).toEqual(['status_checked_at'])
  })

  it('counts errors and does not update the row when checkListingStatus throws', async () => {
    vi.spyOn(statusCheck, 'checkListingStatus').mockRejectedValue(new Error('boom'))
    const { client, updates } = makeSupabaseStub([
      { id: 'd', centris_link: 'https://x/4', price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 1, unavailable: 0, priceChanged: 0, errors: 1 })
    expect(updates).toHaveLength(0)
  })

  it('skips listings with no centris_link', async () => {
    const spy = vi.spyOn(statusCheck, 'checkListingStatus')
    const { client, updates } = makeSupabaseStub([
      { id: 'e', centris_link: null, price: 100000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 0, unavailable: 0, priceChanged: 0, errors: 0 })
    expect(spy).not.toHaveBeenCalled()
    expect(updates).toHaveLength(0)
  })

  it('processes multiple listings', async () => {
    const spy = vi.spyOn(statusCheck, 'checkListingStatus')
    spy.mockImplementation(async (url) => {
      if (url.endsWith('/1')) return { status: 'unavailable' }
      if (url.endsWith('/2')) return { status: 'active', price: 200000 }
      return { status: 'active', price: 300000 }
    })
    const { client, updates } = makeSupabaseStub([
      { id: '1', centris_link: 'https://x/1', price: 100000, status: 'active' },
      { id: '2', centris_link: 'https://x/2', price: 250000, status: 'active' },
      { id: '3', centris_link: 'https://x/3', price: 300000, status: 'active' },
    ])
    const summary = await refreshAllStatuses(client as never)
    expect(summary).toEqual({ checked: 3, unavailable: 1, priceChanged: 1, errors: 0 })
    expect(updates).toHaveLength(3)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/refresh-statuses.test.ts`
Expected: FAIL — `Cannot find module '../refresh-statuses'`.

- [ ] **Step 3: Write implementation**

Create `src/lib/refresh-statuses.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { checkListingStatus } from './status-check'

export interface RefreshSummary {
  checked: number
  unavailable: number
  priceChanged: number
  errors: number
}

interface ActiveRow {
  id: string
  centris_link: string | null
  price: number | null
  status: string
}

const CONCURRENCY = 10

async function runInBatches<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size)
    await Promise.all(chunk.map(fn))
  }
}

export async function refreshAllStatuses(supabase: SupabaseClient): Promise<RefreshSummary> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, centris_link, price, status')
    .eq('status', 'active')

  if (error) throw error

  const rows = (data ?? []) as ActiveRow[]
  const summary: RefreshSummary = { checked: 0, unavailable: 0, priceChanged: 0, errors: 0 }

  await runInBatches(rows, CONCURRENCY, async (row) => {
    if (!row.centris_link) return

    summary.checked++
    const now = new Date().toISOString()

    try {
      const result = await checkListingStatus(row.centris_link)

      if (result.status === 'unavailable') {
        summary.unavailable++
        const { error: updateErr } = await supabase
          .from('listings')
          .update({ status: 'unavailable', status_checked_at: now })
          .eq('id', row.id)
        if (updateErr) throw updateErr
        return
      }

      const newPrice = result.price
      const priceChanged = newPrice !== null && newPrice !== row.price

      if (priceChanged) {
        summary.priceChanged++
        const { error: updateErr } = await supabase
          .from('listings')
          .update({
            price: newPrice,
            previous_price: row.price,
            price_changed_at: now,
            status_checked_at: now,
          })
          .eq('id', row.id)
        if (updateErr) throw updateErr
      } else {
        const { error: updateErr } = await supabase
          .from('listings')
          .update({ status_checked_at: now })
          .eq('id', row.id)
        if (updateErr) throw updateErr
      }
    } catch (err) {
      summary.errors++
      console.error(`[refresh-statuses] failed for listing ${row.id}:`, err)
    }
  })

  return summary
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/refresh-statuses.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/refresh-statuses.ts src/lib/__tests__/refresh-statuses.test.ts
git commit -m "feat(status): add refreshAllStatuses helper for batched re-checks"
```

---

## Task 5: Cron endpoint

**Files:**
- Create: `src/app/api/cron/refresh-statuses/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/cron/refresh-statuses/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAllStatuses } from '@/lib/refresh-statuses'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)
  try {
    const summary = await refreshAllStatuses(supabase)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify env var docs**

Add a note to the repo's env var docs (or `.env.local.example` if present). If no such file exists, skip this step — the env vars will be set directly in Vercel's dashboard.

Run: `ls .env.local.example 2>/dev/null || echo "no example file"`

If the example file exists, append:
```
CRON_SECRET=<generate a random string>
SUPABASE_SERVICE_ROLE_KEY=<get from Supabase dashboard>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: successful build, route appears in output as `ƒ /api/cron/refresh-statuses`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/refresh-statuses
git commit -m "feat(status): add Vercel cron endpoint for daily status refresh"
```

---

## Task 6: Manual refresh endpoint

**Files:**
- Create: `src/app/api/refresh-statuses/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/refresh-statuses/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { refreshAllStatuses } from '@/lib/refresh-statuses'

export const maxDuration = 60

export async function POST() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })
  }

  const supabase = createClient(url, serviceKey)
  try {
    const summary = await refreshAllStatuses(supabase)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/refresh-statuses
git commit -m "feat(status): add manual refresh endpoint"
```

---

## Task 7: Vercel cron config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Write the config**

Create `vercel.json` at repo root:

```json
{
  "crons": [
    { "path": "/api/cron/refresh-statuses", "schedule": "0 9 * * *" }
  ]
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8'))"`
Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore(cron): schedule daily listing status refresh at 09:00 UTC"
```

---

## Task 8: `time-ago` helper (TDD)

**Files:**
- Create: `src/lib/time-ago.ts`
- Test: `src/lib/__tests__/time-ago.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/time-ago.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { timeAgo } from '../time-ago'

const NOW = new Date('2026-04-21T12:00:00Z').getTime()

describe('timeAgo', () => {
  it('returns "just now" for under a minute', () => {
    expect(timeAgo(new Date(NOW - 30_000).toISOString(), NOW)).toBe('just now')
  })
  it('returns minutes', () => {
    expect(timeAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5m ago')
  })
  it('returns hours', () => {
    expect(timeAgo(new Date(NOW - 3 * 60 * 60_000).toISOString(), NOW)).toBe('3h ago')
  })
  it('returns days', () => {
    expect(timeAgo(new Date(NOW - 2 * 24 * 60 * 60_000).toISOString(), NOW)).toBe('2d ago')
  })
  it('returns null for null input', () => {
    expect(timeAgo(null, NOW)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/time-ago.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write implementation**

Create `src/lib/time-ago.ts`:

```ts
export function timeAgo(iso: string | null, now: number = Date.now()): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d ago`
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/__tests__/time-ago.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/time-ago.ts src/lib/__tests__/time-ago.test.ts
git commit -m "feat(util): add timeAgo helper for relative timestamps"
```

---

## Task 9: TableRow — Unavailable pill, dimming, price-change badge

**Files:**
- Modify: `src/components/TableRow.tsx`

- [ ] **Step 1: Read the current file**

Read `src/components/TableRow.tsx` fully before editing — it's the full file you will replace.

- [ ] **Step 2: Update the component**

Replace `src/components/TableRow.tsx` with:

```tsx
import { tableColumns } from '@/lib/columns'
import { criteria, countChecked, deriveCriteria } from '@/lib/criteria'
import { EditableCell } from './EditableCell'
import { LocationCell } from './LocationCell'
import { FavoriteButton } from './FavoriteButton'
import type { Listing } from '@/types/listing'

interface TableRowProps {
  listing: Listing
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  isCompared: boolean
  onToggleCompare: (id: string) => void
}

const PRICE_CHANGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function formatPriceDelta(current: number, previous: number): string {
  const delta = Math.abs(current - previous)
  const rounded = Math.round(delta / 1000)
  return `$${rounded}k`
}

interface PriceChangeBadge {
  label: string
  colorClass: string
}

function computePriceChangeBadge(listing: Listing): PriceChangeBadge | null {
  if (!listing.price_changed_at || listing.previous_price == null || listing.price == null) return null
  const changedAt = new Date(listing.price_changed_at).getTime()
  if (Number.isNaN(changedAt)) return null
  if (Date.now() - changedAt > PRICE_CHANGE_WINDOW_MS) return null

  const dropped = listing.price < listing.previous_price
  const arrow = dropped ? '\u2193' : '\u2191'
  const color = dropped ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
  return {
    label: `${arrow} ${formatPriceDelta(listing.price, listing.previous_price)}`,
    colorClass: color,
  }
}

export function TableRow({ listing, isSelected, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
  const hasHighFees = (listing.common_fees_yearly ?? 0) > 6000
  const hasFlags = listing.notes && (
    listing.notes.toLowerCase().includes('foundation') ||
    listing.notes.toLowerCase().includes('water') ||
    listing.notes.toLowerCase().includes('sewer')
  )
  const isUnavailable = listing.status === 'unavailable'
  const priceBadge = computePriceChangeBadge(listing)

  return (
    <tr
      onClick={() => onSelect(listing.id)}
      className={`
        border-b border-slate-100 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-blue-200' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
        ${hasFlags ? 'ring-1 ring-inset ring-amber-200' : ''}
        ${isCompared ? 'border-l-2 border-l-blue-400' : ''}
        ${isUnavailable ? 'opacity-50' : ''}
      `}
    >
      <td
        className="px-1 py-2.5 text-center"
        style={{ width: '32px', minWidth: '32px' }}
        onClick={e => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isCompared}
          onChange={() => onToggleCompare(listing.id)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>
      {tableColumns.map(col => {
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

        if (col.key === 'criteria_count') {
          const checked = countChecked(deriveCriteria(listing))
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

        if (col.key === 'location') {
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-slate-700"
              style={{ width: col.width, minWidth: col.width }}
            >
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LocationCell
                    text={listing.location}
                    mapQuery={listing.full_address ?? listing.location}
                    editable={col.editable}
                    isSelected={isSelected}
                    imageUrl={listing.image_url}
                    onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
                  />
                </div>
                {isUnavailable && (
                  <span
                    className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    data-testid="unavailable-pill"
                  >
                    Unavailable
                  </span>
                )}
              </div>
            </td>
          )
        }

        const value = listing[col.key as keyof Listing]
        const isHighFeeCell = col.key === 'common_fees_yearly' && hasHighFees
        const showPriceBadge = col.key === 'price' && priceBadge !== null

        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 text-sm ${isHighFeeCell ? 'bg-red-50 text-red-800 font-medium' : 'text-slate-700'}`}
            style={{ width: col.width, minWidth: col.width }}
          >
            <div className={showPriceBadge ? 'flex items-center justify-end gap-2' : ''}>
              <EditableCell
                value={value}
                format={col.format}
                editable={col.editable}
                align={col.align}
                isSelected={isSelected}
                onSave={(newValue) => {
                  onUpdate(listing.id, col.key, newValue)
                }}
              />
              {showPriceBadge && priceBadge && (
                <span
                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${priceBadge.colorClass}`}
                  data-testid="price-change-badge"
                >
                  {priceBadge.label}
                </span>
              )}
            </div>
          </td>
        )
      })}
    </tr>
  )
}
```

- [ ] **Step 3: Write a component test**

Create `src/components/__tests__/TableRow.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TableRow } from '../TableRow'
import type { Listing } from '@/types/listing'

const BASE: Listing = {
  id: '1',
  centris_link: 'https://x/1',
  broker_link: null,
  location: 'Laval',
  full_address: '123 rue Example, Laval',
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
  image_url: null,
  latitude: null,
  longitude: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

function renderRow(listing: Listing) {
  return render(
    <table><tbody>
      <TableRow
        listing={listing}
        isSelected={false}
        onSelect={() => {}}
        onUpdate={() => {}}
        isCompared={false}
        onToggleCompare={() => {}}
      />
    </tbody></table>,
  )
}

describe('TableRow', () => {
  it('renders no Unavailable pill when active', () => {
    renderRow(BASE)
    expect(screen.queryByTestId('unavailable-pill')).toBeNull()
  })

  it('renders Unavailable pill and applies opacity-50 when unavailable', () => {
    const { container } = renderRow({ ...BASE, status: 'unavailable' })
    expect(screen.getByTestId('unavailable-pill')).toBeTruthy()
    const tr = container.querySelector('tr')
    expect(tr?.className).toContain('opacity-50')
  })

  it('renders green price drop badge within 30d', () => {
    renderRow({
      ...BASE,
      price: 90000,
      previous_price: 100000,
      price_changed_at: new Date().toISOString(),
    })
    const badge = screen.getByTestId('price-change-badge')
    expect(badge.textContent).toContain('\u2193')
    expect(badge.textContent).toContain('$10k')
    expect(badge.className).toContain('text-green-700')
  })

  it('renders amber price rise badge within 30d', () => {
    renderRow({
      ...BASE,
      price: 110000,
      previous_price: 100000,
      price_changed_at: new Date().toISOString(),
    })
    const badge = screen.getByTestId('price-change-badge')
    expect(badge.textContent).toContain('\u2191')
    expect(badge.className).toContain('text-amber-700')
  })

  it('hides price-change badge after 30d', () => {
    const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString()
    renderRow({
      ...BASE,
      price: 90000,
      previous_price: 100000,
      price_changed_at: old,
    })
    expect(screen.queryByTestId('price-change-badge')).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/__tests__/TableRow.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Lint + build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/TableRow.tsx src/components/__tests__/TableRow.test.tsx
git commit -m "feat(ui): dim unavailable listings and show price-change badge in TableRow"
```

---

## Task 10: Map marker dimming

**Files:**
- Modify: `src/components/ListingMarker.tsx`

- [ ] **Step 1: Read the full file first**

Read `src/components/ListingMarker.tsx` completely before editing.

- [ ] **Step 2: Add dimming to the pill HTML**

Find the line where the marker's HTML is built (the `const html = ...` template). Wrap the inner `<div class="relative inline-flex ...">` so that when `listing.status === 'unavailable'`, an `opacity:0.5; filter:grayscale(1);` inline style is added and a `border border-slate-400` class replaces the default.

Concretely: just before `const html = \`...\``, add:

```ts
const isUnavailable = listing.status === 'unavailable'
const dimStyle = isUnavailable ? 'opacity:0.5;filter:grayscale(1);' : ''
```

Then change the pill `<div>` opening tag inside the template so it reads:

```ts
`<div class="relative inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${pill}" style="${dimStyle}">`
```

Leave the rest of the template untouched.

- [ ] **Step 3: Lint + build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListingMarker.tsx
git commit -m "feat(map): dim markers for unavailable listings"
```

---

## Task 11: RefreshStatusesButton component

**Files:**
- Create: `src/components/RefreshStatusesButton.tsx`
- Test: `src/components/__tests__/RefreshStatusesButton.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/__tests__/RefreshStatusesButton.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RefreshStatusesButton } from '../RefreshStatusesButton'

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

describe('RefreshStatusesButton', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('renders the button', () => {
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    expect(screen.getByRole('button', { name: /refresh statuses/i })).toBeTruthy()
  })

  it('POSTs on click and calls onRefreshed with summary', async () => {
    mockFetch(async () => new Response(JSON.stringify({
      checked: 2, unavailable: 1, priceChanged: 0, errors: 0,
    }), { status: 200 }))
    const onRefreshed = vi.fn()
    render(<RefreshStatusesButton onRefreshed={onRefreshed} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh statuses/i }))
    await waitFor(() => {
      expect(onRefreshed).toHaveBeenCalledWith({ checked: 2, unavailable: 1, priceChanged: 0, errors: 0 })
    })
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0][0]).toBe('/api/refresh-statuses')
  })

  it('shows result message after success', async () => {
    mockFetch(async () => new Response(JSON.stringify({
      checked: 5, unavailable: 1, priceChanged: 2, errors: 0,
    }), { status: 200 }))
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh statuses/i }))
    await waitFor(() => {
      expect(screen.getByText(/Checked 5/)).toBeTruthy()
      expect(screen.getByText(/1 unavailable/)).toBeTruthy()
      expect(screen.getByText(/2 price changes/)).toBeTruthy()
    })
  })

  it('disables button while running', async () => {
    let resolve: (v: Response) => void = () => {}
    mockFetch(() => new Promise<Response>(r => { resolve = r }))
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    const btn = screen.getByRole('button', { name: /refresh statuses/i }) as HTMLButtonElement
    fireEvent.click(btn)
    expect(btn.disabled).toBe(true)
    resolve(new Response(JSON.stringify({ checked: 0, unavailable: 0, priceChanged: 0, errors: 0 }), { status: 200 }))
    await waitFor(() => expect(btn.disabled).toBe(false))
  })

  it('shows error message when fetch fails', async () => {
    mockFetch(async () => new Response('boom', { status: 500 }))
    render(<RefreshStatusesButton onRefreshed={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh statuses/i }))
    await waitFor(() => {
      expect(screen.getByText(/refresh failed/i)).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/components/__tests__/RefreshStatusesButton.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/components/RefreshStatusesButton.tsx`:

```tsx
'use client'

import { useState } from 'react'

export interface RefreshSummary {
  checked: number
  unavailable: number
  priceChanged: number
  errors: number
}

interface Props {
  onRefreshed: (summary: RefreshSummary) => void
}

export function RefreshStatusesButton({ onRefreshed }: Props) {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  async function handleClick() {
    setRunning(true)
    setMessage(null)
    setIsError(false)
    try {
      const res = await fetch('/api/refresh-statuses', { method: 'POST' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const summary = (await res.json()) as RefreshSummary
      setMessage(
        `Checked ${summary.checked} listings — ${summary.unavailable} unavailable, ${summary.priceChanged} price changes.`,
      )
      onRefreshed(summary)
    } catch (err) {
      setIsError(true)
      setMessage(`Refresh failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className={`
          px-3 py-1.5 text-sm rounded-lg border transition-colors
          ${running
            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-wait'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
        `}
      >
        {running ? 'Refreshing\u2026' : 'Refresh statuses'}
      </button>
      {message && (
        <span className={`text-xs ${isError ? 'text-red-600' : 'text-slate-500'}`}>{message}</span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/__tests__/RefreshStatusesButton.test.tsx`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/RefreshStatusesButton.tsx src/components/__tests__/RefreshStatusesButton.test.tsx
git commit -m "feat(ui): add RefreshStatusesButton component"
```

---

## Task 12: Mount RefreshStatusesButton + last-checked text on the page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read the current page**

Read `src/app/page.tsx` fully. Locate the area where `<FilterBar>` is rendered — that's where the refresh button goes.

- [ ] **Step 2: Add the import**

At the top of `src/app/page.tsx`, alongside the existing component imports, add:

```ts
import { RefreshStatusesButton } from '@/components/RefreshStatusesButton'
import { timeAgo } from '@/lib/time-ago'
```

- [ ] **Step 3: Mount the button next to the filter bar**

Find the JSX where `<FilterBar ... />` is rendered. Wrap it in a flex container (if not already) and add the button + last-checked text immediately after it. Example (adapt to the actual surrounding JSX):

```tsx
<div className="flex items-center gap-3 flex-wrap">
  <FilterBar propertyTypes={propertyTypes} onFilterChange={setFilters} />
  <RefreshStatusesButton onRefreshed={() => loadListings()} />
  {(() => {
    const latest = listings
      .map(l => l.status_checked_at)
      .filter((x): x is string => !!x)
      .sort()
      .at(-1)
    const ago = timeAgo(latest ?? null)
    return ago ? <span className="text-xs text-slate-500">Last checked: {ago}</span> : null
  })()}
</div>
```

Adapt variable names (`listings`, `setFilters`, `loadListings`, `propertyTypes`) to whatever the file actually uses. If `loadListings` is named differently (e.g. `fetchListings`, `refresh`), use that name. If no such refetch function exists, use whatever mechanism the existing code uses to refresh listings from Supabase after an edit.

- [ ] **Step 4: Lint + build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run: `npm run dev` in the background. Open the app in the browser. Verify:
1. A "Refresh statuses" button appears next to the Filter bar.
2. Clicking it shows "Refreshing…" briefly, then a message like "Checked N listings — …".
3. If no listings have `status_checked_at` yet, no "Last checked" text is shown. After a refresh, it appears and says "just now".

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): mount RefreshStatusesButton and last-checked indicator"
```

---

## Task 13: Full-suite verification + end-to-end smoke test

**Files:** none

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: successful build. Verify `/api/cron/refresh-statuses` and `/api/refresh-statuses` both appear in the route list.

- [ ] **Step 4: Manual smoke test against a known dead listing**

Using Supabase MCP `execute_sql`, insert a test row pointing at the dead listing URL the user mentioned:

```sql
INSERT INTO listings (centris_link, location, property_type, price, status)
VALUES (
  'https://www.centris.ca/en/condominium-houses~for-sale~laval-auteuil?listingnotfound=24767029',
  'TEST - Laval',
  'Condo',
  100000,
  'active'
) RETURNING id;
```

Record the returned id. Then click "Refresh statuses" in the UI and verify:
1. The summary shows `1 unavailable`.
2. The row dims to 50% opacity.
3. The "Unavailable" pill appears next to the address.
4. The map marker for that listing is greyed out.

Then clean up:

```sql
DELETE FROM listings WHERE id = '<recorded id>';
```

- [ ] **Step 5: Deploy notes for the user**

Provide the user with a short deployment checklist (paste into the chat, not into a file):
1. In Vercel project → Settings → Environment Variables, add:
   - `CRON_SECRET` — a long random string (e.g. from `openssl rand -hex 32`).
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → Project Settings → API → `service_role` key.
2. Push to `master`. Vercel will auto-deploy and pick up `vercel.json` to register the cron.
3. Verify in Vercel dashboard → Crons that the schedule appears.
