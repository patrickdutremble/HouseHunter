@AGENTS.md

## Listing Extraction Runbook (self-contained — do NOT read src/ files)

**When the user says something like "extract data for the new listings", follow the steps in this section EXACTLY. Everything you need is here — do NOT read any files under `src/` or re-explore the codebase. Doing so wastes tokens. If a detail is genuinely missing from this runbook, ask the user before reading source files.**

### Step 1 — Find pending rows

Use Supabase MCP (`execute_sql`, project ID `erklsdwrhscuzkntomxu`) to run:

```sql
SELECT id, centris_link, broker_link
FROM listings
WHERE centris_link IS NOT NULL
  AND (price IS NULL OR full_address IS NULL OR mls_number IS NULL)
ORDER BY created_at DESC;
```

Those are the rows to process. Report the count back to the user before proceeding if there are more than 3.

### Step 2 — Fetch the pages

For each pending row, use **WebFetch** on `centris_link` and (if present) `broker_link`. Do NOT use WebSearch, Realtor.ca, Claude-in-Chrome, or Playwright unless the user explicitly asks.

### Step 3 — Extract these fields

Verify address + price + MLS# match between Centris and broker before trusting any field. Source priority: **Centris is authoritative for price/MLS#/taxes/fees; broker site is richer for physical details.**

| Column | Type | Notes |
|---|---|---|
| `location` | text | Short neighborhood/city label, e.g. "Laval (Duvernay)" |
| `full_address` | text | Full street address |
| `mls_number` | text | Centris MLS#, digits only |
| `property_type` | text | e.g. "Condo", "House", "Duplex" |
| `price` | integer | Asking price in CAD, no $ or commas |
| `taxes_yearly` | integer | Municipal + school taxes combined, yearly CAD |
| `common_fees_yearly` | integer | Condo fees × 12 if monthly is given |
| `bedrooms` | text | e.g. "3" or "3+1" (append "+1" if mezzanine exists) |
| `liveable_area_sqft` | integer | Interior area, sqft (convert from m² if needed: m² × 10.764) |
| `parking` | text | e.g. "1 garage + 1 outdoor" |
| `storey` | text | e.g. "1st floor", "2 storeys" |
| `year_built` | integer | 4-digit year |
| `image_url` | text | URL of the main listing photo. Grab from `<meta property="og:image">` if present, otherwise the first photo in the gallery. Full URL, no cropping. |
| `notes` | text | Put flags here (see Step 5) + anything notable |

**Leave blank** (NULL) any field missing from both Centris and the broker site. Do NOT fabricate. Do NOT fall back to other sources.

**Fields you must NOT touch:** `commute_school_car`, `commute_pvm_transit`, `personal_rating`, `status`, `centris_link`, `broker_link`. The user fills `personal_rating` and `status` manually; `commute_school_car` / `commute_pvm_transit` are auto-populated at insert time by the bookmarklet → `/api/commute` flow (see bookmarklet section below). During extraction you're cleaning up rows the bookmarklet couldn't fully fill, so leave the commute columns alone — don't overwrite or recompute them.

### Step 4 — Calculate derived fields

```
downpayment        = round(price * 0.20)
monthly_mortgage   = round( principal * (r * (1+r)^n) / ((1+r)^n - 1) )
                     where principal = price * 0.80
                           r = 0.0399 / 12        (monthly rate, 3.99% annual)
                           n = 25 * 12 = 300       (25-year amortization)
total_monthly_cost = monthly_mortgage + round(taxes_yearly/12) + round(common_fees_yearly/12)
                     (treat missing taxes or fees as 0)
price_per_sqft     = round(price / liveable_area_sqft)   (NULL if area missing or 0)
```

All rounded to nearest integer. CAD. No currency symbol in the DB — formatting happens in the UI.

### Step 5 — Flag concerns in `notes`

Append these to the `notes` field, pipe-separated (` | `):

- **High condo fees:** if `common_fees_yearly > 6000` → `High condo fees ($X/mo)` where X = round(common_fees_yearly/12)
- **Non-standard foundation:** if foundation text contains any of: `stone`, `block`, `brick`, `wood`, `pile`, `pier` (case-insensitive). "Concrete" alone is standard. → `Non-standard foundation: <text>`
- **Non-standard water/sewer:** if water/sewer text contains any of: `well`, `septic`, `cistern`, `holding tank`, `private` (case-insensitive). "Municipal" is standard. → `Non-standard water/sewer: <text>`

### Step 6 — Update the row

Use Supabase MCP `execute_sql` with an UPDATE. Template:

```sql
UPDATE listings SET
  location = $1, full_address = $2, mls_number = $3, property_type = $4,
  price = $5, taxes_yearly = $6, common_fees_yearly = $7, bedrooms = $8,
  liveable_area_sqft = $9, parking = $10, storey = $11, year_built = $12,
  image_url = $13,
  downpayment = $14, monthly_mortgage = $15, total_monthly_cost = $16,
  price_per_sqft = $17, notes = $18, status = 'extracted',
  updated_at = now()
WHERE id = $19;
```

**Never INSERT.** The web app creates rows. You only UPDATE existing ones.

### Step 7 — Report back

Brief summary per listing: address, price, any flags. Do NOT paste the extracted data dump — the user sees it in the app.

---

## Centris bookmarklet (self-contained reference)

**Read this section before touching the bookmarklet or the add-listing page. Do NOT re-explore the Centris DOM or the app — everything you need is below.**

### What it is

A "javascript:" bookmarklet that runs on any Centris listing page, scrapes fields from the DOM, and opens `<APP>/add-listing?...` in a new tab. The add-listing page (in the HouseHunter app) does the duplicate check and the Supabase insert. This two-piece split exists because centris.ca's CSP blocks direct `fetch()` to Supabase from the page itself.

### Files (these only — do not touch anything else for bookmarklet work)

- `public/bookmarklet.html` — helper page with drag-and-drop install buttons. Contains the bookmarklet **source as a JS string array** that gets stitched together with `__APP__` replaced per button (production Vercel URL + `http://localhost:3000`). Edit the `source` array inside the `<script>` block.
- `src/app/add-listing/page.tsx` + `src/app/add-listing/AddListingClient.tsx` — client component that reads query params, checks Supabase for existing `centris_link`, inserts the row, then calls `/api/commute` to populate commute fields. Uses the existing `@/lib/supabase` client and the public anon key that's already in the app bundle.
- `src/app/api/commute/route.ts` — server-side POST route that takes `{ listingId, lat, lon }`, calls the Google Directions API twice (driving to school, transit to PVM arriving 9 AM next Monday Montreal local time), and writes the durations to `commute_school_car` / `commute_pvm_transit`. Has an early-return guard if the row already has both commute values (prevents double-billing). Uses `GOOGLE_MAPS_API_KEY` env var (server-side only — never exposed to the client bundle).

### Fields currently captured

| Query param | Centris source | DB column | Type |
|---|---|---|---|
| `url` | `window.location.href` | `centris_link` | text |
| `location` | last comma-separated part of the first `<h2>` that starts with digits + comma | `location` | text |
| `type` | first `<h1>` matching `/^(.+?) (for sale\|à vendre\|for rent\|à louer)/i` | `property_type` | text |
| `price` | `.price span.text-nowrap` (fallback `.price span`), digits only | `price` | integer |
| `taxes` | `.financial-details-table-yearly` whose `.financial-details-table-title` === `Taxes`, `.financial-details-table-total` digits | `taxes_yearly` | integer |
| `fees` | same, title === `Fees`/`Frais` (optional; houses usually lack it) | `common_fees_yearly` | integer |
| `bedrooms` | first `body.innerText` match of `/(\d+)\s+(bedroom\|chambre)/i` | `bedrooms` | text |
| `area` | `.carac-container` where title matches `^(net area\|living area\|superficie (nette\|habitable))$`, parse number; if `m²`/`m2` convert × 10.764 and round | `liveable_area_sqft` | integer |
| `parking` | `.carac-container` where title matches `^(parking \(total\)\|stationnement \(total\))$`, raw text | `parking` | text |
| `year` | `.carac-container` where title matches `^(year built\|année de construction)$`, first 4-digit group | `year_built` | integer |
| `lat` | `<meta itemprop="latitude">` content | (transient — used by `/api/commute` only, not stored) | — |
| `lon` | `<meta itemprop="longitude">` content | (transient — used by `/api/commute` only, not stored) | — |
| `img` | `<meta property="og:image">` content (fallback: first `.main-img img` / `.photo-gallery img` / `img[src*="mspublic.centris.ca"]`) | `image_url` | text |

### Commute auto-fetch

After the insert succeeds, the add-listing client POSTs `{ listingId, lat, lon }` to `/api/commute`. That server route hits the Google Directions API twice:

- **Driving → Secondary School Leblanc, Terrebonne** → stored in `commute_school_car`
- **Transit → 1 Place Ville Marie, Montreal**, with `arrival_time = next Monday 9:00 AM Montreal local` (DST-safe computation in the route) → stored in `commute_pvm_transit`

Both are stored as strings like `"32 min"`. **Each successful insert-with-coords costs ~$0.01 against the Google Maps Platform free tier** ($200/month credit — comfortably free under normal usage). If the API call fails or `lat`/`lon` are missing, the listing is still reported as successfully added, with an amber note in the success panel.

The API key lives in `GOOGLE_MAPS_API_KEY` (server-side env var, set in `.env.local` + all three Vercel environments). It's restricted in Google Cloud to the Directions API only.

### DOM quirks that matter

- **Centris always renders BOTH monthly and yearly financial detail tables in the DOM.** The Yearly/Monthly toggle only changes CSS visibility. `.financial-details-table-yearly` always gives yearly values regardless of toggle state. The municipal assessment table has neither suffix, so it's naturally excluded.
- **`.carac-container` is a uniform key-value row** with a `.carac-title` label and `.carac-value` value. Use the `getCarac(regex)` helper pattern already in `bookmarklet.html`.
- French and English listings both work if the regexes include French variants (`à vendre`, `chambre`, `frais`, `superficie`, `stationnement`, `année de construction`).
- Houses often lack `Net area` and `Fees`/`Frais` — the code must leave them NULL, not fabricate.

### CSP constraint

Centris's `Content-Security-Policy` blocks `connect-src` to any non-centris origin. That's why the bookmarklet opens `window.open(APP + '/add-listing?...')` instead of calling Supabase directly. **Do not attempt to fetch Supabase from within the bookmarklet itself** — it will fail.

### Duplicate handling

The add-listing page does a `SELECT id FROM listings WHERE centris_link = $1` first. If a row exists, it shows "Already in HouseHunter" and does nothing. The bookmarklet never INSERTs directly.

### How to add a new field

1. In `public/bookmarklet.html`, add scraping logic inside the `source` array (use `getCarac()` for anything in the `.carac-container` key-value rows).
2. Add a `p.set('<short-name>', value)` line only if value is truthy.
3. In `AddListingClient.tsx`, read the param with `searchParams.get(...)`, coerce to the right type, add it to the `.insert({...})` object, add it to the `useEffect` dep array, and add a `<Field>` line in the success JSX.
4. Test by navigating directly to `http://localhost:3000/add-listing?...` — no need to re-click the bookmarklet.
5. Clean up any test rows from the DB when done.

### How to test without re-clicking the bookmarklet

The bookmarklet just builds a URL and opens a tab. You can skip the Centris page entirely by navigating directly to `http://localhost:3000/add-listing?url=<encoded>&...`. Use the Brossard condo for a full-field test case: `https://www.centris.ca/en/condos~for-sale~brossard/16342283` (bedrooms=1, area=527, parking="Garage (1)", year=2018, taxes=1691, fees=1572, price=339000, location=Brossard, type=Condo).

**IMPORTANT — avoid burning Google Directions API quota during testing:**

- **Omit `lat` and `lon` from the test URL** unless you're specifically testing the commute flow. The route handles missing coordinates gracefully (shows success with a "No coordinates captured" note, no Google API call made).
- The `/api/commute` route has an early-return guard: if the row already has both `commute_school_car` and `commute_pvm_transit` set, it returns the stored values without calling Google. So hitting the same listing twice is free — but hitting many fresh test inserts with coords each time is not.
- If you need to test the full commute path, do it once per iteration, and use the Brossard coords (45.4553, -73.4649) so results are consistent. Clean up the test row with `DELETE FROM listings WHERE id = '...'` when done.
- You can also test the route in isolation without going through add-listing: `curl -X POST http://localhost:3000/api/commute -H "Content-Type: application/json" -d '{"listingId":"<uuid>","lat":45.4553,"lon":-73.4649}'` — if the UUID doesn't match a real row, the Supabase update no-ops but the response still contains the fetched durations (one API charge).

### Commit convention

Keep bookmarklet changes as `feat: bookmarklet ...` commits scoped to those two files. Do NOT bundle unrelated edits.

---

## Other tasks (not extraction, not bookmarklet)

For anything that is NOT listing extraction and NOT bookmarklet work, neither runbook applies — read the source files as needed. The "don't re-explore" rules only apply to the two runbooks above.
