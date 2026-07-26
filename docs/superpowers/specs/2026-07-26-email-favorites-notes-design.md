# Include notes in "Email favorites"

**Date:** 2026-07-26
**Status:** Approved design

## Problem

The "Email favorites" menu item currently emails a plain list of Centris links
for every favorited listing. The user's per-listing `Notes` are not included,
so the recipient (the user themselves) loses the context they wrote about each
property.

## Goal

When the user clicks "Email favorites", the generated email body should pair
each favorited listing's Centris link with the contents of its `Notes` field.

## Scope

A single function: `handleEmailFavorites` in
`src/components/UserMenu.tsx`.

No database schema changes, no new query, no backend/API changes. The `notes`
value already exists on the `listings` row alongside `centris_link`.

## Design

### 1. Fetch the notes column

Add `notes` to the existing Supabase `.select()`:

```ts
.from('listings')
.select('centris_link, notes')
.eq('favorite', true)
.is('deleted_at', null)
.not('centris_link', 'is', null)
```

All other query conditions are unchanged.

### 2. Format each entry as link + note

Replace the current `links.join('\n')` body construction. For each row build a
two-line block:

- Line 1: the Centris link.
- Line 2: `Note: <note text>`.
  - If `notes` is null or blank after trimming, the line reads `Note: (none)`.

Separate consecutive listings with a blank line.

Example body:

```
https://centris.ca/...
Note: Great kitchen, but small yard.

https://centris.ca/...
Note: (none)
```

### Unchanged behavior

- Only favorited, non-deleted listings **that have a Centris link** are
  included. A note without a link does not appear — the email is anchored on
  links.
- Subject stays `Favorited listings (N)`, where N is the number of included
  listings.
- The "No favorited listings with Centris links." alert stays when the result
  is empty.
- The email still opens the user's mail client via `mailto:` addressed to the
  user's own email.

## Known limitation

`mailto:` URLs have a practical length ceiling (browsers/OS cap the total URL
around ~2,000 characters). Adding notes consumes that budget faster than links
alone. With a handful of favorites this is a non-issue; a large number of
favorites with long notes could cause the mail client to truncate the body.

Decision: ship as-is. Revisit only if truncation is observed in practice.

## Testing

`UserMenu.tsx` has no existing test file, and the behavior is a `mailto:`
side-effect that is awkward to assert meaningfully in a unit test. Verification
is manual:

1. Favorite 2–3 listings — at least one with a note, one without.
2. Click "Email favorites".
3. Confirm the draft opens with each link followed by its `Note:` line, and
   `Note: (none)` for the listing with no note.
