# Search bar (replaces the Centris URL bar)

**Date:** 2026-08-01
**Status:** Approved design, ready for implementation plan

## Problem

The desktop toolbar's most prominent control is a "Paste a Centris URL…" input plus
Paste/Add buttons that scrape a new listing. Patrick never uses it — listings get
added another way (the Centris bookmarklet). Meanwhile there is no way to find a
specific listing in a growing table. The URL bar's screen real estate is better
spent on a search box.

## Goal

Replace the URL input + Paste + Add + status message with a live search box that
filters the visible listings by address and notes, in both table and map views.

## Non-goals

- No search on the mobile `/recent` page (desktop-only for now; possible follow-up).
- No change to how listings are added (bookmarklet / `/add-listing` route stay as-is).
- No fuzzy matching, ranking, or highlighting — plain case-insensitive substring.
- No server-side query — all listings are already loaded client-side.

## Behavior

- The wide toolbar input becomes a search box, placeholder **"Search address or notes…"**.
- **Live filtering as you type** — no Enter required. Table and map update on each keystroke.
- Match is **case-insensitive substring** against, for each listing:
  - `location`
  - `full_address`
  - `notes`
  (null fields are treated as empty strings and simply don't match.)
- A trailing **✕ clear** button shows inside the box only when it has text. Clicking it,
  or pressing **Esc** while focused, clears the query and restores the full list.
- **No-match state:** when the query is non-empty and nothing matches, the table view
  shows a quiet centered message — `No listings match "<query>"` — instead of an empty
  grid. Map view simply shows no pins (its normal empty behavior).
- Search state is **local component state only** — not persisted to the URL or reloaded.
  Refreshing the page clears the search. (Consistent with keeping the change small.)

## Architecture

All work is in `src/app/page.tsx` (`HomeContent`). No new files required; optionally a
tiny helper for the match predicate if it aids testing.

### Removals

- JSX: the `<input type="url">`, the **Paste** button, the **Add** button, and the
  scrape **status message** span.
- State: `centrisUrl`, `scrapeStatus`, `scrapeMessage`.
- Handlers: `handleScrape`, `handlePaste`.
- Import: `extractCentrisUrl` (and the `ScrapeStatus` type + `statusColor` block).
- The `loading`-skeleton toolbar can stay as-is (generic pulse bars).

> Note: `/api/scrape-centris`, `extractCentrisUrl`, and the bookmarklet are **not**
> touched — they remain available for adding listings. Only this page's UI stops
> calling the scrape endpoint.

### Additions

- State: `const [query, setQuery] = useState('')`.
- Derived list:
  ```ts
  const q = query.trim().toLowerCase()
  const visibleListings = q
    ? listings.filter(l =>
        [l.location, l.full_address, l.notes]
          .some(f => (f ?? '').toLowerCase().includes(q))
      )
    : listings
  ```
- Pass `visibleListings` (instead of `listings`) to **both** `ListingsTable` and `MapView`.
- Search box JSX in the toolbar's left slot: a relatively-positioned wrapper holding the
  `<input>` (flex-1) and, when `query` is non-empty, an absolutely-positioned ✕ button;
  `onKeyDown` clears on `Escape`.
- No-match message: when `view === 'table'` and `visibleListings.length === 0` and
  `q` is non-empty, render the message in place of `<ListingsTable>`.

### What stays correct by construction

`selectedListing` is still looked up from the full `listings` array (by `selectedId`),
so an open detail panel does **not** disappear if the selected listing is filtered out of
the table. Compare selection, view toggle, theme, user menu, and trash link are unchanged.

## Data flow

`useListings()` → `listings` (all) → filter by `query` → `visibleListings` →
`ListingsTable` / `MapView`. `selectedId` → `selectedListing` from full `listings` →
`DetailPanel`.

## Error handling

Minimal: search cannot fail. Null fields coerce to `''`. No network, no async.

## Testing

Add to (or alongside) the existing page tests:

1. Typing a substring of an address filters the table to matching rows.
2. Typing a substring of a note filters to the matching listing.
3. Search is case-insensitive.
4. Clearing (✕ or Esc) restores the full list.
5. A query with no matches shows the "No listings match" message in table view.
6. The selected detail panel stays open even when its listing is filtered out.
7. Regression: the URL input / Paste / Add controls are gone (query by placeholder/role).

## Open follow-ups (not in this change)

- Search on mobile `/recent`.
- Persist query in the URL (`?q=`) if shareable/filtered views become useful.
