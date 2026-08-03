# Mobile "Delete listing" button — design

**Date:** 2026-08-03
**Status:** Approved, ready for implementation plan

## Goal

Let the user move a listing to the trash from the mobile detail screen
(`/recent/[id]`), with a confirmation step before anything is deleted.

Today the only way to trash a listing from mobile is the "⋯ → Delete" menu on
the `/recent` list card. From the detail screen there is no delete at all.

## Scope

One button on one screen, plus its confirmation and error handling. No changes
to the desktop UI, the `/recent` list, the trash screen, or the delete
semantics themselves.

## Behaviour

### The button

Rendered in `src/app/recent/[id]/page.tsx`, immediately after the "Open on
Centris" link at the bottom of the page.

- **Always shown**, including for listings with no `centris_link` — those
  listings exist and still need deleting. The Centris link stays conditional.
- Full width, matching the Centris button's rounded shape and `py-3` height,
  separated by `mt-3`.
- Red border, red text, transparent background (outline style, not solid) — so
  it reads as destructive without competing with the primary Centris action.
- Label: "Delete listing".
- Disabled while a delete is in flight.

### Delete flow

1. Tap → native `confirm('Move this listing to the trash?')`.
   This matches the existing confirmations in `ListingCard` ("Move to trash?")
   and `DetailPanel` ("Move this listing to the trash?").
2. Cancel → nothing happens.
3. OK → `deleteListing(listing.id)` from `useListings()`. This is a **soft
   delete**: it sets `deleted_at`, removing the listing from the main list and
   putting it in Trash, where it can be restored. Identical to every other
   delete in the app.
4. On success → `router.replace('/recent')`.

### Why `replace` and not `back()`

Next.js 16 does not apply the client router cache's staleness rules to
back/forward navigation — it deliberately restores the cached page to preserve
scroll position and avoid layout shift (see
`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/staleTimes.md`).
`router.back()` after a delete could therefore land on a `/recent` list that
still shows the deleted listing.

`router.replace('/recent')` is a forward navigation, so the page re-mounts and
`useListings` re-queries Supabase. It also avoids leaving a detail screen for a
trashed listing in the back history.

The existing "← Back" button at the top of the page keeps its current
`router.back()` behaviour — it is not a destructive action.

This is the one behaviour that unit tests cannot fully prove, since it depends
on real router cache behaviour in a browser. It needs a manual check on a phone
after implementation.

## Error handling

- **Delete fails** (offline, Supabase error — `deleteListing` returns `false`):
  stay on the detail page and show "Couldn't delete — try again" in the
  existing red inline `role="alert"` slot near the top of the page. No
  navigation.
- The page currently holds this alert state as `favoriteError`. Rename it to
  `actionError` and use it for both the favorite toggle and the delete. Two-line
  change, no new UI.
- **Flash of "Listing not found"**: `deleteListing` removes the listing from
  local state, so the page could render its not-found screen for one frame
  before `router.replace` lands. Guard with a `deleting` flag so the current
  content stays on screen until the route changes.
- **Double-tap**: prevented by disabling the button while the delete is in
  flight.

## Files touched

- `src/app/recent/[id]/page.tsx` — the button, handler, `deleting` state, and
  the `favoriteError` → `actionError` rename.
- `src/app/recent/__tests__/detail.test.tsx` — new tests.

No changes to `useListings`; `deleteListing` already does exactly what is
needed.

## Testing

Added to `src/app/recent/__tests__/detail.test.tsx`:

1. The button renders on the detail screen.
2. The button renders for a listing with no `centris_link`.
3. Confirm cancelled → `deleteListing` is never called.
4. Confirm accepted → `deleteListing` called with the listing's id, then
   `router.replace('/recent')`.
5. `deleteListing` returns `false` → "Couldn't delete — try again" is shown and
   no navigation happens.

`window.confirm` is stubbed per test.

Manual check after implementation: on a phone, delete a listing from the detail
screen and confirm the `/recent` list comes back without it, and that the trash
count in the header has gone up.

## Rejected alternatives

- **Custom bottom-sheet confirmation** — nicer looking, but new UI to build and
  test for no functional gain over the native dialog the app already uses
  everywhere else.
- **Two-step "tap again to confirm" button** — no dialog, but easier to
  mis-tap through.
- **Undo toast after deleting** — redundant with the confirmation, and the
  listing is recoverable from Trash anyway.
- **Shared `DeleteListingButton` component** for the detail page and the card
  menu — the card's version is a menu row with entirely different markup, so
  the only shared piece would be the confirmation string.
- **A "⋯" menu in the detail header** mirroring the card — adds a tap, and the
  request was specifically for a button under "Open on Centris".
