# Listing Status / Staleness — Design

**Goal:** Detect when Centris listings go unavailable or change price, surface that in the UI, so the user stops comparing dead listings and notices price movements.

**Approach:** A daily Vercel cron re-fetches each active listing's Centris page, detects an "unavailable" banner, and tracks price changes. A manual "Refresh statuses" button triggers the same logic on demand. The UI shows a badge + dims unavailable listings, and shows a price-change badge next to the price for recent movements.

## Data model

Four new columns on the `listings` Supabase table:

| Column | Type | Purpose |
|---|---|---|
| `status` | text NOT NULL DEFAULT 'active' | `'active'` or `'unavailable'`. Drives badge and dimming. |
| `status_checked_at` | timestamptz | Last time we re-checked this listing. Used to show "last checked N ago". |
| `previous_price` | numeric | Price before the most recent change. Null if price has never changed. |
| `price_changed_at` | timestamptz | When the price most recently changed. Null if never changed. |

Migration applied via Supabase MCP (`mcp__269d13ab-...__apply_migration`). Defaults cover existing rows, so no backfill.

## Status-check logic

New file `src/lib/status-check.ts` — pure function with no side effects.

```ts
export type StatusCheckResult =
  | { status: 'unavailable' }
  | { status: 'active'; price: number | null }

export async function checkListingStatus(centrisUrl: string): Promise<StatusCheckResult>
```

Detection rules, evaluated in order:

1. Fetch the URL with `fetch(centrisUrl, { redirect: 'follow' })`.
2. If the final response URL contains `listingnotfound=` → **unavailable**. (Centris redirects removed listings to a search page with this query param — confirmed from user's example URL.)
3. If HTML body contains `"no longer available"` (case-insensitive) → **unavailable**.
4. If response status is 404 → **unavailable**.
5. Otherwise → parse the current asking price from the page using the same selector `src/lib/centris-parser.ts` already uses, and return **active** with that price.

Error handling: any network error or non-2xx (other than 404) throws. Callers catch and skip that row for this run — a transient failure must never flip an active listing to unavailable.

Unit tests use fixture HTML snippets for each of the four outcomes: active page, `listingnotfound` redirect, "no longer available" banner, 404.

## Endpoints

### Daily cron

`src/app/api/cron/refresh-statuses/route.ts` (GET):

- Auth: requires header `Authorization: Bearer ${process.env.CRON_SECRET}`. Vercel Cron attaches this automatically; any other caller is rejected with 401.
- Loads all listings where `status = 'active'`.
- Processes them in batches of 10 concurrent via `Promise.all` on 10-item chunks. This keeps a 200-listing run under the Vercel 60s hobby timeout.
- For each listing, calls `checkListingStatus(centris_link)`, then writes back:
  - **unavailable** → set `status='unavailable'`, `status_checked_at=now()`.
  - **active + price changed** → set `previous_price = <old>`, `price = <new>`, `price_changed_at = now()`, `status_checked_at = now()`.
  - **active + price unchanged** → set `status_checked_at = now()` only.
  - **error** → log and skip the row.
- Returns JSON `{ checked, unavailable, priceChanged, errors }`.

### Manual refresh

`src/app/api/refresh-statuses/route.ts` (POST):

- No auth beyond what the rest of the app already has (same-origin browser call from the user's session).
- Calls the exact same core logic as the cron route.

### Shared helper

`src/lib/refresh-statuses.ts` exports `refreshAllStatuses()` which both routes import. No duplicated logic between cron and manual.

### Vercel cron config

`vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/refresh-statuses", "schedule": "0 9 * * *" }]
}
```

Runs daily at 09:00 UTC (05:00 Montréal).

### Integration test

A test for `refreshAllStatuses()` that stubs `checkListingStatus` and verifies all three state transitions (unavailable, price-changed, unchanged) produce the correct DB writes.

## UI

### Row badge and dimming — `src/components/TableRow.tsx`

- When `status === 'unavailable'`: render a small grey pill labelled "Unavailable" next to the address, and set the row's `opacity` to 0.5.
- When `price_changed_at` is set and newer than 30 days: render a small badge next to the price cell — `"↓ $15k"` in green if the new price is lower than `previous_price`, `"↑ $10k"` in amber if higher. Label uses `formatting.ts` currency formatter, rounded to nearest $1k.

### Map markers — `src/components/ListingMarker.tsx`

- Unavailable listings render at 50% opacity with a grey outline. Same marker shape, just dimmed.

### Refresh button — `src/components/FilterBar.tsx`

- Small "Refresh statuses" button at the end of the filter row.
- On click: POST to `/api/refresh-statuses`, show a spinner, then a toast summarizing the result (e.g. `"Checked 42 listings — 2 unavailable, 3 price changes."`).
- Disabled while running. On success, re-fetches listings from Supabase so the UI reflects the new state.

### Last-checked indicator

- Small grey text under the Refresh button: `"Last checked: 3h ago"`, derived from the max `status_checked_at` across all listings. Uses a relative-time helper.

### UI tests

- `TableRow` renders the Unavailable pill and sets opacity when `status='unavailable'`.
- `TableRow` renders the correct arrow and colour for price drop vs rise.
- `ListingMarker` applies the dim styling when `status='unavailable'`.

## Out of scope

- Full price history (you chose B in Q2, not C — only the most recent change is stored).
- Distinguishing Sold vs Removed (you chose two-state in Q3).
- Re-running geocoding or commute calculations during status check (Q5 — those don't change).
- Lazy on-page-load refresh (Q1 — daily cron + manual button only).
