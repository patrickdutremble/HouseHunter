# Undo Delete Listing — Design Spec

## Problem

Deleting a listing is permanent (hard delete). If you delete one by mistake, it's gone forever. We need a way to recover deleted listings.

## Solution: Soft Delete with Trash Page

Instead of permanently removing listings, mark them as deleted. Provide a trash page where deleted listings can be restored or permanently removed.

## 1. Database Change

Add a `deleted_at` column to the `listings` table:

- **Type:** `timestamptz`, nullable, default `null`
- **Meaning:** `null` = active listing, non-null = trashed (timestamp of when it was deleted)
- All existing queries that fetch listings for the main page must filter to `deleted_at IS NULL`
- The `Listing` TypeScript type gets a new field: `deleted_at: string | null`

## 2. Delete Behavior (Main Page)

- The "Delete listing" button in the DetailPanel stays where it is, with the same confirmation dialog
- Instead of calling Supabase `.delete()`, it calls `.update({ deleted_at: new Date().toISOString() })`
- The listing disappears from the main table immediately (local state update)
- The detail panel closes as it does today

## 3. Trash Page (`/trash`)

### Layout
- **Header:** "Trash" title, a "Back to listings" link, and an "Empty trash" button
- **Body:** A list of cards, one per deleted listing
- **Empty state:** A message like "Trash is empty" when there are no deleted items

### Card Contents
Each card shows:
- Listing image (left side)
- Location, price, property type
- Date deleted (formatted, e.g., "Deleted on Apr 15, 2026")
- "Restore" button
- "Permanently delete" button

### Actions
- **Restore:** Calls `.update({ deleted_at: null })` on the listing. Card disappears from trash. Listing reappears on the main page.
- **Permanently delete:** Shows a confirmation dialog ("Permanently delete this listing? This cannot be undone."). On confirm, calls `.delete()` to remove the row from the database. Card disappears from trash.
- **Empty trash:** Shows a confirmation dialog ("Permanently delete all items in trash? This cannot be undone."). On confirm, calls `.delete()` on all trashed listings. All cards disappear.

## 4. Trash Icon (Main Page)

- Located in the bottom-left corner of the main page
- Shows a trash can icon with a badge showing the count of trashed items (e.g., "3")
- Badge is hidden when the count is 0
- Clicking the icon navigates to `/trash`

## 5. Data Flow

### Fetching trashed listings
- The trash page queries `listings` where `deleted_at IS NOT NULL`, ordered by `deleted_at` descending (most recently deleted first)

### Counting trashed listings
- The main page needs a count of trashed items for the badge. This can be a separate lightweight query (count only) or piggyback on the main fetch.

## 6. TypeScript Type Update

Add to the `Listing` interface:
```typescript
deleted_at: string | null
```
