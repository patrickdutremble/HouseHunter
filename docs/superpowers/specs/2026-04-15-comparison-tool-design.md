# Listing Comparison Tool — Design Spec

## Overview

A comparison tool that lets users select up to 5 listings via checkboxes on the main table, then open them side-by-side in a new browser tab for easy visual comparison. All data rows are aligned horizontally across listings, and the best value for each numeric field is highlighted in green.

## Main Table Changes

### Checkbox Column

- New leftmost column (~32px wide), before the favorite star
- Simple checkbox in each row
- Clicking the checkbox does NOT select the row or open the detail panel (`e.stopPropagation()`)
- Maximum 5 selections — attempting to check a 6th shows a brief "Maximum 5 listings" message and the checkbox does not check
- Checked rows get a subtle thin blue left border (distinct from the blue background used for the currently selected row)

### Floating Compare Button

- Fixed position at bottom-center of the screen
- Appears once 2+ listings are checked
- Shows count: "Compare (3)"
- Clicking opens `/compare?ids=id1,id2,id3` in a new browser tab (`window.open`)
- Includes a small "x" / "Clear" to deselect all checkboxes
- Styled as a blue primary button with rounded corners and shadow, consistent with the app

## Comparison Page

### Route

`/compare` — new page at `src/app/compare/page.tsx`

Client component (`'use client'`) — reads `ids` from the URL query string, fetches from Supabase on mount.

### Header

- Title: "Compare Listings"
- Link back to main page (or user can just close the tab)

### Column Layout

Each listing is a vertical column, displayed side by side:

- 2 listings = 50% width each
- 3 listings = ~33% each
- 4 listings = 25% each
- 5 listings = 20% each

Equal-width columns, full page width. The page scrolls vertically if needed; no horizontal scroll.

### Column Content (top to bottom)

1. **Image** — full column width, ~180px fixed height, `object-cover`. Gray placeholder with icon if no `image_url`.
2. **Location** — bold header, linked to Google Maps via `full_address`
3. **Centris link** — small external link icon
4. **Data rows** — one row per field, label left, value right. All columns share the same row order so values align horizontally.

### Row Order

1. Price
2. Property type
3. Bedrooms
4. Liveable area (sqft)
5. Price per sqft
6. Parking
7. Year built
8. Taxes/yr
9. Common fees/yr
10. Hydro/yr
11. Downpayment
12. Monthly mortgage
13. Total monthly cost
14. Commute to school (car)
15. Commute to PVM (transit)
16. Notes

All values are read-only.

## Green Highlighting

The best value for each comparable field is highlighted with `bg-green-50` background + `text-green-700` text.

### "Best" Definition Per Field

| Field | Best = | Logic |
|-------|--------|-------|
| Price | Lowest | min |
| Bedrooms | Most | max (parsed: "2+1" -> 3) |
| Liveable area | Largest | max |
| Price per sqft | Lowest | min |
| Parking | Most | max (parsed as number) |
| Year built | Newest | max |
| Taxes/yr | Lowest | min |
| Common fees/yr | Lowest | min |
| Hydro/yr | Lowest | min |
| Downpayment | Lowest | min |
| Monthly mortgage | Lowest | min |
| Total monthly cost | Lowest | min |
| Commute to school | Shortest | min (parsed from "H:MM") |
| Commute to PVM | Shortest | min (parsed from "H:MM") |

### Highlighting Rules

- **Ties**: Both/all tied listings get green
- **Null/missing**: Ignored — don't win, don't prevent others from winning
- **Non-comparable fields** (property type, notes, location, links): No highlighting
- **Single valid value**: NOT highlighted — nothing to compare against

## Data Fetching & Error Handling

- Read `ids` from URL query string
- Fetch from Supabase: `.in('id', ids)` with `.is('deleted_at', null)`
- **No IDs or fewer than 2 valid listings returned**: Show "Select at least 2 listings to compare" with a link back to the main page
- **ID doesn't exist or was deleted**: Silently skip — show whatever valid listings come back
- **More than 5 IDs in URL**: Take the first 5, ignore the rest

## Styling

Consistent with the existing app:

- Tailwind CSS 4 only (no CSS modules)
- Blue primary, slate grays, amber for favorites
- Green for "best" highlights (`bg-green-50`, `text-green-700`)
- `rounded-lg` corners, `shadow-sm` for cards
- `text-sm` for data values, `text-xs` for labels
- Inter font (inherited from root layout)
