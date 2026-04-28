## Centris bookmarklet (self-contained reference)

**Read this section before touching the bookmarklet or the add-listing page. Do NOT re-explore the Centris DOM or the app — everything you need is below.**

### What it is

A "javascript:" bookmarklet that runs on any Centris listing page, scrapes fields from the DOM, and opens `<APP>/add-listing?...` in a new tab. The add-listing page does the duplicate check and the Supabase insert. This split exists because centris.ca's CSP blocks direct `fetch()` to Supabase.

### Files (these only — do not touch anything else for bookmarklet work)

- `public/bookmarklet.html` — helper page with drag-and-drop install buttons. Contains the bookmarklet **source as a JS string array** that gets stitched together with `__APP__` replaced per button. Edit the `source` array inside the `<script>` block.
- `src/app/add-listing/page.tsx` + `src/app/add-listing/AddListingClient.tsx` — client component that reads query params, checks for duplicates, inserts the row, then calls `/api/commute`.
- `src/app/api/commute/route.ts` — server-side POST route that takes `{ listingId, lat, lon }`, calls the Google Directions API twice (driving to school, transit to PVM arriving 9 AM next Monday Montreal local time), and writes durations to `commute_school_car` / `commute_pvm_transit`. Has an early-return guard if both values already exist. Uses `GOOGLE_MAPS_API_KEY` env var (server-side only).

### Fields currently captured

| Query param | Centris source | DB column | Type |
|---|---|---|---|
| `url` | `window.location.href` | `centris_link` | text |
| `location` | last comma-separated part of the first `<h2>` that starts with a street-number token (digits + optional letters/hyphen) + comma | `location` | text |
| `addr` | full text of that same `<h2>` | `full_address` | text |
| `type` | first `<h1>` matching `/^(.+?) (for sale\|à vendre\|for rent\|à louer)/i` | `property_type` | text |
| `price` | `.price span.text-nowrap` (fallback `.price span`), digits only | `price` | integer |
| `taxes` | `.financial-details-table-yearly` where title === `Taxes`, `.financial-details-table-total` digits | `taxes_yearly` | integer |
| `fees` | same, title === `Fees`/`Frais` (optional) | `common_fees_yearly` | integer |
| `bedrooms` | first `body.innerText` match of `/(\d+)\s+(bedroom\|chambre)/i` | `bedrooms` | text |
| `area` | `.carac-container` where title matches `^(net area\|living area\|superficie (nette\|habitable))$`, parse number; if `m²`/`m2` convert × 10.764 | `liveable_area_sqft` | integer |
| `parking` | `.carac-container` where title matches `^(parking\|stationnement)\s+\(?total\)?$` (English uses "Parking (Total)", French uses "Stationnement total" with no parens) | `parking` | text |
| `year` | `.carac-container` where title matches `^(year built\|année de construction)$`, first 4-digit group | `year_built` | integer |
| `lat` | `<meta itemprop="latitude">` content | (transient — `/api/commute` only) | — |
| `lon` | `<meta itemprop="longitude">` content | (transient — `/api/commute` only) | — |
| `img` | `<meta property="og:image">` content (fallback: first `.main-img img` / `.photo-gallery img` / `img[src*="mspublic.centris.ca"]`) | `image_url` | text |

### Key constraints

- **CSP:** Centris blocks `connect-src` to non-centris origins. Do NOT fetch Supabase from within the bookmarklet.
- **Duplicate handling:** The add-listing page does `SELECT id FROM listings WHERE centris_link = $1` first. If exists, shows "Already in HouseHunter".
- **DOM quirk:** Centris renders BOTH monthly and yearly financial tables. `.financial-details-table-yearly` always gives yearly values regardless of toggle state.
- **`.carac-container`** is a uniform key-value row with `.carac-title` and `.carac-value`. Use the `getCarac(regex)` helper.
- French and English listings both work via regex variants.
- Houses often lack `Net area` and `Fees`/`Frais` — leave them NULL.

### How to add a new field

1. In `public/bookmarklet.html`, add scraping logic inside the `source` array (use `getCarac()` for `.carac-container` rows).
2. Add a `p.set('<short-name>', value)` line only if value is truthy.
3. In `AddListingClient.tsx`, read the param with `searchParams.get(...)`, coerce type, add to `.insert({...})` object and `useEffect` deps, add a `<Field>` line in the success JSX.
4. Test via `http://localhost:3000/add-listing?...` — no need to re-click the bookmarklet.
5. Clean up test rows from the DB when done.

### Testing tips

- **Omit `lat`/`lon` from test URLs** unless testing commute flow (avoids Google API charges).
- The early-return guard means hitting the same listing twice is free.
- Use Brossard condo for full-field tests: `https://www.centris.ca/en/condos~for-sale~brossard/16342283`
- Keep bookmarklet commits as `feat: bookmarklet ...` scoped to bookmarklet files only.
