# Mobile Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the mobile page `/recent` from an add-a-listing screen into a browse screen — every saved listing, a search bar, a favorites-only toggle, favorite stars, and editable notes on the detail page.

**Architecture:** `/recent` keeps using the `useListings` hook (which already fetches every non-deleted listing) and pipes the results through the same two shared helpers the desktop app uses — `filterListings` for search and `applyFilters` for favorites — so mobile and web search behaviour can never drift. The paste-a-URL card is deleted; the touch UI (search input, star toggle) is written mobile-first rather than reusing the dense desktop `FilterBar`.

**Tech Stack:** Next.js 16 (App Router, client components), React 19, TypeScript, Tailwind CSS v4, Supabase JS, Vitest + @testing-library/react (jsdom).

**Spec:** `docs/superpowers/specs/2026-08-02-mobile-browse-design.md`

---

## Background for the implementer

Things that are easy to get wrong here:

- **This is not a stock Next.js.** Per `AGENTS.md`, read `node_modules/next/dist/docs/` before writing anything unusual. Nothing in this plan needs new Next.js APIs — it is all client-side React state inside existing `'use client'` files — so you should not need to.
- **Do not add `useSearchParams`.** `/recent` is not wrapped in `<Suspense>`, and Next.js 16 fails `next build` at prerender if a page uses `useSearchParams` without a Suspense boundary. Filter state stays as plain `useState`.
- **`FavoriteButton` labels itself with `title`, not `aria-label`.** Query it in tests with `getByTitle('Add to favorites')` / `getByTitle('Remove from favorites')`.
- **Never add a `Co-Authored-By` trailer to commits.** (Standing project rule.)
- Run the whole suite with `npm test`. A single file: `npx vitest run <path>`.

## File structure

| File | Responsibility after this plan |
| --- | --- |
| `src/components/ListingCard.tsx` | Mobile list card. Gains an *optional* favorite star; unchanged when the new prop is omitted. |
| `src/app/recent/page.tsx` | Mobile browse screen: header, sticky search + favorites row, full list, two empty states. |
| `src/app/recent/[id]/page.tsx` | Mobile detail screen: adds a favorite star to the top bar and renders `NotesField` in place of the read-only Notes row. |
| `src/components/NotesField.tsx` | Inline-editable Notes control. Tap to edit, save on blur or Done, Escape cancels, empty saves as `null`. |
| `src/components/__tests__/ListingCard.test.tsx` | Card tests, plus star behaviour. |
| `src/components/__tests__/NotesField.test.tsx` | `NotesField` in isolation — placeholder state, and the Escape-then-reopen regression. |
| `src/app/recent/__tests__/page.test.tsx` | Browse-screen tests. Paste-card tests deleted. |
| `src/app/recent/__tests__/detail.test.tsx` | Detail-screen tests, plus star and notes editing. |

No changes to `useListings`, `filterListings`, `applyFilters`, or `FavoriteButton`.

---

## Task 1: Optional favorite star on `ListingCard`

**Files:**
- Modify: `src/components/ListingCard.tsx`
- Test: `src/components/__tests__/ListingCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Append these three tests inside the existing `describe('ListingCard', ...)` block in `src/components/__tests__/ListingCard.test.tsx` (before its closing `})`):

```tsx
  it('renders a favorite star and calls onToggleFavorite without triggering onTap', () => {
    const onToggleFavorite = vi.fn()
    const onTap = vi.fn()
    render(
      <ListingCard
        listing={sample}
        onTap={onTap}
        onDelete={() => {}}
        onToggleFavorite={onToggleFavorite}
      />
    )
    fireEvent.click(screen.getByTitle('Add to favorites'))
    expect(onToggleFavorite).toHaveBeenCalledWith('id-1', true)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('shows the star as pressed and offers removal when already a favorite', () => {
    const onToggleFavorite = vi.fn()
    render(
      <ListingCard
        listing={{ ...sample, favorite: true }}
        onTap={() => {}}
        onDelete={() => {}}
        onToggleFavorite={onToggleFavorite}
      />
    )
    const star = screen.getByTitle('Remove from favorites')
    expect(star).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(star)
    expect(onToggleFavorite).toHaveBeenCalledWith('id-1', false)
  })

  it('renders no star when onToggleFavorite is omitted', () => {
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={() => {}} />)
    expect(screen.queryByTitle('Add to favorites')).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/components/__tests__/ListingCard.test.tsx
```

Expected: the first two tests FAIL (`Unable to find an element with the title: Add to favorites`). TypeScript will also complain that `onToggleFavorite` is not a known prop — that is expected at this step.

- [ ] **Step 3: Add the prop and render the star**

In `src/components/ListingCard.tsx`, add the import next to the existing ones at the top:

```tsx
import { FavoriteButton } from '@/components/FavoriteButton'
```

Extend the props interface:

```tsx
interface ListingCardProps {
  listing: Listing
  onTap: (id: string) => void
  onDelete: (id: string) => void
  onToggleFavorite?: (id: string, next: boolean) => void
}
```

Update the destructuring on the component:

```tsx
export function ListingCard({ listing, onTap, onDelete, onToggleFavorite }: ListingCardProps) {
```

Then, inside the outermost `<div className="relative bg-surface rounded-xl ...">`, insert this block immediately **after** the "More" `<button>` and **before** the `{menuOpen && (` block:

```tsx
      {onToggleFavorite && (
        <div className="absolute bottom-2 right-2 z-50">
          <FavoriteButton
            value={listing.favorite}
            onToggle={() => onToggleFavorite(listing.id, !listing.favorite)}
            size={22}
          />
        </div>
      )}
```

The star is absolutely positioned above the card-body `<button>` with `z-50`, so tapping it does not navigate. Bottom-right keeps it clear of the top-right "More" menu.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/__tests__/ListingCard.test.tsx
```

Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/components/ListingCard.tsx src/components/__tests__/ListingCard.test.tsx
git commit -m "feat(mobile): optional favorite star on ListingCard"
```

---

## Task 2: Show every listing on `/recent`, not just 10

**Files:**
- Modify: `src/app/recent/page.tsx:25-27`
- Test: `src/app/recent/__tests__/page.test.tsx:91-98`

- [ ] **Step 1: Rewrite the failing test**

In `src/app/recent/__tests__/page.test.tsx`, replace this whole test:

```tsx
  it('renders at most 10 listing cards, newest first', () => {
    mockListings = Array.from({ length: 12 }, (_, i) =>
      makeListing({ id: `x-${i}`, location: `City-${i}`, created_at: new Date(2026, 3, 21, i).toISOString() })
    )
    render(<RecentPage />, { wrapper: ThemeProvider })
    const cards = screen.getAllByTestId('listing-card-body')
    expect(cards.length).toBe(10)
  })
```

with:

```tsx
  it('renders every listing, newest first', () => {
    mockListings = Array.from({ length: 12 }, (_, i) =>
      makeListing({ id: `x-${i}`, location: `City-${i}`, created_at: new Date(2026, 3, 21, i).toISOString() })
    )
    render(<RecentPage />, { wrapper: ThemeProvider })
    const cards = screen.getAllByTestId('listing-card-body')
    expect(cards.length).toBe(12)
    // Newest (City-11, created at hour 11) must be first.
    expect(cards[0]).toHaveTextContent('City-11')
    expect(cards[11]).toHaveTextContent('City-0')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx -t "renders every listing"
```

Expected: FAIL — `expected 10 to be 12`.

- [ ] **Step 3: Remove the 10-item cap**

In `src/app/recent/page.tsx`, replace:

```tsx
  const recent = [...listings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
```

with:

```tsx
  const sorted = [...listings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
```

Then update the two places that referenced `recent` further down the file — in the list section, replace:

```tsx
        {recent.length === 0 ? (
```

with:

```tsx
        {sorted.length === 0 ? (
```

and replace:

```tsx
            {recent.map(l => (
```

with:

```tsx
            {sorted.map(l => (
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx
```

Expected: PASS, whole file green.

- [ ] **Step 5: Commit**

```bash
git add src/app/recent/page.tsx src/app/recent/__tests__/page.test.tsx
git commit -m "feat(mobile): show all saved listings instead of the 10 newest"
```

---

## Task 3: Replace the paste-URL card with a search bar

This task deletes the manual URL-paste path from `/recent`. That is intentional — sharing into the PWA (`/share`) and the bookmarklet (`/add-listing`) remain the real add paths, and both still use `/api/scrape-centris` and `lib/extract-centris-url`, so nothing becomes dead code.

**Files:**
- Modify: `src/app/recent/page.tsx`
- Test: `src/app/recent/__tests__/page.test.tsx`

- [ ] **Step 1: Delete the paste-card tests and write the search tests**

In `src/app/recent/__tests__/page.test.tsx`, **delete these five tests entirely**:

1. `it('POSTs to /api/scrape-centris on Add, clears input on success', ...)`
2. `it('shows amber Already saved inline feedback on 409', ...)`
3. `it('shows red error message on 500', ...)`
4. `it('clears the success banner when the user edits the URL input', ...)`
5. `it('shows a server error message when the response is not JSON', ...)`

Then replace this test:

```tsx
  it('renders the paste card and empty state when there are no listings', () => {
    mockListings = []
    render(<RecentPage />, { wrapper: ThemeProvider })
    expect(screen.getByPlaceholderText(/paste a centris url/i)).toBeInTheDocument()
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument()
  })
```

with:

```tsx
  it('renders the search bar and the empty-database state when there are no listings', () => {
    mockListings = []
    render(<RecentPage />, { wrapper: ThemeProvider })
    expect(screen.getByLabelText(/search listings/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/paste a centris url/i)).toBeNull()
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument()
  })
```

And add these two tests inside the same `describe` block:

```tsx
  it('filters cards by the search query across address and notes', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: '123 rue Main', notes: null }),
      makeListing({ id: 'b', full_address: '456 boulevard Cartier', notes: null }),
      makeListing({ id: 'c', full_address: '789 avenue Park', notes: 'near cartier park' }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.change(screen.getByLabelText(/search listings/i), { target: { value: 'cartier' } })
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
    expect(screen.getByText('456 boulevard Cartier')).toBeInTheDocument()
    expect(screen.getByText('789 avenue Park')).toBeInTheDocument()
  })

  it('restores the full list when the clear-search button is tapped', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: '123 rue Main' }),
      makeListing({ id: 'b', full_address: '456 boulevard Cartier' }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    const input = screen.getByLabelText(/search listings/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'cartier' } })
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: /clear search/i }))
    expect(input.value).toBe('')
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
  })
```

Note: `makeListing` defaults `location` to `'Laval'`, which `filterListings` also searches — none of the queries above collide with it.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx
```

Expected: the three new/changed tests FAIL with `Unable to find a label with the text of: /search listings/i`.

- [ ] **Step 3: Remove the paste card and add the search bar**

In `src/app/recent/page.tsx`:

**3a.** Delete the now-unused import:

```tsx
import { extractCentrisUrl } from '@/lib/extract-centris-url'
```

**3b.** Delete the `PasteState` type declaration entirely:

```tsx
type PasteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'duplicate' }
  | { kind: 'error'; message: string }
```

**3c.** Replace the two state declarations:

```tsx
  const [url, setUrl] = useState('')
  const [paste, setPaste] = useState<PasteState>({ kind: 'idle' })
```

with:

```tsx
  const [query, setQuery] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
```

**3d.** Delete both `handlePasteFromClipboard` and `handleAdd` functions in full.

**3e.** Replace `onDeleteCard`, which currently sets paste state, with:

```tsx
  async function onDeleteCard(id: string) {
    const ok = await deleteListing(id)
    if (!ok) {
      setDeleteError("Couldn't delete — try again")
      return
    }
    setDeleteError(null)
    await fetchListings()
  }
```

**3f.** Apply the search filter. Immediately after the `sorted` declaration from Task 2, add:

```tsx
  const searched = filterListings(sorted, query)
```

and add this import next to the other `@/lib` imports at the top:

```tsx
import { filterListings } from '@/lib/search-listings'
```

**3g.** Replace the whole paste-card `<div className="bg-surface rounded-xl shadow-sm border border-border p-4 space-y-2"> ... </div>` block (input, Paste button, Add button, and the success/duplicate/error messages) with the search row. `top-14` matches the `h-14` header height, so the search bar parks directly beneath the header while scrolling:

```tsx
        <div className="relative sticky top-14 z-10 bg-bg py-1 -my-1">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
            placeholder="Search address or notes…"
            aria-label="Search listings"
            className="w-full border border-border-strong rounded-lg pl-3 pr-9 py-2.5 text-sm bg-surface text-fg placeholder:text-fg-subtle"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-fg-subtle"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
          )}
        </div>
        {deleteError && (
          <div className="text-sm text-red-600 dark:text-red-300">{deleteError}</div>
        )}
```

**3h.** Delete the `<h2 ...>Recent</h2>` heading line — the list is no longer "recent".

**3i.** Point the list at the filtered array and update the empty-state copy. Replace:

```tsx
        {sorted.length === 0 ? (
          <div className="text-center text-fg-subtle text-sm py-12 px-4">
            No listings yet — paste a URL above or share one from the Centris app.
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map(l => (
```

with:

```tsx
        {searched.length === 0 ? (
          <div className="text-center text-fg-subtle text-sm py-12 px-4">
            No listings yet — share one from the Centris app.
          </div>
        ) : (
          <div className="space-y-2">
            {searched.map(l => (
```

(Task 4 splits this into two distinct empty states; leaving it single here keeps this task's diff focused.)

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx
```

Expected: PASS, whole file green.

- [ ] **Step 5: Lint and typecheck**

```bash
npm run lint
```

Expected: no errors. (This catches any leftover reference to `url`, `paste`, or `extractCentrisUrl`.)

- [ ] **Step 6: Commit**

```bash
git add src/app/recent/page.tsx src/app/recent/__tests__/page.test.tsx
git commit -m "feat(mobile): replace the paste-URL card with a search bar"
```

---

## Task 4: Favorites-only toggle and the no-match empty state

**Files:**
- Modify: `src/app/recent/page.tsx`
- Test: `src/app/recent/__tests__/page.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these four tests inside the `describe('/recent page', ...)` block in `src/app/recent/__tests__/page.test.tsx`:

```tsx
  it('shows only favorites when the star toggle is on, and all listings when off', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: 'Fav place', favorite: true }),
      makeListing({ id: 'b', full_address: 'Other place', favorite: false }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: /show favorites only/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    expect(screen.getByText('Fav place')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show all listings/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(2)
  })

  it('applies the search query and the favorites toggle together', () => {
    mockListings = [
      makeListing({ id: 'a', full_address: '123 rue Cartier', favorite: true }),
      makeListing({ id: 'b', full_address: '456 rue Cartier', favorite: false }),
      makeListing({ id: 'c', full_address: '789 rue Main', favorite: true }),
    ]
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.change(screen.getByLabelText(/search listings/i), { target: { value: 'cartier' } })
    fireEvent.click(screen.getByRole('button', { name: /show favorites only/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    expect(screen.getByText('123 rue Cartier')).toBeInTheDocument()
  })

  it('shows the no-match state and its Clear button resets both filters', () => {
    mockListings = [makeListing({ id: 'a', full_address: '123 rue Main' })]
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.change(screen.getByLabelText(/search listings/i), { target: { value: 'zzzz' } })
    expect(screen.getByText(/no listings match/i)).toBeInTheDocument()
    expect(screen.queryByText(/no listings yet/i)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^clear$/i }))
    expect(screen.getAllByTestId('listing-card-body').length).toBe(1)
    expect((screen.getByLabelText(/search listings/i) as HTMLInputElement).value).toBe('')
  })

  it('shows the empty-database state, not the no-match state, when nothing is saved', () => {
    mockListings = []
    render(<RecentPage />, { wrapper: ThemeProvider })
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/no listings match/i)).toBeNull()
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx
```

Expected: FAIL — `Unable to find an accessible element with the role "button" and name /show favorites only/i`.

- [ ] **Step 3: Add the toggle, the second filter stage, and both empty states**

In `src/app/recent/page.tsx`:

**3a.** Add the imports next to the other `@/lib` imports:

```tsx
import { applyFilters, EMPTY_FILTERS } from '@/lib/filters'
```

**3b.** Add state next to `query`:

```tsx
  const [favoritesOnly, setFavoritesOnly] = useState(false)
```

**3c.** Add the second filter stage right after `searched`:

```tsx
  const filtered = applyFilters(searched, { ...EMPTY_FILTERS, favoritesOnly })
```

**3d.** Wrap the search input and a new star toggle in a flex row. Replace the **entire** sticky row block written in Task 3 step 3g — from `<div className="relative sticky top-14 ...">` through its closing `</div>` — with this.

Note the `z-[60]`: commit `aa8d3b9` raised both the header and this row from `z-10` so they sit above `ListingCard`'s `z-50` menu and favorite buttons, which otherwise painted over the sticky chrome while scrolling. `z-50` would not be enough — the cards come later in the DOM, so a tie goes to them. Keep `z-[60]`.

```tsx
        <div className="sticky top-14 z-[60] bg-bg py-1 -my-1 flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
              placeholder="Search address or notes…"
              aria-label="Search listings"
              className="w-full border border-border-strong rounded-lg pl-3 pr-9 py-2.5 text-sm bg-surface text-fg placeholder:text-fg-subtle"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-fg-subtle"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setFavoritesOnly(v => !v)}
            aria-pressed={favoritesOnly}
            aria-label={favoritesOnly ? 'Show all listings' : 'Show favorites only'}
            className={`shrink-0 w-11 h-11 flex items-center justify-center rounded-lg border transition-colors ${
              favoritesOnly
                ? 'border-amber-500 text-amber-500 bg-amber-50 dark:bg-amber-900/30'
                : 'border-border-strong text-fg-subtle bg-surface'
            }`}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 20 20"
              fill={favoritesOnly ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 2.5l2.39 4.84 5.34.78-3.86 3.76.91 5.32L10 14.8l-4.78 2.51.91-5.32L2.27 8.12l5.34-.78L10 2.5z" />
            </svg>
          </button>
        </div>
```

**3e.** Replace the single empty state from Task 3 with the two-state version, and render `filtered`:

```tsx
        {listings.length === 0 ? (
          <div className="text-center text-fg-subtle text-sm py-12 px-4">
            No listings yet — share one from the Centris app.
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-fg-subtle text-sm py-12 px-4">
            <div>No listings match</div>
            <button
              type="button"
              onClick={() => { setQuery(''); setFavoritesOnly(false) }}
              className="mt-3 px-4 py-2 rounded-lg bg-surface border border-border-strong text-fg text-sm"
            >
              Clear
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(l => (
              <ListingCard key={l.id} listing={l} onTap={onTapCard} onDelete={onDeleteCard} />
            ))}
          </div>
        )}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx
```

Expected: PASS, whole file green.

- [ ] **Step 5: Commit**

```bash
git add src/app/recent/page.tsx src/app/recent/__tests__/page.test.tsx
git commit -m "feat(mobile): add favorites-only toggle and a no-match empty state"
```

---

## Task 5: Wire the card star to Supabase on `/recent`

**Files:**
- Modify: `src/app/recent/page.tsx`
- Test: `src/app/recent/__tests__/page.test.tsx`

- [ ] **Step 1: Give the test file a named `updateListing` mock**

In `src/app/recent/__tests__/page.test.tsx`, add this next to the other mock declarations near the top (below `const deleteListingMock = ...`):

```tsx
const updateListingMock = vi.fn(async () => true)
```

Change the hook mock's `updateListing` line from `updateListing: vi.fn(),` to:

```tsx
    updateListing: updateListingMock,
```

Add a reset inside the existing `beforeEach`:

```tsx
    updateListingMock.mockReset()
    updateListingMock.mockResolvedValue(true)
```

- [ ] **Step 2: Write the failing test**

Add inside the same `describe` block:

```tsx
  it('tapping a card star writes the favorite flag', async () => {
    mockListings = [makeListing({ id: 'card-1', favorite: false })]
    render(<RecentPage />, { wrapper: ThemeProvider })
    fireEvent.click(screen.getByTitle('Add to favorites'))
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('card-1', 'favorite', true)
    )
  })
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx -t "tapping a card star"
```

Expected: FAIL — `Unable to find an element with the title: Add to favorites`.

- [ ] **Step 4: Pass the handler through**

In `src/app/recent/page.tsx`, pull `updateListing` out of the hook. Change:

```tsx
  const { listings, deleteListing, fetchListings, trashCount } = useListings()
```

to:

```tsx
  const { listings, deleteListing, updateListing, fetchListings, trashCount } = useListings()
```

Add the handler next to `onTapCard`:

```tsx
  function onToggleFavorite(id: string, next: boolean) {
    updateListing(id, 'favorite', next)
  }
```

And pass it to the card:

```tsx
              <ListingCard
                key={l.id}
                listing={l}
                onTap={onTapCard}
                onDelete={onDeleteCard}
                onToggleFavorite={onToggleFavorite}
              />
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/app/recent/__tests__/page.test.tsx
```

Expected: PASS, whole file green.

- [ ] **Step 6: Commit**

```bash
git add src/app/recent/page.tsx src/app/recent/__tests__/page.test.tsx
git commit -m "feat(mobile): toggle favorites from the listing cards"
```

---

## Task 6: Favorite star on the detail page

**Files:**
- Modify: `src/app/recent/[id]/page.tsx`
- Test: `src/app/recent/__tests__/detail.test.tsx`

- [ ] **Step 1: Give the detail test file a named `updateListing` mock**

In `src/app/recent/__tests__/detail.test.tsx`, add above the `vi.mock('@/hooks/useListings', ...)` call:

```tsx
const updateListingMock = vi.fn(async () => true)
```

Change the hook mock's `updateListing: vi.fn(),` line to:

```tsx
    updateListing: updateListingMock,
```

Add resets to the existing `afterEach` block:

```tsx
  updateListingMock.mockReset()
  updateListingMock.mockResolvedValue(true)
```

- [ ] **Step 2: Write the failing test**

Add inside `describe('/recent/[id] detail page', ...)`:

```tsx
  it('has a favorite star that writes the favorite flag', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByTitle('Add to favorites'))
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('id-1', 'favorite', true)
    )
  })
```

Add `waitFor` to the existing `@testing-library/react` import so the line reads:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
npx vitest run src/app/recent/__tests__/detail.test.tsx -t "favorite star"
```

Expected: FAIL — `Unable to find an element with the title: Add to favorites`.

- [ ] **Step 4: Render the star**

In `src/app/recent/[id]/page.tsx`, add the import next to the other component imports:

```tsx
import { FavoriteButton } from '@/components/FavoriteButton'
```

Pull `updateListing` from the hook. Change:

```tsx
  const { listings } = useListings()
```

to:

```tsx
  const { listings, updateListing } = useListings()
```

Then, in the top bar, add the star to the left of `ThemeToggle`. Replace:

```tsx
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserMenu />
        </div>
```

with:

```tsx
        <div className="flex items-center gap-2">
          <FavoriteButton
            value={listing.favorite}
            onToggle={() => updateListing(listing.id, 'favorite', !listing.favorite)}
            size={22}
          />
          <ThemeToggle />
          <UserMenu />
        </div>
```

This top bar sits **after** the `if (!listing) return ...` early return, so `listing` is always defined here.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx vitest run src/app/recent/__tests__/detail.test.tsx
```

Expected: PASS, whole file green.

- [ ] **Step 6: Commit**

```bash
git add src/app/recent/[id]/page.tsx src/app/recent/__tests__/detail.test.tsx
git commit -m "feat(mobile): favorite star on the listing detail page"
```

---

## Task 7: Editable notes on the detail page

**Files:**
- Modify: `src/app/recent/[id]/page.tsx`
- Test: `src/app/recent/__tests__/detail.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add these four tests inside `describe('/recent/[id] detail page', ...)` in `src/app/recent/__tests__/detail.test.tsx`. The mocked listing has `notes: 'Great light'`.

```tsx
  it('opens a textarea when Notes is tapped and saves on blur', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes') as HTMLTextAreaElement
    expect(box.value).toBe('Great light')
    fireEvent.change(box, { target: { value: 'Great light, noisy street' } })
    fireEvent.blur(box)
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('id-1', 'notes', 'Great light, noisy street')
    )
  })

  it('saves an emptied notes field as null', async () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: '   ' } })
    fireEvent.blur(box)
    await waitFor(() =>
      expect(updateListingMock).toHaveBeenCalledWith('id-1', 'notes', null)
    )
  })

  it('Escape cancels the edit without saving', () => {
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: 'discard me' } })
    fireEvent.keyDown(box, { key: 'Escape' })
    fireEvent.blur(box)
    expect(updateListingMock).not.toHaveBeenCalled()
    expect(screen.getByText('Great light')).toBeInTheDocument()
  })

  it('keeps the textarea open and shows an error when the save fails', async () => {
    updateListingMock.mockResolvedValue(false)
    render(<ThemeProvider><DetailPage /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: 'will fail' } })
    fireEvent.blur(box)
    await waitFor(() => expect(screen.getByText(/couldn't save notes/i)).toBeInTheDocument())
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('will fail')
  })
```

Then create `src/components/__tests__/NotesField.test.tsx` for the two tests that exercise the component directly. It imports only `@/components/NotesField`, so it needs **no** `vi.mock` for `next/navigation` or `@/hooks/useListings` — if you find yourself adding one, the component is still coupled to the page and something is wrong.

The shared `sample` always has notes, so the placeholder state needs its own render:

```tsx
  it('renders a tappable placeholder when there are no notes', () => {
    render(<NotesField value={null} onSave={async () => true} />)
    expect(screen.getByText(/add notes…/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notes/i })).toBeInTheDocument()
  })
```

And this regression test, which pins the Escape bug described in Step 3. Note it deliberately fires **no** blur after Escape — that absence is the bug's trigger, so a test that blurs there would pass vacuously:

```tsx
  it('still saves on blur in a later edit after an earlier edit was cancelled with Escape', async () => {
    const onSave = vi.fn(async () => true)
    render(<NotesField value={null} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    fireEvent.keyDown(screen.getByLabelText('Notes'), { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: /notes/i }))
    const box = screen.getByLabelText('Notes')
    fireEvent.change(box, { target: { value: 'keep me' } })
    fireEvent.blur(box)
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('keep me'))
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/app/recent/__tests__/detail.test.tsx
```

Expected: FAIL — `@/components/NotesField` does not exist, and no button named "Notes" exists.

- [ ] **Step 3: Implement `NotesField` and use it**

Create `src/components/NotesField.tsx`, matching the `'use client'` + named-export shape of its siblings (`FavoriteButton.tsx`, `ThemeToggle.tsx`):

```tsx
'use client'

import { useRef, useState } from 'react'

export function NotesField({
  value,
  onSave,
}: {
  value: string | null
  onSave: (next: string | null) => Promise<boolean>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [failed, setFailed] = useState(false)
  // Set when Escape cancels, so the blur that follows does not save.
  const cancelled = useRef(false)

  if (!editing) {
    return (
      <button
        type="button"
        // aria-label overrides the button's text, so fold the note into it —
        // otherwise a screen reader announces "Notes, button" and never the note.
        aria-label={value ? `Notes: ${value}` : 'Notes — add notes'}
        onClick={() => {
          setDraft(value ?? '')
          setFailed(false)
          // Escape unmounts the focused textarea, and Chrome/Safari fire no blur
          // on a removed element — so the flag must be cleared on open, not only
          // in onBlur, or the NEXT edit's blur-save is silently swallowed.
          cancelled.current = false
          setEditing(true)
        }}
        className="w-full text-left py-2 border-b border-border"
      >
        <div className="text-[11px] uppercase tracking-wide text-fg-subtle">Notes</div>
        <div className={value ? 'text-fg whitespace-pre-wrap break-words' : 'text-fg-subtle'}>{value || 'Add notes…'}</div>
      </button>
    )
  }

  const save = async () => {
    const next = draft.trim() === '' ? null : draft
    const ok = await onSave(next)
    if (ok) {
      setEditing(false)
      setFailed(false)
    } else {
      setFailed(true)
    }
  }

  return (
    <div className="py-2 border-b border-border">
      <div className="text-[11px] uppercase tracking-wide text-fg-subtle">Notes</div>
      <textarea
        autoFocus
        aria-label="Notes"
        rows={4}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (cancelled.current) {
            cancelled.current = false
            return
          }
          save()
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            cancelled.current = true
            setFailed(false)
            setEditing(false)
          }
        }}
        className="w-full mt-1 border border-border-strong rounded-lg px-3 py-2 text-sm bg-surface text-fg"
      />
      <button
        type="button"
        // Prevent the textarea's blur from firing a second save before onClick.
        onMouseDown={e => e.preventDefault()}
        onClick={save}
        className="mt-1 px-4 py-2 rounded-lg bg-accent text-accent-fg text-sm font-medium"
      >
        Done
      </button>
      {failed && (
        <div role="alert" className="mt-1 text-sm text-red-600 dark:text-red-300">
          Couldn&apos;t save notes — try again
        </div>
      )}
    </div>
  )
}
```

Then, in `src/app/recent/[id]/page.tsx`, add the import next to the other component imports:

```tsx
import { NotesField } from '@/components/NotesField'
```

and in the field list, replace:

```tsx
          <Field label="Notes" value={listing.notes} />
```

with:

```tsx
          <NotesField
            value={listing.notes}
            onSave={next => updateListing(listing.id, 'notes', next)}
          />
```

`updateListing` is already destructured from the hook in Task 6. Note that `NotesField` keeps its own local `failed` state, deliberately separate from the page-level `favoriteError` Task 6 added — don't merge them into one error slot.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run src/components/__tests__/NotesField.test.tsx src/app/recent/__tests__/detail.test.tsx
```

Expected: PASS, both files green.

- [ ] **Step 5: Commit**

```bash
git add src/components/NotesField.tsx src/components/__tests__/NotesField.test.tsx src/app/recent/[id]/page.tsx src/app/recent/__tests__/detail.test.tsx
git commit -m "feat(mobile): editable notes on the listing detail page"
```

---

## Task 8: Full verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Run the whole test suite**

```bash
npm test
```

Expected: all files pass. Pay attention to `src/app/__tests__/page.mobile-redirect.test.tsx` — it asserts the `/` → `/recent` redirect, which this work does not change.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: build succeeds. This is the check that catches a `useSearchParams`-without-Suspense mistake in Next.js 16 — there should be none, since filter state is plain `useState`.

- [ ] **Step 4: Manual check in the browser**

Start the dev server and open `http://localhost:3000/recent` in a mobile-sized viewport (375×812). Verify:

- The search bar and star toggle sit under the header and stay visible while scrolling.
- All listings render, newest first.
- Typing narrows the list; the "×" clears it.
- The star toggle filters to favorites and the icon fills amber.
- Tapping a card's star (bottom-right) toggles it without navigating; reloading the page keeps the change.
- Tapping the card body still opens the detail page.
- On the detail page: the star toggles; tapping Notes opens a textarea; Done saves; Escape discards.
- **Notes is the last field before the Centris link, so check the Done button is not hidden under the on-screen keyboard.** If it is, move Done up beside the "Notes" label instead of below the textarea. Raised in review; needs a real device or an emulated soft keyboard to settle.
- A multi-line note must redisplay with its line breaks intact.
- Check both light and dark themes.

- [ ] **Step 5: Commit anything the checks turned up**

If steps 1-4 required fixes:

```bash
git add -A
git commit -m "fix(mobile): address verification findings"
```

Otherwise skip this step.
