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
| `notes` | text | Put flags here (see Step 5) + anything notable |

**Leave blank** (NULL) any field missing from both Centris and the broker site. Do NOT fabricate. Do NOT fall back to other sources.

**Fields you must NOT touch:** `commute_school_car`, `commute_pvm_transit`, `personal_rating`, `status`, `centris_link`, `broker_link`. The user fills these manually.

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
  downpayment = $13, monthly_mortgage = $14, total_monthly_cost = $15,
  price_per_sqft = $16, notes = $17, status = 'extracted',
  updated_at = now()
WHERE id = $18;
```

**Never INSERT.** The web app creates rows. You only UPDATE existing ones.

### Step 7 — Report back

Brief summary per listing: address, price, any flags. Do NOT paste the extracted data dump — the user sees it in the app.

---

## Other tasks (not extraction)

For anything that is NOT listing extraction (bug fixes, UI changes, new features, etc.), the runbook above does not apply — read the source files as needed. The "don't read src/" rule is ONLY for the extraction workflow.
