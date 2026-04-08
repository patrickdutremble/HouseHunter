# HouseHunter — Design Specification

**Date:** 2026-04-07
**Status:** Approved

## Overview

HouseHunter is a browser-based tool that consolidates Quebec real estate listing data into a single, polished comparison interface. The user pastes a Centris.ca link, and the system automatically extracts data from multiple sources (Centris, Realtor.ca, broker website), normalizes it, calculates financial metrics, fetches commute times, and presents it in an editable, sortable table.

## Architecture

### Three Components

1. **Web app (Next.js + Tailwind CSS)** — Browser-based interface with a spreadsheet-style table view and a detail panel. Hosted on Vercel (free tier) or run locally.
2. **Supabase (PostgreSQL)** — Free cloud database storing all listing data. User already has an account.
3. **Claude-in-Chrome (MCP)** — Reads web pages from the user's real browser. Handles all data extraction without scraping or anti-bot issues.

### Why This Architecture

- **No scraping problem:** Claude-in-Chrome reads from the user's real browser session, so Centris/Realtor.ca anti-bot measures are irrelevant.
- **Free:** Supabase free tier + Vercel free tier + Claude-in-Chrome = $0.
- **Cloud-backed data:** Listings persist in Supabase, safe from local machine issues, accessible from any device.
- **Extensible:** New fields can be added to the database and UI without major rework.

## Data Model

The data model is designed to be extensible — adding or removing fields later should be straightforward.

| # | Field | DB Column | Type | Source | Notes |
|---|---|---|---|---|---|
| 1 | Link | `link` | text | User (pasted) | Original Centris URL |
| 2 | Location | `location` | text | Extracted | City/neighborhood only, not full address. Links to Google Maps. |
| 3 | Full address | `full_address` | text | Extracted | Stored but hidden from main table. Used for lookups and Google Maps link. |
| 4 | MLS # | `mls_number` | text | Extracted | Used for cross-source verification |
| 5 | Type | `property_type` | text | Extracted | Condo, house, townhouse, etc. |
| 6 | Price | `price` | integer | Centris (authoritative) | Rounded, formatted as $X,XXX,XXX |
| 7 | Taxes (yearly) | `taxes_yearly` | integer | Best source | Municipal + school, converted to yearly. Rounded. |
| 8 | Common fees (yearly) | `common_fees_yearly` | integer | Best source | Condo/common/rental fees combined, yearly. Rounded. |
| 9 | Bedrooms | `bedrooms` | text | Broker preferred | "+1" appended if mezzanine exists (e.g., "3+1") |
| 10 | Net liveable area (sqft) | `liveable_area_sqft` | integer | Broker preferred | Calculated from room dimensions if not directly stated. Rounded. |
| 11 | $/sqft | `price_per_sqft` | integer | Calculated | Price / liveable area. Rounded. |
| 12 | Parking | `parking` | text | Best source | Count + types (driveway, garage, street, etc.) |
| 13 | Storey | `storey` | text | Best source | Condo only. Empty if unavailable. |
| 14 | Year built | `year_built` | integer | Best source | Empty if unavailable. |
| 15 | Downpayment | `downpayment` | integer | Calculated | 20% of price. Rounded. |
| 16 | Monthly mortgage | `monthly_mortgage` | integer | Calculated | 3.99% fixed, 25yr amortization, on 80% of price. Rounded. |
| 17 | Total monthly cost | `total_monthly_cost` | integer | Calculated | Mortgage + taxes/12 + common fees/12. Rounded. |
| 18 | Commute to school (car) | `commute_school_car` | text | Google Maps | Format: H:MM. By car, no time constraint. |
| 19 | Commute to PVM (transit) | `commute_pvm_transit` | text | Google Maps | Format: H:MM. By transit, arriving by 9 AM weekday. |
| 20 | Notes | `notes` | text | Auto + manual | Auto-flags + user's own notes |
| 21 | Personal rating | `personal_rating` | text | User | Optional scoring/annotation field |
| 22 | Status | `status` | text | System | pending, partial, complete, error |
| 23 | Created at | `created_at` | timestamp | System | When the listing was added |
| 24 | Updated at | `updated_at` | timestamp | System | Last modification time |

### Extensibility

- The Supabase table can have new columns added at any time via the Supabase dashboard (no coding needed).
- The frontend will be built so that adding a new field requires minimal changes (add to the column config, done).
- Calculated fields ($/sqft, mortgage, total cost) will recalculate automatically when their input fields are edited.

## Multi-Source Extraction Flow

### Step-by-step process

When the user pastes a Centris URL:

**Step 1 — Read Centris page**
- Claude-in-Chrome reads the page content from the user's open browser tab
- Extracts: address, price, MLS/Centris number, property type, and whatever partial data is available
- This becomes the "anchor" — price, address, and MLS# from Centris are the source of truth for identity verification

**Step 2 — Google search for additional sources**
- Claude searches Google for: `"[full address]" "[MLS number]"`
- Looks for: Realtor.ca listing link and broker/agency website listing link
- If Google doesn't find them, falls back to searching directly on Realtor.ca

**Step 3 — Read Realtor.ca listing**
- Claude navigates to the Realtor.ca listing in the browser
- **VERIFICATION GATE:** Before extracting ANY data, verify that ALL THREE match:
  - Address matches Centris
  - Price matches Centris
  - MLS# matches Centris
- If verification fails: skip this source, note the mismatch, do not extract
- If verified: extract additional fields not available on Centris

**Step 4 — Read broker website listing**
- Claude navigates to the broker's listing page
- **VERIFICATION GATE:** Same triple-check (address, price, MLS#)
- If verified: extract remaining fields — broker sites typically have the most complete data (room dimensions, detailed features, etc.)

**Step 5 — Merge data**
- Priority for identity fields: Centris (authoritative for price, MLS#)
- Priority for detail fields: broker site > Realtor.ca > Centris
- If sources conflict on a detail field: use broker site value, flag the discrepancy in Notes

**Step 6 — Google Maps commute times (x2)**
- **Route 1:** Property address → 1750 Mnt Masson, Laval, QC H7C 0K4 (Leblanc Secondary School). By car. No time constraint.
- **Route 2:** Property address → 1 Pl. Ville-Marie, Montreal, QC H3B 5G9 (Place Ville-Marie). By public transit. Arriving by 9 AM on a weekday.
- Read actual commute times from Google Maps (not estimated)

**Step 7 — Normalize and calculate**
- Taxes: convert to yearly if provided monthly (×12). Sum municipal + school taxes.
- Common fees: convert to yearly. Sum all fee types.
- Bedrooms: append "+1" if mezzanine exists.
- Liveable area: use stated value, or calculate from room dimensions if not stated.
- All numbers rounded to nearest dollar, no decimals.
- Calculate: downpayment (20%), monthly mortgage, total monthly cost, $/sqft.

**Step 8 — Flag and save**
- Auto-generate notes for:
  - Common fees > $500/month
  - Non-standard foundation (stone, block, etc. — anything other than concrete)
  - Non-standard water/sewer system (anything not municipal)
- Save to Supabase
- Set status to "complete" or "partial" (with explanation in notes)

### Failure handling

| Failure | Behavior |
|---|---|
| Listing not found on Realtor.ca | Skip, mark status "partial", note which source was missed |
| Listing not found on broker site | Skip, mark status "partial", note which source was missed |
| Verification fails (price/address/MLS# mismatch) | Do NOT extract from that source. Note the mismatch. |
| Google Maps can't calculate route | Leave commute fields empty, note it |
| Any field can't be determined | Left empty (shown as "—"), never fabricated |
| Conflicting data between sources | Use broker site value, flag discrepancy in Notes |

## Web Interface Design

### Design Principles

- **Polished, modern UI** — Clean typography, intentional whitespace, cohesive color palette, subtle visual cues. Not a raw data table with default styling.
- **Designed for scanning** — Numbers right-aligned, consistent formatting, visual hierarchy that guides the eye.
- **Canadian formatting** — Currency as $X,XXX,XXX. All amounts rounded to nearest dollar.
- **Empty fields** — Shown as "—", not "N/A" or "unknown".
- **Desktop-optimized** — This is a comparison tool; big screen is the primary use case. Mobile-friendly but not mobile-first.

### Main Table View

- Compact spreadsheet-style table, one row per listing
- Sortable columns (click header to sort by price, $/sqft, commute time, etc.)
- Filterable (by type, price range, location, status)
- Inline editing — click any cell to edit its value directly
- Color-coded flags:
  - Red/warm highlight on common fees if > $500/month
  - Orange/warm highlight on notes if non-standard foundation or water system
- Status indicator per row (complete/partial/error)
- Sticky header — column names stay visible when scrolling through 200+ rows

### Detail Panel

Slides open from the right when a row is clicked:

- All fields displayed with clear labels in a readable layout
- Clickable links: original Centris listing, Google Maps location
- Source attribution — shows which source each field came from
- Full notes section (auto-generated flags + user's personal notes)
- Personal rating field
- "Re-extract" button to re-run extraction for stale/incorrect data

### Top Bar

- **URL input field** — Paste a Centris link and press Enter to start extraction
- **Extraction progress indicator** — Shows which step is running during extraction
- **Export button** — Download all data as CSV for use in Excel

## Mortgage Calculation

**Formula:** Standard amortization: `M = P × [r(1+r)^n] / [(1+r)^n - 1]`

**Parameters:**
- P = principal = 80% of listing price (after 20% downpayment)
- r = monthly interest rate = 3.99% ÷ 12 = 0.3325%
- n = total payments = 25 years × 12 = 300 months

**Total monthly cost** = monthly mortgage + (yearly taxes ÷ 12) + (yearly common fees ÷ 12)

**Example:** $500,000 listing
- Downpayment: $100,000
- Mortgage principal: $400,000
- Monthly mortgage: ~$2,106
- If taxes $4,000/yr + common fees $3,600/yr → adds ~$633/mo
- Total monthly: ~$2,739

All results rounded to nearest dollar.

Calculated fields (downpayment, mortgage, $/sqft, total monthly cost) automatically recalculate when their input values are edited.

## Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Web framework | Next.js (React) | Page rendering and application logic |
| Styling | Tailwind CSS | Polished, consistent design system |
| Database | Supabase (PostgreSQL) | Cloud-hosted listing data storage |
| Data extraction | Claude-in-Chrome MCP | Reads pages from user's real browser |
| Commute times | Google Maps via Claude-in-Chrome (Phase 1), Google Maps API (Phase 2) | Real driving/transit commute times |
| Hosting | Vercel (free tier) | Web app hosting, accessible from any device |
| Calculations | Built into the app (JavaScript) | Mortgage, $/sqft, downpayment, totals |

### Prerequisites (all already available)

- Supabase account (existing)
- Vercel account (existing)
- Node.js (installed)
- Chrome with Claude-in-Chrome extension

## Commute Time Details

### Route 1: To Leblanc Secondary School (by car)
- **Destination:** 1750 Mnt Masson, Laval, QC H7C 0K4
- **Mode:** Driving
- **Time constraint:** None

### Route 2: To Place Ville-Marie (by transit)
- **Destination:** 1 Pl. Ville-Marie, Montreal, QC H3B 5G9
- **Mode:** Public transit
- **Time constraint:** Arrive by 9:00 AM on a weekday

### Method
- Phase 1: Claude-in-Chrome opens Google Maps, enters the route with correct parameters, reads the commute time directly from the page.
- Phase 2 (optional upgrade): Google Maps Directions API for faster, programmatic access.

## Key Rules

1. **Never fabricate data.** If a field can't be determined, leave it empty.
2. **Always verify identity.** Before extracting from any source, confirm address + price + MLS# match the original Centris listing.
3. **Source priority:** Centris for price/MLS#. Broker site for property details. Realtor.ca fills remaining gaps.
4. **Flag conflicts.** If sources disagree, use broker value and note the discrepancy.
5. **Round everything.** All dollar amounts and measurements rounded to nearest whole number.
6. **Canadian format.** Currency as $X,XXX,XXX.
7. **Extensible design.** Adding new fields should require minimal changes.
