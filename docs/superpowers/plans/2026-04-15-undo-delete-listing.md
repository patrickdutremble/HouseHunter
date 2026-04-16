# Undo Delete Listing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hard-delete with soft-delete and add a `/trash` page where deleted listings can be restored or permanently removed.

**Architecture:** Add a `deleted_at` column to the `listings` table. The main page filters to active listings (`deleted_at IS NULL`). A new `/trash` page shows soft-deleted listings as cards with restore/permanent-delete actions. A trash icon with a count badge on the main page links to `/trash`.

**Tech Stack:** Next.js (App Router), Supabase (PostgreSQL), React, Tailwind CSS

---

### Task 1: Add `deleted_at` column to the database

**Files:**
- None (SQL migration via Supabase)

- [ ] **Step 1: Run the migration**

Execute this SQL in the Supabase dashboard (SQL Editor) or via the MCP tool:

```sql
ALTER TABLE listings ADD COLUMN deleted_at timestamptz DEFAULT NULL;
```

- [ ] **Step 2: Verify the column exists**

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'listings' AND column_name = 'deleted_at';
```

Expected: one row showing `deleted_at`, `timestamp with time zone`, `YES`.

---

### Task 2: Update TypeScript type

**Files:**
- Modify: `src/types/listing.ts`

- [ ] **Step 1: Add `deleted_at` to the Listing interface**

Add `deleted_at: string | null` after the `updated_at` field in `src/types/listing.ts`:

```typescript
export interface Listing {
  id: string
  centris_link: string | null
  broker_link: string | null
  location: string | null
  full_address: string | null
  mls_number: string | null
  property_type: string | null
  price: number | null
  taxes_yearly: number | null
  common_fees_yearly: number | null
  bedrooms: string | null
  liveable_area_sqft: number | null
  price_per_sqft: number | null
  parking: string | null
  year_built: number | null
  hydro_yearly: number | null
  downpayment: number | null
  monthly_mortgage: number | null
  total_monthly_cost: number | null
  commute_school_car: string | null
  commute_pvm_transit: string | null
  notes: string | null
  personal_rating: string | null
  status: string | null
  favorite: boolean
  image_url: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/listing.ts
git commit -m "feat: add deleted_at field to Listing type"
```

---

### Task 3: Convert hard delete to soft delete and filter main listings

**Files:**
- Modify: `src/hooks/useListings.ts`

- [ ] **Step 1: Add `deleted_at` filter to `fetchListings`**

In `src/hooks/useListings.ts`, update the `fetchListings` function to filter out soft-deleted listings. Change lines 15-17 from:

```typescript
    const { data, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })
```

to:

```typescript
    const { data, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
```

- [ ] **Step 2: Convert `deleteListing` to soft delete**

Replace the `deleteListing` function (lines 70-83) with:

```typescript
  const deleteListing = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('listings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      setError(deleteError.message)
      return false
    }

    setListings(prev => prev.filter(l => l.id !== id))
    return true
  }
```

- [ ] **Step 3: Add `trashCount` state and fetch function**

Add a `trashCount` state and a function to fetch it. After the existing `const [error, setError]` line (line 11), add:

```typescript
  const [trashCount, setTrashCount] = useState(0)
```

After the `fetchListings` function (after line 27), add:

```typescript
  const fetchTrashCount = useCallback(async () => {
    const { count, error: countError } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .not('deleted_at', 'is', null)

    if (!countError && count !== null) {
      setTrashCount(count)
    }
  }, [])
```

Update the `useEffect` (lines 29-31) to also call `fetchTrashCount`:

```typescript
  useEffect(() => {
    fetchListings()
    fetchTrashCount()
  }, [fetchListings, fetchTrashCount])
```

Also call `fetchTrashCount()` at the end of `deleteListing` (after the `setListings` call, before `return true`):

```typescript
    setListings(prev => prev.filter(l => l.id !== id))
    fetchTrashCount()
    return true
```

- [ ] **Step 4: Update the return statement**

Update the return to include `trashCount`:

```typescript
  return { listings, loading, error, trashCount, fetchListings, updateListing, deleteListing }
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useListings.ts
git commit -m "feat: convert hard delete to soft delete, add trash count"
```

---

### Task 4: Add trash icon with badge to the main page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add `trashCount` to the hook destructure**

In `src/app/page.tsx`, update line 10 from:

```typescript
  const { listings, loading, error, fetchListings, updateListing, deleteListing } = useListings()
```

to:

```typescript
  const { listings, loading, error, trashCount, fetchListings, updateListing, deleteListing } = useListings()
```

- [ ] **Step 2: Add the Link import**

Add at the top of the file, after the existing imports:

```typescript
import Link from 'next/link'
```

- [ ] **Step 3: Add the trash icon**

In the return JSX, add a trash icon link just before the closing `</div>` of the outermost wrapper (before the final `</div>` on what is currently line 175). Place it as a fixed-position element:

```tsx
      {/* Trash link */}
      <Link
        href="/trash"
        className="fixed bottom-4 left-4 flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors"
        title="View deleted listings"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
        Trash
        {trashCount > 0 && (
          <span className="ml-0.5 px-1.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
            {trashCount}
          </span>
        )}
      </Link>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add trash icon with count badge to main page"
```

---

### Task 5: Update the delete confirmation message

**Files:**
- Modify: `src/components/DetailPanel.tsx`

- [ ] **Step 1: Update the confirm dialog text**

In `src/components/DetailPanel.tsx`, change line 126 from:

```typescript
            if (confirm('Delete this listing? This cannot be undone.')) {
```

to:

```typescript
            if (confirm('Move this listing to the trash?')) {
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "feat: update delete confirmation to reflect soft delete"
```

---

### Task 6: Create the trash page

**Files:**
- Create: `src/app/trash/page.tsx`

- [ ] **Step 1: Create the trash page component**

Create `src/app/trash/page.tsx`:

```tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Listing } from '@/types/listing'

export default function TrashPage() {
  const [trashedListings, setTrashedListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTrashed = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('listings')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    setTrashedListings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTrashed()
  }, [fetchTrashed])

  const restoreListing = async (id: string) => {
    const { error } = await supabase
      .from('listings')
      .update({ deleted_at: null })
      .eq('id', id)

    if (!error) {
      setTrashedListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const permanentlyDelete = async (id: string) => {
    if (!confirm('Permanently delete this listing? This cannot be undone.')) return

    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id)

    if (!error) {
      setTrashedListings(prev => prev.filter(l => l.id !== id))
    }
  }

  const emptyTrash = async () => {
    if (!confirm(`Permanently delete all ${trashedListings.length} items in trash? This cannot be undone.`)) return

    const ids = trashedListings.map(l => l.id)
    const { error } = await supabase
      .from('listings')
      .delete()
      .in('id', ids)

    if (!error) {
      setTrashedListings([])
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return '—'
    return `$${price.toLocaleString()}`
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">Loading trash...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title="Back to listings"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-slate-800">
              Trash
              {trashedListings.length > 0 && (
                <span className="ml-2 text-sm font-normal text-slate-400">
                  ({trashedListings.length} {trashedListings.length === 1 ? 'item' : 'items'})
                </span>
              )}
            </h1>
          </div>
          {trashedListings.length > 0 && (
            <button
              onClick={emptyTrash}
              className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
            >
              Empty trash
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {trashedListings.length === 0 ? (
          <div className="text-center py-16">
            <svg className="mx-auto mb-3 text-slate-300" width="40" height="40" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
            <p className="text-slate-400 text-sm">Trash is empty</p>
          </div>
        ) : (
          <div className="space-y-3">
            {trashedListings.map(listing => (
              <div
                key={listing.id}
                className="flex items-center gap-4 bg-white rounded-lg border border-slate-200 p-4 shadow-sm"
              >
                {/* Listing image */}
                {listing.image_url ? (
                  <img
                    src={listing.image_url}
                    alt=""
                    className="w-20 h-20 object-cover rounded-lg border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 bg-slate-100 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center">
                    <svg className="text-slate-300" width="24" height="24" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-slate-800 truncate">
                    {listing.location ?? 'Unknown location'}
                  </div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {formatPrice(listing.price)}
                    {listing.property_type && ` \u00B7 ${listing.property_type}`}
                  </div>
                  {listing.deleted_at && (
                    <div className="text-xs text-slate-400 mt-1">
                      Deleted {formatDate(listing.deleted_at)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => restoreListing(listing.id)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => permanentlyDelete(listing.id)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/trash/page.tsx
git commit -m "feat: add trash page with restore and permanent delete"
```

---

### Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test soft delete**

1. Open the app, select a listing, click "Delete listing"
2. Confirm the dialog says "Move this listing to the trash?"
3. Confirm the listing disappears from the table
4. Confirm the trash icon in the bottom-left shows the correct count

- [ ] **Step 3: Test the trash page**

1. Click the trash icon to go to `/trash`
2. Confirm the deleted listing appears as a card with image, location, price, type, and date
3. Click "Restore" on the listing — confirm it disappears from trash
4. Go back to the main page — confirm the listing is back in the table and the trash count decremented

- [ ] **Step 4: Test permanent delete**

1. Delete a listing again from the main page
2. Go to `/trash`, click "Delete" on the listing
3. Confirm the dialog says "Permanently delete this listing? This cannot be undone."
4. Confirm the listing disappears and is gone for good

- [ ] **Step 5: Test empty trash**

1. Delete 2+ listings from the main page
2. Go to `/trash`, click "Empty trash"
3. Confirm the dialog shows the correct count
4. Confirm all listings disappear

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: undo delete listing — soft delete with trash page"
```
