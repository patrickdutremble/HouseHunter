# Map View

## Goal

Add a **Map** view to the main listings page so Patrick can scan listings by proximity to the school — the primary commute target. Toggle between the existing table and a new map showing all non-deleted listings as price-pill markers, plus a fixed school pin and a rough 20-minute commute zone. Listings and favorites already tracked in the DB drive the marker styling. No external geocoding service is needed because Centris already provides coordinates in its page metadata — the extractor reads them today but doesn't persist them.

## Behavior

### View toggle

A `Table | Map` segmented control sits in the top bar, next to the URL input. The active view is reflected in the URL as `?view=map` so the browser back button works and links are shareable. Default is `?view=table` (the current behavior).

When Map is active, the table is hidden and the map fills the same area. The DetailPanel continues to slide in from the right regardless of which view is active. The FilterBar and all top-bar controls (URL input, Paste, Add) stay visible.

### Map contents

- **Tile layer.** OpenStreetMap tiles via Leaflet.
- **Initial viewport.** Auto-fit to include every visible listing pin plus the school pin. If no listings are visible (e.g. after filtering), center on the school at its default zoom.
- **School pin.** A distinctive teal school/graduation-cap icon at the hardcoded school coordinates, larger than the listing pins.
- **Commute zone.** A faint teal-tinted circle (~15 km radius, approximating a 20-minute drive) centered on the school. Visual context only — not interactive.
- **Listing pins.** Rendered as HTML price-pill markers using Leaflet `DivIcon`. Each pill shows the price as `$NNNk` (or `$N.Nm` for values ≥ $1M) and is styled per the palette below.

### Price-pill palette

Two independent visual channels compose cleanly:

- **Fill** signals favorite status.
  - White fill = regular.
  - **Amber** fill (`#f59e0b`) = favorite.
- **Corner dot** signals proximity to the school.
  - No dot = over 20 minutes or unknown.
  - **Teal** dot (`#14b8a6`) in the top-right corner = under 20 minutes (per the existing `commute_school_car` value parsed by [criteria.ts:67](src/lib/criteria.ts:67)).
- All pills have a neutral grey border (`#94a3b8`) and the same rounded shape.

The four visible combinations:

| Fill | Corner dot | Meaning |
|---|---|---|
| white | — | regular, ≥20 min or unknown |
| white | teal | regular, <20 min |
| amber | — | favorite, ≥20 min or unknown |
| amber | teal | favorite, <20 min |

### Marker click

Clicking a pin opens a popup anchored to the pin containing:

- The thumbnail image (`image_url`).
- The price.
- The full address (`full_address`).
- Bedrooms (`bedrooms`).
- The school commute value (`commute_school_car`).
- A **"See full details"** link that sets the selected listing id on the parent page, which opens the existing DetailPanel.

Clicking the map background dismisses the popup.

### Filter bar sync

The existing `FilterBar` filters (type, min price, max price) apply to both views. A listing filtered out of the table is also filtered off the map.

### Listings without coordinates

Listings with `latitude` or `longitude` null are not rendered on the map. A small, unobtrusive note at the bottom of the map shows the count: `"3 listings without coordinates — not shown on map"`. They remain visible in the table.

## Implementation notes

### Schema

New migration `supabase/migrations/XXXX_add_listing_coordinates.sql`:

```sql
alter table public.listings
  add column latitude double precision,
  add column longitude double precision;
```

Both nullable. No default. No index — 58 rows and not queried by coordinate.

### `src/types/listing.ts`

Add `latitude: number | null` and `longitude: number | null` to the `Listing` interface.

### `src/app/api/scrape-centris/route.ts`

In the insert payload at [scrape-centris/route.ts:95](src/app/api/scrape-centris/route.ts:95), add two fields:

```ts
latitude: parsed.lat,
longitude: parsed.lon,
```

The parser at [centris-parser.ts:111](src/lib/centris-parser.ts:111) already returns these values.

### `scripts/backfill-coordinates.ts`

One-off Node script. For each listing where `latitude IS NULL`:

1. Fetch `centris_link` HTML with the same headers the scrape route uses.
2. Run the existing `parseCentrisHtml` to extract lat/lon.
3. Update the row with the returned values.
4. Rate-limit to ~1 request per second to be polite to Centris.
5. Log and skip any listing whose URL 404s or whose page no longer contains the coordinate meta tags.

Run manually once. Does not need to be wired into CI or a route.

### `src/lib/map-config.ts` (new)

Constants centralizing map-related values:

```ts
export const SCHOOL_COORDS: [number, number] = [lat, lng]  // hardcoded
export const COMMUTE_ZONE_KM = 15
export const DEFAULT_CENTER: [number, number] = SCHOOL_COORDS
export const DEFAULT_ZOOM = 10
```

The school's real coordinates will be filled in during implementation by geocoding the existing hardcoded address string (`"Secondary School Leblanc, Terrebonne, QC"` from [commute.ts:3](src/lib/commute.ts:3)) once, then pasting the result as a literal.

### `src/components/MapView.tsx` (new)

Top-level map component. Receives `listings`, `selectedId`, `onSelect(id)`. Renders:

- `<MapContainer>` from `react-leaflet` with tile layer.
- The school pin and the commute circle.
- One `<ListingMarker>` per listing that has both coordinates.
- A count note at the bottom if any listings are missing coordinates.

Dynamically imported from `page.tsx` with `dynamic(() => import('./MapView'), { ssr: false })` because Leaflet requires `window`.

### `src/components/ListingMarker.tsx` (new)

Renders one listing as a `Marker` with a custom `L.DivIcon` whose HTML is a styled `<div>` (Tailwind classes based on the listing's `favorite` and parsed `commute_school_car`). Attaches a `<Popup>` containing `ListingPopup`.

### `src/components/ListingPopup.tsx` (new)

Stateless component displaying thumbnail, price, address, bedrooms, school commute, and a "See full details" button. The button invokes `onSelect(listing.id)` passed down from `MapView`.

### `src/components/ViewToggle.tsx` (new)

Segmented `Table | Map` control. Reads the current view from URL search params, updates the URL on click via Next's router. Wraps the two states in consistent Tailwind button styling.

### `src/app/page.tsx`

1. Read `?view` from `useSearchParams` (or equivalent). Default to `'table'`.
2. Add `<ViewToggle>` to the top-bar row.
3. Render either `<ListingsTable>` or `<MapView>` based on `view`, passing the filtered `listings`, `selectedId`, and `setSelectedId`.
4. The FilterBar and filtering logic stay above this conditional — both views receive the already-filtered list.

### Dependencies

Add to `package.json`:

- `leaflet`
- `react-leaflet`
- `@types/leaflet` (dev)

Leaflet's own CSS (`leaflet/dist/leaflet.css`) is imported once in `MapView.tsx`.

## Out of scope

- Pin clustering. Fine with ~60 listings; revisit if the count grows significantly.
- True routing-based commute zones (isochrones). The circle is a visual approximation only.
- Drawing a custom zone on the map to filter listings.
- Mobile-specific layout. The toggle and map work on narrow screens without special handling.
- Showing the PVM target on the map. Still used for transit commute calculations; not visualized.
- Refreshing coordinates if a listing's address later changes. Coordinates are set once at scrape time, like every other field.
- Persisting the view choice across sessions in any mechanism other than the URL.
