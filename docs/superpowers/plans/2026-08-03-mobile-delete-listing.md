# Mobile Delete Listing Button — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Delete listing" button under "Open on Centris" on the mobile detail screen (`/recent/[id]`) that moves the listing to the trash after a native confirmation dialog.

**Architecture:** Everything lives in the existing page component `src/app/recent/[id]/page.tsx`. The `useListings()` hook already exposes `deleteListing(id)`, which soft-deletes by setting `deleted_at` — no hook changes needed. After a successful delete the page navigates with `router.replace('/recent')` rather than `router.back()`, because Next.js 16 restores back/forward navigations from the client cache and would show a stale list still containing the deleted listing.

**Tech Stack:** Next.js 16.2.2 (App Router, client components), React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library, Supabase.

**Spec:** `docs/superpowers/specs/2026-08-03-mobile-delete-listing-design.md`

---

## File Structure

- **Modify:** `src/app/recent/[id]/page.tsx` — the whole feature: button, confirm handler, `deleting` guard, and renaming the existing `favoriteError` state to `actionError` so the favorite and delete errors share one alert slot.
- **Modify:** `src/app/recent/__tests__/detail.test.tsx` — test scaffolding plus five new tests.

No other files change. `useListings` is untouched.

---

## Task 1: Test scaffolding

The existing test file creates `replace` and `deleteListing` as throwaway `vi.fn()`s inside the mocks, so nothing can assert on them. Lift them to module scope. Also make the mocked listing nullable so a later task can simulate the listing disappearing mid-delete. No behaviour changes in this task.

**Files:**
- Modify: `src/app/recent/__tests__/detail.test.tsx`

- [ ] **Step 1: Add `beforeEach` to the vitest import**

Change line 1 from:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest'
```

to:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
```

- [ ] **Step 2: Lift `replace` to a module-scope mock**

Replace lines 7-12:

```tsx
const backMock = vi.fn()
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, push: pushMock, replace: vi.fn() }),
  useParams: () => ({ id: 'id-1' }),
}))
```

with:

```tsx
const backMock = vi.fn()
const pushMock = vi.fn()
const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, push: pushMock, replace: replaceMock }),
  useParams: () => ({ id: 'id-1' }),
}))
```

- [ ] **Step 3: Add a persistent `window.confirm` spy and reset the new mocks**

Replace the `afterEach` block at lines 14-22:

```tsx
const originalHistory = window.history
afterEach(() => {
  backMock.mockReset()
  pushMock.mockReset()
  Object.defineProperty(window, 'history', { configurable: true, value: originalHistory })
  updateListingMock.mockReset()
  updateListingMock.mockResolvedValue(true)
  mockListing = sample
})
```

with:

```tsx
const originalHistory = window.history
const confirmSpy = vi.spyOn(window, 'confirm')

beforeEach(() => {
  // Default to "OK" — tests that need Cancel override with mockReturnValueOnce(false).
  confirmSpy.mockReturnValue(true)
})

afterEach(() => {
  backMock.mockReset()
  pushMock.mockReset()
  replaceMock.mockReset()
  Object.defineProperty(window, 'history', { configurable: true, value: originalHistory })
  updateListingMock.mockReset()
  updateListingMock.mockResolvedValue(true)
  deleteListingMock.mockReset()
  deleteListingMock.mockResolvedValue(true)
  mockListing = sample
})
```

- [ ] **Step 4: Make the mocked listing nullable and lift `deleteListing`**

Replace lines 64-76:

```tsx
let mockListing: Listing = sample
const updateListingMock = vi.fn(async () => true)
vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [mockListing],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: updateListingMock,
    deleteListing: vi.fn(),
    trashCount: 0,
  }),
}))
```

with:

```tsx
// Nullable so a test can simulate the listing vanishing from local state
// mid-delete, which is what deleteListing does in the real hook.
let mockListing: Listing | null = sample
const updateListingMock = vi.fn(async () => true)
const deleteListingMock = vi.fn(async () => true)
vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: mockListing ? [mockListing] : [],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: updateListingMock,
    deleteListing: deleteListingMock,
    trashCount: 0,
  }),
}))
```

- [ ] **Step 5: Run the suite to confirm nothing broke**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: PASS — all 11 existing tests still pass. This task added no behaviour.

- [ ] **Step 6: Commit**

```bash
git add src/app/recent/__tests__/detail.test.tsx
git commit -m "test: lift router.replace and deleteListing to assertable mocks"
```

---

## Task 2: The button renders

**Files:**
- Modify: `src/app/recent/__tests__/detail.test.tsx`
- Modify: `src/app/recent/[id]/page.tsx:131-140`

- [ ] **Step 1: Write the failing tests**

Add these two tests inside the `describe('/recent/[id] detail page', ...)` block, immediately after the existing `renders the listing fields and an Open on Centris button` test (which ends at line 89):

```tsx
  it('renders a Delete listing button below Open on Centris', () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    const centris = screen.getByRole('link', { name: /open on centris/i })
    const del = screen.getByRole('button', { name: /delete listing/i })
    // Delete must come after Centris in document order.
    expect(centris.compareDocumentPosition(del) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('still renders Delete listing when the listing has no Centris link', () => {
    mockListing = { ...sample, centris_link: null }
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    expect(screen.queryByRole('link', { name: /open on centris/i })).toBeNull()
    expect(screen.getByRole('button', { name: /delete listing/i })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: FAIL — both new tests error with `Unable to find an accessible element with the role "button" and name /delete listing/i`.

- [ ] **Step 3: Add the button**

In `src/app/recent/[id]/page.tsx`, replace the Centris block at lines 131-140:

```tsx
        {listing.centris_link && (
          <a
            href={listing.centris_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full text-center py-3 rounded-lg bg-accent text-accent-fg font-medium hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 transition-colors"
          >
            Open on Centris
          </a>
        )}
```

with:

```tsx
        {/* Wrapper owns the top margin and the gap so the delete button is
            spaced correctly whether or not the Centris link is rendered. */}
        <div className="mt-6 space-y-3">
          {listing.centris_link && (
            <a
              href={listing.centris_link}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 rounded-lg bg-accent text-accent-fg font-medium hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200 transition-colors"
            >
              Open on Centris
            </a>
          )}
          <button
            type="button"
            className="block w-full text-center py-3 rounded-lg border border-red-600 dark:border-red-400 text-red-600 dark:text-red-300 font-medium active:bg-red-50 dark:active:bg-red-900/30 transition-colors"
          >
            Delete listing
          </button>
        </div>
```

Note the `mt-6` was removed from the `<a>` — the wrapper carries it now.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/recent/[id]/page.tsx src/app/recent/__tests__/detail.test.tsx
git commit -m "feat(mobile): add a Delete listing button to the detail screen"
```

---

## Task 3: Confirm, delete, navigate

**Files:**
- Modify: `src/app/recent/__tests__/detail.test.tsx`
- Modify: `src/app/recent/[id]/page.tsx`

- [ ] **Step 1: Write the failing tests**

Add these two tests directly after the two added in Task 2:

```tsx
  it('does not delete when the confirmation is cancelled', () => {
    confirmSpy.mockReturnValueOnce(false)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    expect(window.confirm).toHaveBeenCalledWith('Move this listing to the trash?')
    expect(deleteListingMock).not.toHaveBeenCalled()
    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('deletes and returns to the list when the confirmation is accepted', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    await waitFor(() => expect(deleteListingMock).toHaveBeenCalledWith('id-1'))
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/recent'))
    // replace, not back — back/forward navigation restores Next's cached list.
    expect(backMock).not.toHaveBeenCalled()
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: FAIL — `expected "spy" to be called with arguments: [ 'Move this listing to the trash?' ]`, because the button has no click handler yet.

- [ ] **Step 3: Pull `deleteListing` out of the hook**

In `src/app/recent/[id]/page.tsx`, change line 30 from:

```tsx
  const { listings, updateListing } = useListings()
```

to:

```tsx
  const { listings, updateListing, deleteListing } = useListings()
```

- [ ] **Step 4: Add the delete handler**

In the same file, add this function immediately after the existing `handleToggleFavorite` function (which ends at line 66, just before the `return (`):

```tsx
  const handleDelete = async () => {
    if (!window.confirm('Move this listing to the trash?')) return
    await deleteListing(listing.id)
    router.replace('/recent')
  }
```

- [ ] **Step 5: Wire the handler to the button**

Change the button added in Task 2 from:

```tsx
          <button
            type="button"
            className="block w-full text-center py-3 rounded-lg border border-red-600 dark:border-red-400 text-red-600 dark:text-red-300 font-medium active:bg-red-50 dark:active:bg-red-900/30 transition-colors"
          >
```

to:

```tsx
          <button
            type="button"
            onClick={handleDelete}
            className="block w-full text-center py-3 rounded-lg border border-red-600 dark:border-red-400 text-red-600 dark:text-red-300 font-medium active:bg-red-50 dark:active:bg-red-900/30 transition-colors"
          >
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: PASS — 15 tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/recent/[id]/page.tsx src/app/recent/__tests__/detail.test.tsx
git commit -m "feat(mobile): confirm before trashing, then return to the list"
```

---

## Task 4: Handle a failed delete

The page already has an error slot, held in state as `favoriteError`. Rename it to `actionError` and reuse it, rather than adding a second alert.

**Files:**
- Modify: `src/app/recent/__tests__/detail.test.tsx`
- Modify: `src/app/recent/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

Add directly after the two tests from Task 3:

```tsx
  it('shows an error and stays put when the delete fails', async () => {
    deleteListingMock.mockResolvedValue(false)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    await waitFor(() =>
      expect(screen.getByText(/couldn't delete/i)).toBeInTheDocument()
    )
    expect(replaceMock).not.toHaveBeenCalled()
    expect(screen.getByText('123 rue Main')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: FAIL — `Unable to find an element with the text: /couldn't delete/i`. `replaceMock` is called even though the delete failed.

- [ ] **Step 3: Rename `favoriteError` to `actionError`**

In `src/app/recent/[id]/page.tsx` there are exactly four occurrences. Change line 31 from:

```tsx
  const [favoriteError, setFavoriteError] = useState<string | null>(null)
```

to:

```tsx
  // Shared by the favorite toggle and the delete button — only one can be
  // in flight at a time, so one slot is enough.
  const [actionError, setActionError] = useState<string | null>(null)
```

Change `handleToggleFavorite` (lines 59-66) from:

```tsx
  const handleToggleFavorite = async () => {
    const ok = await updateListing(listing.id, 'favorite', !listing.favorite)
    if (!ok) {
      setFavoriteError("Couldn't update favorite — try again")
      return
    }
    setFavoriteError(null)
  }
```

to:

```tsx
  const handleToggleFavorite = async () => {
    const ok = await updateListing(listing.id, 'favorite', !listing.favorite)
    if (!ok) {
      setActionError("Couldn't update favorite — try again")
      return
    }
    setActionError(null)
  }
```

And change the alert block (lines 91-93) from:

```tsx
      {favoriteError && (
        <div role="alert" className="px-4 text-sm text-red-600 dark:text-red-300">{favoriteError}</div>
      )}
```

to:

```tsx
      {actionError && (
        <div role="alert" className="px-4 text-sm text-red-600 dark:text-red-300">{actionError}</div>
      )}
```

- [ ] **Step 4: Make the delete handler check the result**

Change `handleDelete` from:

```tsx
  const handleDelete = async () => {
    if (!window.confirm('Move this listing to the trash?')) return
    await deleteListing(listing.id)
    router.replace('/recent')
  }
```

to:

```tsx
  const handleDelete = async () => {
    if (!window.confirm('Move this listing to the trash?')) return
    setActionError(null)
    const ok = await deleteListing(listing.id)
    if (!ok) {
      setActionError("Couldn't delete — try again")
      return
    }
    router.replace('/recent')
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: PASS — 16 tests. The existing favorite-error tests still pass: the rename changed only the variable name, not the message text.

- [ ] **Step 6: Commit**

```bash
git add src/app/recent/[id]/page.tsx src/app/recent/__tests__/detail.test.tsx
git commit -m "feat(mobile): surface an error when trashing a listing fails"
```

---

## Task 5: No "Listing not found" flash, no double-tap

`deleteListing` drops the listing from the hook's local state as soon as it succeeds. That re-renders this page before `router.replace` lands, and `listings.find(...)` now returns `undefined` — so the page would flash its "Listing not found" screen. A `deleting` flag suppresses that, and doubles as the disabled state for the button.

**Files:**
- Modify: `src/app/recent/__tests__/detail.test.tsx`
- Modify: `src/app/recent/[id]/page.tsx`

- [ ] **Step 1: Write the failing tests**

Add directly after the test from Task 4:

```tsx
  it('does not flash "Listing not found" while the delete is in flight', async () => {
    // Mirror the real hook: a successful delete removes the listing from state.
    deleteListingMock.mockImplementation(async () => {
      mockListing = null
      return true
    })
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /delete listing/i }))
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/recent'))
    expect(screen.queryByText(/listing not found/i)).toBeNull()
  })

  it('disables the delete button while the delete is in flight', async () => {
    let release: (v: boolean) => void = () => {}
    deleteListingMock.mockImplementation(() => new Promise<boolean>(r => { release = r }))
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    const del = screen.getByRole('button', { name: /delete listing/i })
    fireEvent.click(del)
    await waitFor(() => expect(del).toBeDisabled())
    release(true)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: FAIL — the first test finds the "Listing not found" text; the second fails on `expected element to be disabled`.

- [ ] **Step 3: Add the `deleting` state**

In `src/app/recent/[id]/page.tsx`, directly below the `actionError` state added in Task 4, add:

```tsx
  const [deleting, setDeleting] = useState(false)
```

- [ ] **Step 4: Guard the not-found branch**

Change the not-found block from:

```tsx
  if (!listing) {
    return (
      <main className="min-h-screen bg-bg p-4">
        <button type="button" onClick={handleBack} className="text-fg-muted text-sm" aria-label="Back">← Back</button>
        <div className="mt-8 text-center text-fg-subtle">Listing not found</div>
      </main>
    )
  }
```

to:

```tsx
  if (!listing) {
    // A successful delete already dropped this listing from local state.
    // Hold a blank screen for the frame or two before router.replace lands
    // rather than flashing "Listing not found".
    if (deleting) return null
    return (
      <main className="min-h-screen bg-bg p-4">
        <button type="button" onClick={handleBack} className="text-fg-muted text-sm" aria-label="Back">← Back</button>
        <div className="mt-8 text-center text-fg-subtle">Listing not found</div>
      </main>
    )
  }
```

- [ ] **Step 5: Set and clear the flag in the handler**

Change `handleDelete` from:

```tsx
  const handleDelete = async () => {
    if (!window.confirm('Move this listing to the trash?')) return
    setActionError(null)
    const ok = await deleteListing(listing.id)
    if (!ok) {
      setActionError("Couldn't delete — try again")
      return
    }
    router.replace('/recent')
  }
```

to:

```tsx
  const handleDelete = async () => {
    if (!window.confirm('Move this listing to the trash?')) return
    setActionError(null)
    setDeleting(true)
    const ok = await deleteListing(listing.id)
    if (!ok) {
      setActionError("Couldn't delete — try again")
      setDeleting(false)
      return
    }
    // Stays true on success — the component unmounts when the route changes.
    router.replace('/recent')
  }
```

- [ ] **Step 6: Disable the button while deleting**

Change the button from:

```tsx
          <button
            type="button"
            onClick={handleDelete}
            className="block w-full text-center py-3 rounded-lg border border-red-600 dark:border-red-400 text-red-600 dark:text-red-300 font-medium active:bg-red-50 dark:active:bg-red-900/30 transition-colors"
          >
```

to:

```tsx
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="block w-full text-center py-3 rounded-lg border border-red-600 dark:border-red-400 text-red-600 dark:text-red-300 font-medium disabled:opacity-50 active:bg-red-50 dark:active:bg-red-900/30 transition-colors"
          >
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: PASS — 18 tests.

- [ ] **Step 8: Commit**

```bash
git add src/app/recent/[id]/page.tsx src/app/recent/__tests__/detail.test.tsx
git commit -m "fix(mobile): suppress the not-found flash and double-tap while deleting"
```

---

## Task 6: Full verification

**Files:** none modified unless something fails.

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — every suite green, including `src/app/__tests__/`, `src/components/__tests__/`, and `src/lib/__tests__/`. Nothing outside the detail page was touched, so any failure here is a regression to investigate before continuing.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors. Watch for an unused-variable error if any `favoriteError` reference was missed in Task 4.

- [ ] **Step 3: Type-check via a production build**

Run: `npm run build`
Expected: build completes. This is the step that catches a `favoriteError`/`actionError` mismatch or a bad `deleteListing` signature.

- [ ] **Step 4: Manual check in the browser**

This is the one thing the tests cannot prove — whether the real Next.js router serves a fresh `/recent` after `replace`.

Start the dev server, open `/recent` in a mobile-sized viewport, tap a listing, scroll to the bottom, tap "Delete listing", accept the dialog. Confirm:
- you land back on the list,
- the deleted listing is **gone from the list** (this is the router-cache behaviour under test),
- the trash count badge in the header went up by one,
- the listing is in `/trash` and can be restored.

If the listing is still visible in the list, the client router cache served a stale page. **Do not apply this pre-emptively — only if the manual check fails.** The fallback is to make `/recent` re-fetch whenever it becomes visible again. In `src/app/recent/page.tsx`, add `useEffect` to the React import on line 4:

```tsx
import { useEffect, useState } from 'react'
```

and add this directly below the `const [actionError, setActionError] = useState<string | null>(null)` line:

```tsx
  // Next.js restores back/forward navigations from its client cache, so this
  // page can come back on screen still holding a listing that was trashed
  // from the detail screen. Re-fetch whenever the tab becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchListings()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchListings])
```

`fetchListings` is already a stable `useCallback` in `useListings`, so this effect subscribes once.

- [ ] **Step 5: Commit any fallback fix**

Only if step 4 required the fallback:

```bash
git add src/app/recent/page.tsx
git commit -m "fix(mobile): refresh the recent list when it regains visibility"
```

---

## Done when

- 18 tests pass in `src/app/recent/__tests__/detail.test.tsx`, full suite green, lint and build clean.
- On a phone-sized viewport, the detail screen shows a red-outlined "Delete listing" button under "Open on Centris" (and shows it for listings with no Centris link), confirms before deleting, and returns to a list that no longer contains the listing.
