# Mobile PWA Design

**Date:** 2026-04-21
**Status:** Approved — ready for implementation plan

## Goal

Make HouseHunter usable on Android as a capture-first mobile app. The primary job: when Patrick sees a listing in the Centris Android app, he taps Share → HouseHunter → and the listing lands in his database with zero friction and a visible confirmation.

Secondary job: browsing the last ~10 listings on mobile to double-check recent captures and delete mis-captured ones.

**Platform:** Android Chrome PWA. iOS is out of scope for share-target (Safari does not support Web Share Target); iOS users can install the PWA and paste URLs manually.

## Non-Goals

- No editing on mobile (price/status/criteria edits stay on desktop).
- No compare flow on mobile.
- No map view on mobile.
- No offline support / no caching beyond what Chrome does by default.
- No push notifications.
- No custom install button (rely on Chrome's built-in "Add to Home Screen" hint).
- iOS share-target — not supported by Safari, explicitly accepted.

## Architectural Approach

**Separate mobile routes alongside the existing desktop app.** The existing `/` desktop page is untouched; two new routes plus a detail page handle the mobile experience. Mobile users landing on `/` are redirected to `/recent` via a client-side viewport check.

**Why:** the desktop table at `/` is polished and works well. Mixing a completely different mobile layout into the same 300+ line page would double the cognitive load on every future change and risk regressions. Two small new route trees is the lowest-risk way to add mobile support.

## Routes

| Route | Purpose |
|---|---|
| `/share` | PWA share-target landing. Receives `?url=<centris-url>` from Android's share sheet, auto-adds the listing, shows preview card with Undo. |
| `/recent` | Mobile home screen. Paste-URL card at top + list of 10 most recent listings as cards. |
| `/recent/[id]` | Read-only detail view for one listing. Reflowed version of desktop's `DetailPanel`, no editing. |
| `/` (existing) | Unchanged desktop table. Redirects to `/recent` when viewport width is below 768px. |
| `/trash` (existing) | Already works on mobile. Linked from the `/recent` header. |

Navigation model: linear, no tabs or menus. `/share` → `/recent` (via auto-redirect or Done button). `/recent/[id]` → `/recent` (back button).

## The Share-Capture Flow (`/share`)

This is the 90% path.

**1. Android hands us the URL.**
Web App Manifest registers HouseHunter as a share target with `method: "GET"` and `params: { url, text, title }`. Android's share sheet may send the URL in either `url` or `text` depending on the source app. `/share` reads both and takes the first non-empty value.

**2. Page loads and immediately POSTs to `/api/scrape-centris`.**
No changes to the existing scrape endpoint. While waiting, show a skeleton card with pulsing placeholders for thumbnail, address, and price.

**3. Four response cases:**

| Case | UI |
|---|---|
| Success (new listing) | Card fills in with thumbnail, address, price, rooms, commute. Green "✓ Added" badge. "Undo" button bottom-right, live for 5 seconds. Auto-redirects to `/recent` after 5s if user does nothing. |
| Duplicate (HTTP 409) | Card shows existing listing's data with amber "Already saved" badge. No Undo button. "Done" button → `/recent`. |
| Parse error / 5xx | Red card: "Couldn't read this listing" + the raw URL + "Try again" (retries scrape) and "Paste manually" (→ `/recent`). |
| No `?url=` query param | Redirect to `/recent`. |

**4. Undo behavior.**
Tapping Undo calls the existing soft-delete path (same as desktop's `deleteListing` in `useListings`). The undone listing moves to trash, matching desktop semantics. Card collapses into a "Removed" toast, then redirects to `/recent` after 1.5s.

**5. Layout.**
Single full-width card, vertically centered on the viewport. No nav bar, no other UI. The user is here to confirm one thing and leave.

## The Recent Page (`/recent`)

Mobile home screen. Shown when opening the PWA from the home-screen icon, or after `/share` auto-redirects.

**Header (sticky, ~56px):**
- App name "HouseHunter" (left)
- Trash icon with count badge (right) — links to `/trash`

**Paste-URL card (top of body):**
- Full-width URL input with `type="url"`, placeholder "Paste a Centris URL"
- "Paste from clipboard" button — calls `navigator.clipboard.readText()`
- Full-width "Add" button below the input
- Submits to the same `/api/scrape-centris` endpoint. Unlike `/share`, the paste flow does NOT navigate to `/share` — it stays on `/recent` and shows inline feedback just below the Add button: green "Added" on success (recent list refetches), amber "Already saved" on duplicate, red error message on failure. Input clears on success.

**Recent section heading** + **list of 10 most recent listings as cards.**

**Each card:**
- Thumbnail (left, ~80×80, rounded, falls back to placeholder icon if `image_url` is null)
- Right column:
  - Address (1 line, truncated with ellipsis)
  - Price (bold)
  - `Rooms • Bathrooms • Sqft` (compact line)
  - Commute time (1 line, only if available)
  - "Added Xh ago" timestamp (small, grey)
- Tap card body → `/recent/[id]`
- Three-dot menu (top-right) opens a bottom sheet with two actions:
  - **Open on Centris** — opens `listing.url` in a new tab
  - **Delete** — soft-deletes to trash after a one-line confirm ("Move to trash?"). Covers the "missed Undo" case.

**Empty state:** zero listings → "No listings yet — paste a URL above or share one from the Centris app."

**No pagination.** Just the last 10 by `created_at desc`. For more, use desktop.

## The Detail Page (`/recent/[id]`)

Read-only, vertically reflowed version of desktop's `DetailPanel`.

- Back button (top-left) → `/recent`
- Hero thumbnail at top (full width, 16:9)
- Address, price, rooms, bathrooms, sqft, commute, criteria flags, notes, status — stacked vertically, each with a label
- "Open on Centris" button at the bottom (opens `listing.url`)
- No edit controls, no delete (delete lives on the card's three-dot menu)

## PWA Shell

**`public/manifest.json`:**

```json
{
  "name": "HouseHunter",
  "short_name": "HouseHunter",
  "start_url": "/recent",
  "display": "standalone",
  "theme_color": "#000000",
  "background_color": "#000000",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "share_target": {
    "action": "/share",
    "method": "GET",
    "params": { "url": "url", "text": "text", "title": "title" }
  }
}
```

**Icons:** generate three PNGs — 192×192, 512×512, and a 512×512 maskable variant with safe-area padding. Design: **clean elegant white house silhouette on black background**. The maskable variant has extra padding inside the 512×512 canvas so Android's icon masks don't crop the house.

**Service worker** (`public/sw.js`): minimum viable — ~10 lines that claim clients on activation and do nothing else. No offline caching, no background sync. Just enough for Chrome to mark the app as installable.

**`layout.tsx` additions:**
- `<link rel="manifest" href="/manifest.json">`
- `<meta name="theme-color" content="#000000">`
- `<link rel="apple-touch-icon" href="/icon-192.png">` (iOS install fallback)
- Service worker registration in a client component

**Install prompt:** rely entirely on Chrome's built-in "Add to Home Screen" banner. No custom button.

## Mobile Redirect on `/`

Add a `useEffect` to the existing `HomeContent` component in `src/app/page.tsx`:

```tsx
useEffect(() => {
  if (window.matchMedia('(max-width: 767px)').matches) {
    router.replace('/recent')
  }
}, [router])
```

Runs client-side on mount. Desktop users with narrow windows will be redirected — acceptable, they can resize or navigate back. Tailwind's `md` breakpoint (768px) is the threshold.

## File Plan

**New files:**
```
public/
  manifest.json
  icon-192.png
  icon-512.png
  icon-maskable.png
  sw.js
src/app/
  share/page.tsx
  recent/page.tsx
  recent/[id]/page.tsx
src/components/
  ListingCard.tsx          — mobile card used on /recent
  SharePreviewCard.tsx     — the big post-share confirmation card
```

**Modified files (surgical):**
```
src/app/layout.tsx         — manifest link, theme-color, apple-touch-icon, SW registration
src/app/page.tsx           — mobile redirect useEffect
```

Nine new files, two edits. Nothing gets refactored or moved.

## Testing

Unit tests (Vitest + React Testing Library, jsdom):

- `/share` page — three cases: success, duplicate (409), parse error. Mock `/api/scrape-centris`.
- `ListingCard` — renders fields, three-dot menu opens, tapping Delete triggers soft-delete hook.
- `/` mobile redirect — mock narrow viewport via `window.matchMedia`, assert `router.replace('/recent')` fires.
- `/recent` page — renders paste box + empty state + 10-card list; tests the manual paste add path.

Manual acceptance test (cannot be unit-tested):
- Deploy to Vercel, open on Patrick's Android phone, install from Chrome's "Add to Home Screen" prompt.
- From the Centris Android app, tap Share → pick HouseHunter → confirm preview card appears, confirm listing lands in DB, confirm Undo works.
- Test duplicate: share a URL that's already in the DB → confirm "Already saved" card.

## Implementation Sequencing

The implementation plan (next step) should sequence tasks so each commit is independently verifiable:

1. Manifest, icons, service worker, layout wiring — verify installability.
2. `/share` route with mocked scrape response — verify UI states.
3. Wire `/share` to the real scrape API — verify end-to-end on Vercel.
4. `/recent` page + `ListingCard` component — verify list renders.
5. `/recent/[id]` detail page — verify tap-through.
6. Mobile redirect on `/` — verify desktop still works, mobile gets redirected.
7. Manual Android acceptance test.

## Open Questions for Implementation

None at design time. All UX decisions are locked:

- Share flow: auto-add with 5s Undo ✓
- Home screen content: recent-10 feed + paste box ✓
- Delete UX on cards: three-dot menu (not swipe, not visible button) ✓
- Icon design: white house on black ✓
- Install prompt: built-in Chrome only ✓
- iOS: explicitly out of scope for share-target ✓
