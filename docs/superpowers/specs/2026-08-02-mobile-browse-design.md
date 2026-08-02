# Mobile browse: search, favorites filter, and favoriting

**Date:** 2026-08-02
**Status:** Approved

## Problem

The mobile experience (`/recent`, reached by redirect from `/` on viewports ≤767px)
was built only as a way to add listings from the Centris app. It shows a
paste-a-URL card above the 10 most recently added listings. There is no way to
see the rest of the saved listings, no search, no filters, and no way to mark a
listing as a favorite.

Goal: turn `/recent` into a browse screen — see every saved listing, search
them, and filter to favorites.

## Scope

In scope:

- Replace the paste-URL card with a search bar plus a favorites toggle.
- Show all listings instead of the 10 newest.
- Add a favorite star to list cards and to the detail page.
- Make the detail page's Notes field editable.

Out of scope:

- The rest of the web filter set (price, beds, type, commutes, garage, flag
  status). Only favorites is exposed on mobile.
- Sort controls. The list stays newest-first.
- Additional detail-page fields (monthly cost, taxes, price/sqft, downpayment).
- Pagination or virtualization. `useListings` already loads every listing.

## Removing the paste-URL card

The card's input, Paste button, Add button, and its
loading/success/duplicate/error states are deleted, along with the
`handlePasteFromClipboard` / `handleAdd` handlers and the `PasteState` type.

Manual URL pasting is no longer possible on mobile. The two real add paths are
unaffected:

- Sharing a Centris URL into the installed PWA → `/share`
- The bookmarklet → `/add-listing`

`/api/scrape-centris` and `lib/extract-centris-url` remain in use by `/share`,
so nothing becomes orphaned by this removal.

## Page structure — `/recent`

Top to bottom:

1. **Header** — unchanged. "HouseHunter", `ThemeToggle`, `UserMenu`, trash link
   with count badge.
2. **Sticky filter row** — new, sits directly under the header and stays visible
   while scrolling. Contains:
   - A full-width text input, `placeholder="Search address or notes…"`,
     `aria-label="Search listings"`. Shows a clear "×" button when non-empty.
     Escape clears it.
   - A star toggle button to its right, `aria-pressed` reflecting state,
     `aria-label="Show favorites only"` / `"Show all listings"`. Filled amber
     when active, matching `FavoriteButton`'s visual treatment.
3. **List** — every listing that passes the filters, newest first, rendered as
   `ListingCard`. No item cap, no "Recent" heading.

### Empty states

Two distinct states, so the user can tell "nothing saved" from "nothing
matched":

- **No listings at all:** "No listings yet — share one from the Centris app."
  (The old copy mentioned pasting a URL above; that path is gone.)
- **Filters exclude everything:** "No listings match" plus a "Clear" button that
  resets both the query and the favorites toggle.

## Data flow

`useListings()` already selects every non-deleted listing ordered by
`created_at` descending. No query change is needed; only the existing
`.slice(0, 10)` is removed. The page-level newest-first sort is kept so the
page does not silently depend on the hook's ordering.

Filtering mirrors the web app exactly, using the same shared helpers:

```ts
const sorted = [...listings].sort(
  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
)
const searched = filterListings(sorted, query)
const filtered = applyFilters(searched, { ...EMPTY_FILTERS, favoritesOnly })
```

These are plain derived values rather than `useMemo`, matching the existing
style of the file. The lists are small enough that memoization buys nothing.

- `filterListings` (`@/lib/search-listings`) — case-insensitive substring match
  over `location`, `full_address`, and `notes`. Empty query returns the input
  unchanged.
- `applyFilters` (`@/lib/filters`) — with only `favoritesOnly` set, every other
  predicate is inert.

Reusing both functions means mobile search and favorites behave identically to
[src/app/page.tsx](../../../src/app/page.tsx) and cannot drift from it.

Filter state is plain component state (`query: string`,
`favoritesOnly: boolean`). It is deliberately not stored in URL params — there
is no shareable-link requirement on mobile, and `/recent` is not wrapped in
`<Suspense>` today, which `useSearchParams` would require.

## Favoriting

### On list cards

`ListingCard` gains an optional prop:

```ts
onToggleFavorite?: (id: string, next: boolean) => void
```

When the prop is provided, the card renders the existing `FavoriteButton`
(`@/components/FavoriteButton`) in its **bottom-right corner**, positioned
absolutely and outside the card-body `<button>` so tapping the star does not
navigate. Bottom-right keeps it clear of the top-right "More" menu, avoiding
overlapping tap targets on small screens.

When the prop is omitted the card renders exactly as it does today, so no other
consumer of `ListingCard` is affected.

`/recent` passes a handler that calls
`updateListing(id, 'favorite', next)`.

### On the detail page

`/recent/[id]` renders the same `FavoriteButton` in its top bar, to the left of
`ThemeToggle` and `UserMenu`, wired to the same `updateListing` call.

`updateListing` already writes to Supabase and updates local state, so both
surfaces reflect the change immediately and the filter on `/recent` reacts
without a refetch.

## Editable notes on the detail page

The Notes row on `/recent/[id]` becomes tappable.

- When notes are empty the row **still renders** (today `Field` returns `null`
  for empty values), showing placeholder text "Add notes…" in the subtle
  foreground colour so there is something to tap.
- Tapping swaps the displayed text for a `<textarea>` pre-filled with the
  current value, auto-focused.
- **Save:** on blur, or via a "Done" button below the textarea. Calls
  `updateListing(listing.id, 'notes', value)`. An empty string saves as `null`.
- **Cancel:** Escape restores the previous value without saving.
- **Failure:** if `updateListing` returns `false`, an inline red message
  ("Couldn't save notes — try again") appears under the field and the textarea
  stays open with the user's text intact. No silent revert.

This is implemented as a small local component in the detail page rather than
reusing `EditableCell`, which is built for table-cell layout and keyboard
navigation.

## Components touched

| File | Change |
| --- | --- |
| `src/app/recent/page.tsx` | Remove paste card; add filter row, full list, two empty states, favorite handler |
| `src/app/recent/[id]/page.tsx` | Add favorite star to top bar; make Notes editable |
| `src/components/ListingCard.tsx` | Optional `onToggleFavorite` prop renders `FavoriteButton` bottom-right |

No changes to `useListings`, `filterListings`, `applyFilters`, or
`FavoriteButton`.

## Testing

### `src/app/recent/__tests__/page.test.tsx`

Delete the five paste-box tests (`POSTs to /api/scrape-centris…`, `shows amber
Already saved…`, `shows red error message on 500`, `clears the success
banner…`, `shows a server error message when the response is not JSON`) and the
paste-card assertion in the empty-state test.

Replace `renders at most 10 listing cards, newest first` with:

- Renders **all** listings, newest first.
- Typing in the search box narrows the cards to matching address/notes; clearing
  restores the full list.
- The star toggle shows only favorites; toggling off restores the full list.
- A query and the star toggle apply together (intersection).
- When filters exclude everything, the "No listings match" state and its Clear
  button appear, and Clear restores the list.
- The empty-database state renders when there are no listings at all.
- Tapping a card's star calls `updateListing` with `(id, 'favorite', true)`.
- Keep the existing trash-badge and failed-delete tests.

### `src/app/recent/__tests__/detail.test.tsx`

- The star renders and calls `updateListing` with `(id, 'favorite', true)`.
- The Notes row renders with placeholder text when notes are `null`.
- Tapping Notes opens a textarea; blur saves via `updateListing`.
- Escape cancels without calling `updateListing`.
- A failed save shows the inline error and keeps the textarea open.

### `src/components/__tests__/ListingCard.test.tsx`

- With `onToggleFavorite`, a star renders and clicking it calls the handler
  without triggering `onTap`.
- Without the prop, no star renders.
