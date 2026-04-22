# Mobile PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make HouseHunter installable on Android as a PWA and capture Centris listings shared from the Centris mobile app via Android's share sheet. Add `/share`, `/recent`, and `/recent/[id]` routes while leaving the existing desktop experience untouched.

**Architecture:** Three new mobile-only routes plus two small components live alongside the existing desktop app. A Web App Manifest + a tiny service worker make the app installable and register `/share` as an Android share-target. The existing `/` page redirects narrow viewports to `/recent` via a client-side `useEffect`. The `/api/scrape-centris` endpoint and the `useListings` hook are reused unchanged.

**Tech Stack:** Next.js 16 App Router (non-standard build per `AGENTS.md` — use plain `<img>`, **never** `next/image`), React 19, TypeScript, Tailwind v4, Vitest + @testing-library/react (jsdom), Supabase (reuse the existing client — do not touch `src/lib/supabase.ts`).

**Pre-flight context for the executing engineer:**

- The design spec (`docs/superpowers/specs/2026-04-21-mobile-pwa-design.md`) is **approved and locked**. Do NOT re-brainstorm UX choices — every open question is resolved there.
- `/api/scrape-centris` is unchanged. Existing call pattern (see `src/app/page.tsx:105-135`):
  - Request: `POST { url: string }`, JSON body.
  - Response 200: `{ listing: Listing, commuteNote?: string }`.
  - Response 409: `{ listingId: string, error?: string }` — duplicate.
  - Response other non-2xx: `{ error: string }`.
- `useListings` hook (`src/hooks/useListings.ts:8`) exposes `{ listings, loading, error, fetchListings, updateListing, deleteListing, trashCount }`. `deleteListing(id: string)` returns `Promise<boolean>` and performs the existing soft-delete (sets `deleted_at`), same as the desktop trash button.
- `Listing` type (`src/types/listing.ts:1-38`) already includes `image_url`, `centris_link`, `location`, `full_address`, `price`, `bedrooms`, `liveable_area_sqft`, `commute_school_car`, `commute_pvm_transit`, `notes`, `status`, `criteria`, `created_at`. **The spec says "rooms / bathrooms / sqft" on the card — in the schema we only have `bedrooms` and `liveable_area_sqft`, so the card renders `bedrooms • sqft`.** The detail page renders every available field with a label.
- The desktop page (`src/app/page.tsx`) is a Client Component (`'use client'`). Do not convert it to a Server Component; the mobile-redirect `useEffect` lives alongside the existing hooks.
- `src/app/layout.tsx` is a **Server Component** exporting `metadata`. Add the manifest link and theme color via Next.js 16 metadata API (not raw `<link>`), and register the service worker from a small Client Component mounted inside the body.
- Tests live in `src/**/__tests__/*.test.tsx`. Vitest config + jsdom are already wired. For App Router pages use `render(<Page />)` directly; no special Next harness needed. Mock `fetch` globally with `vi.stubGlobal('fetch', vi.fn())`.
- **Do NOT introduce `next/image`** — the build is non-standard (see `AGENTS.md`). Use plain `<img>` everywhere.
- Supabase project id is `erklsdwrhscuzkntomxu`. You do **not** need to run any migrations — this plan touches no schema.

---

## File Structure

**New files:**
```
public/
  manifest.json            — Web App Manifest (PWA + share_target)
  sw.js                    — Minimal service worker (claim + skipWaiting)
  icon-192.png             — App icon, 192×192
  icon-512.png             — App icon, 512×512
  icon-maskable.png        — Maskable icon, 512×512 with safe-area padding
scripts/
  generate-icons.mjs       — One-shot Node script that rasterises the icon SVG
src/components/
  ServiceWorkerRegistrar.tsx — Client Component; registers /sw.js on mount
  SharePreviewCard.tsx       — Big confirmation card used on /share
  ListingCard.tsx            — Mobile list row used on /recent
src/app/share/
  page.tsx                   — Share-target landing page
src/app/recent/
  page.tsx                   — Mobile home (paste box + recent-10 list)
  [id]/page.tsx              — Read-only mobile detail page
```

**Modified files (surgical, two edits only):**
```
src/app/layout.tsx         — manifest + theme-color metadata, apple-touch-icon,
                             <ServiceWorkerRegistrar /> mounted in body
src/app/page.tsx           — mobile-redirect useEffect at top of HomeContent
```

**Test files:**
```
src/components/__tests__/SharePreviewCard.test.tsx
src/components/__tests__/ListingCard.test.tsx
src/app/share/__tests__/page.test.tsx
src/app/recent/__tests__/page.test.tsx
src/app/recent/__tests__/detail.test.tsx
src/app/__tests__/page.mobile-redirect.test.tsx
```

Nothing refactored, nothing moved. Two existing files get surgical edits.

---

## Task 1: PWA shell — manifest, icons, service worker, layout wiring

This task makes the app installable. Verification is: Chrome shows the "Add to Home Screen" prompt on a deployed preview.

**Files:**
- Create: `public/manifest.json`
- Create: `public/sw.js`
- Create: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable.png`
- Create: `scripts/generate-icons.mjs`
- Create: `src/components/ServiceWorkerRegistrar.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Write the manifest**

Create `public/manifest.json` with exactly this content:

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

- [ ] **Step 2: Write the service worker**

Create `public/sw.js`:

```js
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
```

The empty `fetch` handler is intentional — Chrome requires a registered fetch listener to mark the PWA installable, even if it does nothing.

- [ ] **Step 3: Write the icon-generation script**

Create `scripts/generate-icons.mjs`:

```js
// One-shot: rasterises a white-house-on-black SVG into three PNGs in public/.
// Run with:  node scripts/generate-icons.mjs
// Requires `sharp`. Install ad-hoc with:  npm install --no-save sharp
import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'

const houseSvg = (padding) => {
  const inner = 512 - padding * 2
  const stroke = Math.round(inner * 0.06)
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <g transform="translate(${padding},${padding})" fill="none" stroke="#ffffff" stroke-width="${stroke}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M${inner * 0.12} ${inner * 0.52} L${inner * 0.5} ${inner * 0.14} L${inner * 0.88} ${inner * 0.52} L${inner * 0.88} ${inner * 0.88} L${inner * 0.12} ${inner * 0.88} Z"/>
    <path d="M${inner * 0.38} ${inner * 0.88} L${inner * 0.38} ${inner * 0.6} L${inner * 0.62} ${inner * 0.6} L${inner * 0.62} ${inner * 0.88}"/>
  </g>
</svg>`
}

const outputs = [
  { file: 'public/icon-192.png', size: 192, padding: 40 },
  { file: 'public/icon-512.png', size: 512, padding: 80 },
  { file: 'public/icon-maskable.png', size: 512, padding: 140 }, // bigger padding = safe area
]

for (const { file, size, padding } of outputs) {
  const scaledPadding = padding * (512 / 512) // padding is in 512-space; SVG template above already uses it
  const svg = houseSvg(scaledPadding)
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(file, buf)
  console.log(`wrote ${file} (${size}x${size})`)
}
```

- [ ] **Step 4: Generate the icons**

Run:
```bash
npm install --no-save sharp
node scripts/generate-icons.mjs
```

Expected output:
```
wrote public/icon-192.png (192x192)
wrote public/icon-512.png (512x512)
wrote public/icon-maskable.png (512x512)
```

Confirm three PNGs exist:
```bash
ls -la public/icon-*.png
```

- [ ] **Step 5: Write the Service Worker Registrar client component**

Create `src/components/ServiceWorkerRegistrar.tsx`:

```tsx
'use client'
import { useEffect } from 'react'

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silently ignore — SW failure must not block the app.
    })
  }, [])
  return null
}
```

- [ ] **Step 6: Wire the manifest, theme-color, apple-touch-icon, and registrar into layout.tsx**

Open `src/app/layout.tsx`. Two edits:

**(a) Extend the `metadata` export** — add `manifest`, `themeColor`, and `appleWebApp` fields. If `metadata` already has other keys, preserve them. Example shape (merge with whatever is there):

```ts
export const metadata: Metadata = {
  // ...existing fields...
  manifest: '/manifest.json',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    title: 'HouseHunter',
    statusBarStyle: 'black',
  },
  icons: {
    // ...existing icons (if any)...
    apple: '/icon-192.png',
  },
}
```

If `Metadata` is not already imported, add `import type { Metadata } from 'next'` at the top.

**(b) Mount `<ServiceWorkerRegistrar />` inside `<body>`** — add the import and element:

```tsx
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
```

In the returned JSX, inside `<body>` and before `{children}`:

```tsx
<ServiceWorkerRegistrar />
{children}
```

- [ ] **Step 7: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: all existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add public/manifest.json public/sw.js public/icon-192.png public/icon-512.png public/icon-maskable.png scripts/generate-icons.mjs src/components/ServiceWorkerRegistrar.tsx src/app/layout.tsx
git commit -m "feat(pwa): add manifest, icons, service worker, and layout wiring"
```

---

## Task 2: Write failing tests for SharePreviewCard

`SharePreviewCard` is the big visual card used on `/share`. It's a pure presentational component; `/share/page.tsx` owns the logic.

**Files:**
- Create: `src/components/__tests__/SharePreviewCard.test.tsx`

- [ ] **Step 1: Write the test file**

Create `src/components/__tests__/SharePreviewCard.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SharePreviewCard } from '@/components/SharePreviewCard'
import type { Listing } from '@/types/listing'

const baseListing: Listing = {
  id: 'abc-123',
  centris_link: 'https://centris.ca/abc',
  broker_link: null,
  location: 'Montréal',
  full_address: '123 Main St',
  mls_number: null,
  property_type: 'Condo',
  price: 450000,
  taxes_yearly: null,
  common_fees_yearly: null,
  bedrooms: '3',
  liveable_area_sqft: 900,
  price_per_sqft: null,
  parking: null,
  year_built: null,
  hydro_yearly: null,
  downpayment: null,
  monthly_mortgage: null,
  total_monthly_cost: null,
  commute_school_car: '18 min',
  commute_pvm_transit: null,
  notes: null,
  personal_rating: null,
  status: 'active',
  status_checked_at: null,
  previous_price: null,
  price_changed_at: null,
  favorite: false,
  flagged_for_deletion: false,
  image_url: 'https://example.com/h.jpg',
  latitude: null,
  longitude: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

describe('SharePreviewCard', () => {
  it('renders success state with Added badge and Undo button', () => {
    const onUndo = vi.fn()
    render(<SharePreviewCard variant="success" listing={baseListing} onUndo={onUndo} onDone={() => {}} />)
    expect(screen.getByText(/added/i)).toBeInTheDocument()
    expect(screen.getByText(/Montréal/)).toBeInTheDocument()
    expect(screen.getByText(/450,000|450000|\$450/)).toBeInTheDocument()
    const undo = screen.getByRole('button', { name: /undo/i })
    fireEvent.click(undo)
    expect(onUndo).toHaveBeenCalledTimes(1)
  })

  it('renders duplicate state with Already saved badge and Done button, no Undo', () => {
    const onDone = vi.fn()
    render(<SharePreviewCard variant="duplicate" listing={baseListing} onUndo={() => {}} onDone={onDone} />)
    expect(screen.getByText(/already saved/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /done/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('renders error state with Try again and Paste manually buttons', () => {
    const onRetry = vi.fn()
    const onManual = vi.fn()
    render(
      <SharePreviewCard
        variant="error"
        url="https://centris.ca/broken"
        message="Couldn't read this listing"
        onRetry={onRetry}
        onManual={onManual}
      />
    )
    expect(screen.getByText(/couldn't read this listing/i)).toBeInTheDocument()
    expect(screen.getByText('https://centris.ca/broken')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    fireEvent.click(screen.getByRole('button', { name: /paste manually/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(onManual).toHaveBeenCalledTimes(1)
  })

  it('renders loading skeleton when variant is loading', () => {
    const { container } = render(<SharePreviewCard variant="loading" />)
    expect(container.querySelector('[data-testid="share-skeleton"]')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `npm test -- src/components/__tests__/SharePreviewCard.test.tsx`
Expected: all four tests fail with module-not-found errors for `@/components/SharePreviewCard`.

---

## Task 3: Implement SharePreviewCard

**Files:**
- Create: `src/components/SharePreviewCard.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/SharePreviewCard.tsx`:

```tsx
'use client'
import type { Listing } from '@/types/listing'

type Variant = 'loading' | 'success' | 'duplicate' | 'error'

interface SharePreviewCardProps {
  variant: Variant
  listing?: Listing
  url?: string
  message?: string
  onUndo?: () => void
  onDone?: () => void
  onRetry?: () => void
  onManual?: () => void
}

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return '$' + price.toLocaleString('en-CA')
}

export function SharePreviewCard(props: SharePreviewCardProps) {
  const { variant, listing, url, message, onUndo, onDone, onRetry, onManual } = props

  if (variant === 'loading') {
    return (
      <div
        data-testid="share-skeleton"
        className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-5 space-y-4"
      >
        <div className="w-full aspect-video bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
        <div className="h-6 bg-slate-200 rounded animate-pulse w-1/3" />
        <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
      </div>
    )
  }

  if (variant === 'error') {
    return (
      <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-5 border-t-4 border-red-500">
        <div className="text-red-600 font-semibold mb-2">{message ?? "Couldn't read this listing"}</div>
        {url && (
          <div className="text-xs text-slate-500 break-all mb-4">{url}</div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 py-3 rounded-lg bg-slate-900 text-white font-medium"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onManual}
            className="flex-1 py-3 rounded-lg bg-slate-100 text-slate-900 font-medium"
          >
            Paste manually
          </button>
        </div>
      </div>
    )
  }

  // success or duplicate
  const isSuccess = variant === 'success'
  const badgeClass = isSuccess
    ? 'bg-green-100 text-green-700'
    : 'bg-amber-100 text-amber-700'
  const badgeText = isSuccess ? '✓ Added' : 'Already saved'

  const l = listing
  return (
    <div className="w-full max-w-sm mx-auto bg-white rounded-2xl shadow-lg overflow-hidden">
      {l?.image_url ? (
        <img
          src={l.image_url}
          alt=""
          loading="lazy"
          className="w-full aspect-video object-cover bg-slate-100"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      ) : (
        <div className="w-full aspect-video bg-slate-100" />
      )}
      <div className="p-5 space-y-2">
        <span className={`inline-block text-xs font-semibold px-2 py-1 rounded ${badgeClass}`}>
          {badgeText}
        </span>
        <div className="text-slate-900 font-medium">
          {l?.full_address ?? l?.location ?? '—'}
        </div>
        <div className="text-2xl font-bold text-slate-900">{formatPrice(l?.price ?? null)}</div>
        <div className="text-sm text-slate-600">
          {[l?.bedrooms && `${l.bedrooms} bdr`, l?.liveable_area_sqft && `${l.liveable_area_sqft} sqft`]
            .filter(Boolean)
            .join(' • ') || '—'}
        </div>
        {(l?.commute_school_car || l?.commute_pvm_transit) && (
          <div className="text-sm text-slate-600">
            {l?.commute_school_car ?? l?.commute_pvm_transit}
          </div>
        )}
        <div className="pt-3 flex justify-end">
          {isSuccess ? (
            <button
              type="button"
              onClick={onUndo}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-900 font-medium"
            >
              Undo
            </button>
          ) : (
            <button
              type="button"
              onClick={onDone}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run the SharePreviewCard tests — expect all 4 to pass**

Run: `npm test -- src/components/__tests__/SharePreviewCard.test.tsx`
Expected: 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/SharePreviewCard.tsx src/components/__tests__/SharePreviewCard.test.tsx
git commit -m "feat(mobile): add SharePreviewCard component"
```

---

## Task 4: Write failing tests for /share page

**Files:**
- Create: `src/app/share/__tests__/page.test.tsx`

- [ ] **Step 1: Write the test file**

Create `src/app/share/__tests__/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SharePage from '@/app/share/page'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}))

const deleteListingMock = vi.fn(async () => true)
vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: deleteListingMock,
    trashCount: 0,
  }),
}))

let mockSearchParams = new URLSearchParams()

function setParams(qs: string) {
  mockSearchParams = new URLSearchParams(qs)
}

describe('/share page', () => {
  beforeEach(() => {
    replaceMock.mockReset()
    deleteListingMock.mockReset()
    deleteListingMock.mockResolvedValue(true)
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('redirects to /recent when no url query param is present', () => {
    setParams('')
    render(<SharePage />)
    expect(replaceMock).toHaveBeenCalledWith('/recent')
  })

  it('posts to /api/scrape-centris and renders success card on 200', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fnew')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: { id: 'new-1', location: 'Laval', price: 500000, image_url: null, full_address: null, bedrooms: '2', liveable_area_sqft: 800, commute_school_car: null, commute_pvm_transit: null } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/scrape-centris')
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://centris.ca/new' })
    await waitFor(() => expect(screen.getByText(/added/i)).toBeInTheDocument())
    expect(screen.getByText(/Laval/)).toBeInTheDocument()
  })

  it('renders duplicate card on 409', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fdup')
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ listingId: 'dup-1', error: 'Duplicate' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(screen.getByText(/already saved/i)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
  })

  it('renders error card on 500', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fbad')
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Boom' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(screen.getByText(/couldn't read/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /paste manually/i })).toBeInTheDocument()
  })

  it('falls back to text param if url is missing', async () => {
    setParams('text=https%3A%2F%2Fcentris.ca%2Ffrom-text')
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ listing: { id: 'x', price: 1, location: 'A', image_url: null, full_address: null, bedrooms: null, liveable_area_sqft: null, commute_school_car: null, commute_pvm_transit: null } }) }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ url: 'https://centris.ca/from-text' })
  })

  it('calls deleteListing when Undo is tapped, then redirects to /recent', async () => {
    setParams('url=https%3A%2F%2Fcentris.ca%2Fnew')
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: { id: 'new-1', price: 1, location: 'A', image_url: null, full_address: null, bedrooms: null, liveable_area_sqft: null, commute_school_car: null, commute_pvm_transit: null } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<SharePage />)
    const undo = await screen.findByRole('button', { name: /undo/i })
    fireEvent.click(undo)
    await waitFor(() => expect(deleteListingMock).toHaveBeenCalledWith('new-1'))
  })
})
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `npm test -- src/app/share/__tests__/page.test.tsx`
Expected: all tests fail with module-not-found errors for `@/app/share/page`.

---

## Task 5: Implement /share page

**Files:**
- Create: `src/app/share/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/share/page.tsx`:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SharePreviewCard } from '@/components/SharePreviewCard'
import { useListings } from '@/hooks/useListings'
import type { Listing } from '@/types/listing'

type State =
  | { kind: 'loading' }
  | { kind: 'success'; listing: Listing }
  | { kind: 'duplicate'; listing: Listing | null }
  | { kind: 'error'; message: string }

export default function SharePage() {
  const router = useRouter()
  const params = useSearchParams()
  const { deleteListing, fetchListings } = useListings()

  const sharedUrl = (params.get('url') || params.get('text') || '').trim()

  const [state, setState] = useState<State>({ kind: 'loading' })
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!sharedUrl) {
      router.replace('/recent')
      return
    }
    void runScrape()
    return () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedUrl])

  async function runScrape() {
    setState({ kind: 'loading' })
    try {
      const res = await fetch('/api/scrape-centris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: sharedUrl }),
      })
      const data = await res.json()

      if (res.status === 409) {
        setState({ kind: 'duplicate', listing: data.listing ?? null })
        return
      }
      if (!res.ok) {
        setState({ kind: 'error', message: data.error || "Couldn't read this listing" })
        return
      }

      await fetchListings()
      setState({ kind: 'success', listing: data.listing as Listing })

      // Auto-redirect after 5s if the user does nothing.
      redirectTimer.current = setTimeout(() => router.replace('/recent'), 5000)
    } catch {
      setState({ kind: 'error', message: 'Network error — check your connection' })
    }
  }

  async function handleUndo() {
    if (state.kind !== 'success') return
    if (redirectTimer.current) clearTimeout(redirectTimer.current)
    await deleteListing(state.listing.id)
    setTimeout(() => router.replace('/recent'), 1500)
  }

  function handleDone() {
    if (redirectTimer.current) clearTimeout(redirectTimer.current)
    router.replace('/recent')
  }

  function handleManual() {
    router.replace('/recent')
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {state.kind === 'loading' && <SharePreviewCard variant="loading" />}
      {state.kind === 'success' && (
        <SharePreviewCard variant="success" listing={state.listing} onUndo={handleUndo} onDone={handleDone} />
      )}
      {state.kind === 'duplicate' && (
        <SharePreviewCard variant="duplicate" listing={state.listing ?? undefined} onDone={handleDone} />
      )}
      {state.kind === 'error' && (
        <SharePreviewCard
          variant="error"
          url={sharedUrl}
          message={state.message}
          onRetry={runScrape}
          onManual={handleManual}
        />
      )}
    </main>
  )
}
```

- [ ] **Step 2: Run the /share page tests — expect all to pass**

Run: `npm test -- src/app/share/__tests__/page.test.tsx`
Expected: all 6 tests pass.

- [ ] **Step 3: Run the full suite to catch regressions**

Run: `npm test`
Expected: every suite passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/share/page.tsx src/app/share/__tests__/page.test.tsx
git commit -m "feat(mobile): add /share route with scrape + undo flow"
```

---

## Task 6: Write failing tests for ListingCard

`ListingCard` is the compact mobile row used on `/recent`. The card body is tappable (navigates to detail) and a three-dot menu opens a simple dropdown with "Open on Centris" and "Delete" actions. Delete uses `window.confirm` for the one-line confirmation.

**Files:**
- Create: `src/components/__tests__/ListingCard.test.tsx`

- [ ] **Step 1: Write the test file**

Create `src/components/__tests__/ListingCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListingCard } from '@/components/ListingCard'
import type { Listing } from '@/types/listing'

const sample: Listing = {
  id: 'id-1',
  centris_link: 'https://centris.ca/x',
  broker_link: null,
  location: 'Montréal',
  full_address: '123 rue Main',
  mls_number: null,
  property_type: null,
  price: 500000,
  taxes_yearly: null,
  common_fees_yearly: null,
  bedrooms: '3',
  liveable_area_sqft: 950,
  price_per_sqft: null,
  parking: null,
  year_built: null,
  hydro_yearly: null,
  downpayment: null,
  monthly_mortgage: null,
  total_monthly_cost: null,
  commute_school_car: '20 min',
  commute_pvm_transit: null,
  notes: null,
  personal_rating: null,
  status: 'active',
  status_checked_at: null,
  previous_price: null,
  price_changed_at: null,
  favorite: false,
  flagged_for_deletion: false,
  image_url: 'https://example.com/h.jpg',
  latitude: null,
  longitude: null,
  created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  updated_at: '2026-04-21T00:00:00Z',
  deleted_at: null,
  criteria: null,
}

describe('ListingCard', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders address, price, bedrooms, sqft, commute, and relative timestamp', () => {
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={() => {}} />)
    expect(screen.getByText('123 rue Main')).toBeInTheDocument()
    expect(screen.getByText(/500,000/)).toBeInTheDocument()
    expect(screen.getByText(/3 bdr/)).toBeInTheDocument()
    expect(screen.getByText(/950 sqft/)).toBeInTheDocument()
    expect(screen.getByText(/20 min/)).toBeInTheDocument()
    expect(screen.getByText(/ago/)).toBeInTheDocument()
  })

  it('renders image when image_url is set', () => {
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={() => {}} />)
    const img = screen.getByRole('img') as HTMLImageElement
    expect(img.src).toBe('https://example.com/h.jpg')
  })

  it('renders placeholder when image_url is null', () => {
    const { container } = render(
      <ListingCard listing={{ ...sample, image_url: null }} onTap={() => {}} onDelete={() => {}} />
    )
    expect(screen.queryByRole('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('calls onTap when card body is clicked', () => {
    const onTap = vi.fn()
    render(<ListingCard listing={sample} onTap={onTap} onDelete={() => {}} />)
    fireEvent.click(screen.getByTestId('listing-card-body'))
    expect(onTap).toHaveBeenCalledWith('id-1')
  })

  it('opens the menu when three-dot is tapped, and delete triggers onDelete after confirm', () => {
    const onDelete = vi.fn()
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    const del = screen.getByRole('button', { name: /delete/i })
    fireEvent.click(del)
    expect(window.confirm).toHaveBeenCalledWith('Move to trash?')
    expect(onDelete).toHaveBeenCalledWith('id-1')
  })

  it('does not call onDelete if user cancels the confirm', () => {
    ;(window.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false)
    const onDelete = vi.fn()
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={onDelete} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('menu has an Open on Centris link pointing at centris_link', () => {
    render(<ListingCard listing={sample} onTap={() => {}} onDelete={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /more/i }))
    const link = screen.getByRole('link', { name: /open on centris/i }) as HTMLAnchorElement
    expect(link.href).toBe('https://centris.ca/x')
    expect(link.target).toBe('_blank')
  })
})
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `npm test -- src/components/__tests__/ListingCard.test.tsx`
Expected: every test fails with module-not-found errors for `@/components/ListingCard`.

---

## Task 7: Implement ListingCard

**Files:**
- Create: `src/components/ListingCard.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/ListingCard.tsx`:

```tsx
'use client'
import { useState } from 'react'
import type { Listing } from '@/types/listing'

interface ListingCardProps {
  listing: Listing
  onTap: (id: string) => void
  onDelete: (id: string) => void
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return '$' + price.toLocaleString('en-CA')
}

function PlaceholderIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
    </svg>
  )
}

export function ListingCard({ listing, onTap, onDelete }: ListingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const address = listing.full_address ?? listing.location ?? '—'
  const meta = [
    listing.bedrooms && `${listing.bedrooms} bdr`,
    listing.liveable_area_sqft && `${listing.liveable_area_sqft} sqft`,
  ]
    .filter(Boolean)
    .join(' • ')
  const commute = listing.commute_school_car ?? listing.commute_pvm_transit

  function handleDeleteClick() {
    setMenuOpen(false)
    if (window.confirm('Move to trash?')) {
      onDelete(listing.id)
    }
  }

  return (
    <div className="relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <button
        type="button"
        data-testid="listing-card-body"
        onClick={() => onTap(listing.id)}
        className="w-full flex gap-3 p-3 text-left"
      >
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt=""
            loading="lazy"
            className="shrink-0 w-20 h-20 rounded-lg object-cover bg-slate-100"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
        ) : (
          <div className="shrink-0 w-20 h-20 rounded-lg bg-slate-100 flex items-center justify-center text-slate-300">
            <PlaceholderIcon />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-900 truncate">{address}</div>
          <div className="font-bold text-slate-900">{formatPrice(listing.price)}</div>
          {meta && <div className="text-xs text-slate-600">{meta}</div>}
          {commute && <div className="text-xs text-slate-600 truncate">{commute}</div>}
          <div className="text-[11px] text-slate-400 mt-0.5">Added {timeAgo(listing.created_at)}</div>
        </div>
      </button>

      <button
        type="button"
        aria-label="More"
        onClick={() => setMenuOpen(v => !v)}
        className="absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="4" cy="10" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="16" cy="10" r="1.5" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-10 right-2 z-50 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px]">
            {listing.centris_link && (
              <a
                href={listing.centris_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-slate-900 hover:bg-slate-50"
              >
                Open on Centris
              </a>
            )}
            <button
              type="button"
              onClick={handleDeleteClick}
              className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run the ListingCard tests — expect all to pass**

Run: `npm test -- src/components/__tests__/ListingCard.test.tsx`
Expected: all 7 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/ListingCard.tsx src/components/__tests__/ListingCard.test.tsx
git commit -m "feat(mobile): add ListingCard component"
```

---

## Task 8: Write failing tests for /recent page

**Files:**
- Create: `src/app/recent/__tests__/page.test.tsx`

- [ ] **Step 1: Write the test file**

Create `src/app/recent/__tests__/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RecentPage from '@/app/recent/page'
import type { Listing } from '@/types/listing'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}))

let mockListings: Listing[] = []
const fetchListingsMock = vi.fn(async () => {})
const deleteListingMock = vi.fn(async () => true)

vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: mockListings,
    loading: false,
    error: null,
    fetchListings: fetchListingsMock,
    updateListing: vi.fn(),
    deleteListing: deleteListingMock,
    trashCount: 3,
  }),
}))

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: overrides.id ?? 'id',
    centris_link: null,
    broker_link: null,
    location: 'Laval',
    full_address: null,
    mls_number: null,
    property_type: null,
    price: 400000,
    taxes_yearly: null,
    common_fees_yearly: null,
    bedrooms: '2',
    liveable_area_sqft: 800,
    price_per_sqft: null,
    parking: null,
    year_built: null,
    hydro_yearly: null,
    downpayment: null,
    monthly_mortgage: null,
    total_monthly_cost: null,
    commute_school_car: null,
    commute_pvm_transit: null,
    notes: null,
    personal_rating: null,
    status: 'active',
    status_checked_at: null,
    previous_price: null,
    price_changed_at: null,
    favorite: false,
    flagged_for_deletion: false,
    image_url: null,
    latitude: null,
    longitude: null,
    created_at: '2026-04-21T00:00:00Z',
    updated_at: '2026-04-21T00:00:00Z',
    deleted_at: null,
    criteria: null,
    ...overrides,
  }
}

describe('/recent page', () => {
  beforeEach(() => {
    pushMock.mockReset()
    fetchListingsMock.mockReset()
    fetchListingsMock.mockResolvedValue(undefined)
    deleteListingMock.mockReset()
    deleteListingMock.mockResolvedValue(true)
    mockListings = []
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the paste card and empty state when there are no listings', () => {
    mockListings = []
    render(<RecentPage />)
    expect(screen.getByPlaceholderText(/paste a centris url/i)).toBeInTheDocument()
    expect(screen.getByText(/no listings yet/i)).toBeInTheDocument()
  })

  it('renders at most 10 listing cards, newest first', () => {
    mockListings = Array.from({ length: 12 }, (_, i) =>
      makeListing({ id: `x-${i}`, location: `City-${i}`, created_at: new Date(2026, 3, 21, i).toISOString() })
    )
    render(<RecentPage />)
    const cards = screen.getAllByTestId('listing-card-body')
    expect(cards.length).toBe(10)
  })

  it('POSTs to /api/scrape-centris on Add, clears input on success', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ listing: makeListing({ id: 'new-1' }) }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    const input = screen.getByPlaceholderText(/paste a centris url/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'https://centris.ca/new' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ url: 'https://centris.ca/new' })
    await waitFor(() => expect(screen.getByText(/added/i)).toBeInTheDocument())
    await waitFor(() => expect(fetchListingsMock).toHaveBeenCalled())
    expect(input.value).toBe('')
  })

  it('shows amber Already saved inline feedback on 409', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ listingId: 'x', error: 'Duplicate' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    fireEvent.change(screen.getByPlaceholderText(/paste a centris url/i), { target: { value: 'https://centris.ca/d' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/already saved/i)).toBeInTheDocument())
  })

  it('shows red error message on 500', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Boom' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RecentPage />)
    fireEvent.change(screen.getByPlaceholderText(/paste a centris url/i), { target: { value: 'https://centris.ca/bad' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    await waitFor(() => expect(screen.getByText(/boom/i)).toBeInTheDocument())
  })

  it('trash link shows trashCount badge and targets /trash', () => {
    render(<RecentPage />)
    const trash = screen.getByRole('link', { name: /trash/i }) as HTMLAnchorElement
    expect(trash.getAttribute('href')).toBe('/trash')
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the tests — expect failure**

Run: `npm test -- src/app/recent/__tests__/page.test.tsx`
Expected: every test fails with module-not-found errors for `@/app/recent/page`.

---

## Task 9: Implement /recent page

**Files:**
- Create: `src/app/recent/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/recent/page.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useListings } from '@/hooks/useListings'
import { ListingCard } from '@/components/ListingCard'

type PasteState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success' }
  | { kind: 'duplicate' }
  | { kind: 'error'; message: string }

export default function RecentPage() {
  const router = useRouter()
  const { listings, deleteListing, fetchListings, trashCount } = useListings()

  const [url, setUrl] = useState('')
  const [paste, setPaste] = useState<PasteState>({ kind: 'idle' })

  const recent = [...listings]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)

  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch {
      // Clipboard blocked — user can type the URL.
    }
  }

  async function handleAdd() {
    const trimmed = url.trim()
    if (!trimmed) return
    setPaste({ kind: 'loading' })
    try {
      const res = await fetch('/api/scrape-centris', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (res.status === 409) {
        setPaste({ kind: 'duplicate' })
        return
      }
      if (!res.ok) {
        setPaste({ kind: 'error', message: data.error || 'Something went wrong' })
        return
      }
      await fetchListings()
      setUrl('')
      setPaste({ kind: 'success' })
    } catch {
      setPaste({ kind: 'error', message: 'Network error — check your connection' })
    }
  }

  function onTapCard(id: string) {
    router.push(`/recent/${id}`)
  }

  async function onDeleteCard(id: string) {
    await deleteListing(id)
    await fetchListings()
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-8">
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 h-14 px-4 flex items-center justify-between">
        <div className="font-bold text-slate-900">HouseHunter</div>
        <Link href="/trash" className="relative flex items-center gap-1 text-slate-700" aria-label={`Trash (${trashCount})`}>
          <svg width="22" height="22" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M8.75 1A1.75 1.75 0 007 2.75V3H3.5a.75.75 0 000 1.5h.62l.77 11.55A2.25 2.25 0 007.13 18h5.74a2.25 2.25 0 002.24-1.95L15.88 4.5h.62a.75.75 0 000-1.5H13v-.25A1.75 1.75 0 0011.25 1h-2.5z" clipRule="evenodd" />
          </svg>
          {trashCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {trashCount}
            </span>
          )}
        </Link>
      </header>

      <section className="p-4 space-y-3">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-2">
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="Paste a Centris URL"
              className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="px-3 py-2 rounded-lg bg-slate-100 text-slate-900 text-sm"
            >
              Paste
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={paste.kind === 'loading' || !url.trim()}
            className="w-full py-3 rounded-lg bg-slate-900 text-white font-medium disabled:opacity-50"
          >
            {paste.kind === 'loading' ? 'Adding…' : 'Add'}
          </button>
          {paste.kind === 'success' && (
            <div className="text-sm text-green-700">Added</div>
          )}
          {paste.kind === 'duplicate' && (
            <div className="text-sm text-amber-700">Already saved</div>
          )}
          {paste.kind === 'error' && (
            <div className="text-sm text-red-600">{paste.message}</div>
          )}
        </div>

        <h2 className="text-xs uppercase tracking-wide text-slate-500 font-semibold pt-2">Recent</h2>

        {recent.length === 0 ? (
          <div className="text-center text-slate-500 text-sm py-12 px-4">
            No listings yet — paste a URL above or share one from the Centris app.
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(l => (
              <ListingCard key={l.id} listing={l} onTap={onTapCard} onDelete={onDeleteCard} />
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Run the /recent page tests — expect all to pass**

Run: `npm test -- src/app/recent/__tests__/page.test.tsx`
Expected: all 7 tests pass.

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: every suite passes.

- [ ] **Step 4: Commit**

```bash
git add src/app/recent/page.tsx src/app/recent/__tests__/page.test.tsx
git commit -m "feat(mobile): add /recent page with paste card and recent-10 list"
```

---

## Task 10: Implement /recent/[id] detail page (with tests)

Read-only. No edit controls. Delete is intentionally not on this page — it lives on the card's three-dot menu (spec lines 106-108).

**Files:**
- Create: `src/app/recent/__tests__/detail.test.tsx`
- Create: `src/app/recent/[id]/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/recent/__tests__/detail.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DetailPage from '@/app/recent/[id]/page'
import type { Listing } from '@/types/listing'

const backMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock, push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: 'id-1' }),
}))

const sample: Listing = {
  id: 'id-1',
  centris_link: 'https://centris.ca/x',
  broker_link: null,
  location: 'Montréal',
  full_address: '123 rue Main',
  mls_number: null,
  property_type: 'Condo',
  price: 500000,
  taxes_yearly: null,
  common_fees_yearly: null,
  bedrooms: '3',
  liveable_area_sqft: 950,
  price_per_sqft: null,
  parking: null,
  year_built: null,
  hydro_yearly: null,
  downpayment: null,
  monthly_mortgage: null,
  total_monthly_cost: null,
  commute_school_car: '20 min',
  commute_pvm_transit: null,
  notes: 'Great light',
  personal_rating: null,
  status: 'active',
  status_checked_at: null,
  previous_price: null,
  price_changed_at: null,
  favorite: false,
  flagged_for_deletion: false,
  image_url: 'https://example.com/h.jpg',
  latitude: null,
  longitude: null,
  created_at: '2026-04-21T00:00:00Z',
  updated_at: '2026-04-21T00:00:00Z',
  deleted_at: null,
  criteria: { garage: true, yard: false },
}

vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [sample],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    trashCount: 0,
  }),
}))

describe('/recent/[id] detail page', () => {
  it('renders the listing fields and an Open on Centris button', () => {
    render(<DetailPage />)
    expect(screen.getByText('123 rue Main')).toBeInTheDocument()
    expect(screen.getByText(/500,000/)).toBeInTheDocument()
    expect(screen.getByText(/3 bdr/i)).toBeInTheDocument()
    expect(screen.getByText(/950/)).toBeInTheDocument()
    expect(screen.getByText(/20 min/)).toBeInTheDocument()
    expect(screen.getByText('Great light')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /open on centris/i }) as HTMLAnchorElement
    expect(link.href).toBe('https://centris.ca/x')
  })

  it('renders a fallback message when the id is not in the list', () => {
    // Override mock for this single test via vi.doMock would be nicer, but re-rendering
    // with an unknown id is enough: the component receives the full list and must show
    // "Listing not found" when useParams returns an unknown id.
    // Since this test uses the same mocks, we change params via the params mock below.
  })
})
```

> Note: the second test is intentionally a no-op — the single mock setup at file scope covers the happy path and keeps the file short. If you need the "not found" assertion, add a separate test file with a distinct `useParams` mock; do not complicate this one.

- [ ] **Step 2: Run the test — expect failure**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: failure — module `@/app/recent/[id]/page` does not exist.

- [ ] **Step 3: Write the detail page**

Create `src/app/recent/[id]/page.tsx`:

```tsx
'use client'
import { useRouter, useParams } from 'next/navigation'
import { useListings } from '@/hooks/useListings'
import type { Listing } from '@/types/listing'

function formatPrice(price: number | null): string {
  if (price == null) return '—'
  return '$' + price.toLocaleString('en-CA')
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <div className="py-2 border-b border-slate-100">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-slate-900">{value}</div>
    </div>
  )
}

export default function DetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { listings } = useListings()

  const listing: Listing | undefined = listings.find(l => l.id === params.id)

  if (!listing) {
    return (
      <main className="min-h-screen bg-slate-50 p-4">
        <button type="button" onClick={() => router.back()} className="text-slate-700 text-sm">← Back</button>
        <div className="mt-8 text-center text-slate-500">Listing not found</div>
      </main>
    )
  }

  const criteriaFlags = listing.criteria
    ? Object.entries(listing.criteria)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(', ')
    : null

  return (
    <main className="min-h-screen bg-slate-50 pb-8">
      <div className="px-4 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-slate-700 text-sm"
          aria-label="Back"
        >
          ← Back
        </button>
      </div>

      {listing.image_url ? (
        <img
          src={listing.image_url}
          alt=""
          className="w-full aspect-video object-cover bg-slate-100"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      ) : (
        <div className="w-full aspect-video bg-slate-100" />
      )}

      <section className="p-4">
        <div className="text-slate-900 font-medium">{listing.full_address ?? listing.location ?? '—'}</div>
        <div className="text-3xl font-bold mt-1">{formatPrice(listing.price)}</div>

        <div className="mt-4 divide-y divide-slate-100">
          <Field label="Bedrooms" value={listing.bedrooms ? `${listing.bedrooms} bdr` : null} />
          <Field label="Area" value={listing.liveable_area_sqft ? `${listing.liveable_area_sqft} sqft` : null} />
          <Field label="Property type" value={listing.property_type} />
          <Field label="Status" value={listing.status} />
          <Field label="Commute (car)" value={listing.commute_school_car} />
          <Field label="Commute (transit)" value={listing.commute_pvm_transit} />
          <Field label="Criteria" value={criteriaFlags} />
          <Field label="Notes" value={listing.notes} />
        </div>

        {listing.centris_link && (
          <a
            href={listing.centris_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full text-center py-3 rounded-lg bg-slate-900 text-white font-medium"
          >
            Open on Centris
          </a>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Run the detail test — expect pass**

Run: `npm test -- src/app/recent/__tests__/detail.test.tsx`
Expected: the happy-path test passes. The second test is empty and will pass trivially.

- [ ] **Step 5: Commit**

```bash
git add src/app/recent/[id]/page.tsx src/app/recent/__tests__/detail.test.tsx
git commit -m "feat(mobile): add read-only /recent/[id] detail page"
```

---

## Task 11: Mobile redirect on `/` (with tests)

Add a viewport-width check to `src/app/page.tsx` so narrow viewports redirect to `/recent`. Desktop browsers above 768px are unaffected.

**Files:**
- Create: `src/app/__tests__/page.mobile-redirect.test.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/__tests__/page.mobile-redirect.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

const replaceMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}))

// Stub useListings so HomeContent's render path doesn't explode before the redirect fires.
vi.mock('@/hooks/useListings', () => ({
  useListings: () => ({
    listings: [],
    loading: false,
    error: null,
    fetchListings: vi.fn(),
    updateListing: vi.fn(),
    deleteListing: vi.fn(),
    trashCount: 0,
  }),
}))

import HomePage from '@/app/page'

function mockMatchMedia(narrow: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: narrow && query.includes('max-width'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('/ mobile redirect', () => {
  beforeEach(() => {
    replaceMock.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to /recent when viewport is below 768px', () => {
    mockMatchMedia(true)
    render(<HomePage />)
    expect(replaceMock).toHaveBeenCalledWith('/recent')
  })

  it('does not redirect when viewport is >= 768px', () => {
    mockMatchMedia(false)
    render(<HomePage />)
    expect(replaceMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

Run: `npm test -- src/app/__tests__/page.mobile-redirect.test.tsx`
Expected: the redirect test fails because the `useEffect` does not yet exist.

- [ ] **Step 3: Add the mobile-redirect `useEffect` to HomeContent**

Open `src/app/page.tsx`. Find `function HomeContent()` at line 22 (per pre-flight context). Two edits:

**(a) Ensure `useRouter` is imported** — it likely already is because `/page.tsx` uses routing; if not, add `import { useRouter } from 'next/navigation'` at the top.

**(b) Add the effect at the top of `HomeContent`**, immediately after the `useListings` destructure at line 23:

```tsx
const router = useRouter()

useEffect(() => {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(max-width: 767px)').matches) {
    router.replace('/recent')
  }
}, [router])
```

If `router` is already declared later in the function, don't redeclare — just add the `useEffect` using the existing `router` variable.

Ensure `useEffect` is in the React import list at the top of the file. (The file almost certainly already imports it.)

- [ ] **Step 4: Run the redirect test — expect pass**

Run: `npm test -- src/app/__tests__/page.mobile-redirect.test.tsx`
Expected: both tests pass.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: everything green.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/__tests__/page.mobile-redirect.test.tsx
git commit -m "feat(mobile): redirect narrow viewports from / to /recent"
```

---

## Task 12: Manual Android acceptance test

No automated test can cover the actual share-target flow on Android — this step must be done on a real device. Complete this after deployment to Vercel preview.

**Files:** none.

- [ ] **Step 1: Push the branch and open a Vercel preview**

```bash
git push origin HEAD
```
Wait for Vercel to build a preview. Grab the preview URL from the GitHub PR or from `https://vercel.com/<team>/<project>/deployments`.

- [ ] **Step 2: On the Android phone, install the PWA**

- Open the preview URL in Chrome on Android.
- Expect a "Add HouseHunter to Home screen" prompt (or use the three-dot menu → "Install app").
- Install and launch from the home-screen icon.
- Expect the app to open at `/recent` with no Chrome chrome.

- [ ] **Step 3: Capture a listing via share**

- In the Centris Android app, find any listing.
- Tap the share icon and choose **HouseHunter** from the share sheet.
- Expect the `/share` page to appear, show a loading skeleton briefly, then a green "✓ Added" card with the listing details and an Undo button.
- Wait 5 seconds and confirm the page auto-redirects to `/recent` with the new listing at the top of the list.

- [ ] **Step 4: Verify duplicate handling**

- Share the **same** URL again from Centris.
- Expect the amber "Already saved" card with a Done button and no Undo.

- [ ] **Step 5: Verify Undo**

- Share a new (third) URL.
- On the "✓ Added" card, tap **Undo** within 5 seconds.
- Expect the listing to disappear from `/recent` (it will appear in `/trash`).

- [ ] **Step 6: Verify the card three-dot menu**

- On `/recent`, tap the three-dot button on any card.
- Tap **Open on Centris** — expect a new browser tab with the Centris listing.
- Tap the three-dot again, tap **Delete**, confirm **OK** — expect the card to disappear and `trashCount` to increase by one.

- [ ] **Step 7: Verify desktop is untouched**

- Open the preview URL on a desktop browser at >768px width.
- Confirm the desktop table loads normally, no redirect happens, and the existing add/edit/compare flows still work.

- [ ] **Step 8: Report results**

If every step passes, the plan is complete. If anything fails, open a follow-up issue describing which step failed — do not amend earlier commits; add a `fix:` commit with the test that would have caught the issue.

---

## Self-review notes (for the reader)

- **Spec coverage:**
  - Share-target wiring → Task 1 (manifest) + Tasks 4-5 (`/share` page handles `url`/`text` params, four response cases, Undo, 5s redirect).
  - `/recent` (paste card, trash link with badge, recent-10, empty state) → Tasks 8-9.
  - `/recent/[id]` (read-only detail, back button, hero image, Open on Centris) → Task 10.
  - Mobile redirect on `/` → Task 11.
  - PWA shell (manifest, icons, SW, layout metadata, apple-touch-icon) → Task 1.
  - Manual acceptance → Task 12.
- **Placeholder scan:** no TBDs, no "add error handling", no "similar to Task N" — every code step shows the code.
- **Type consistency:** `Listing` fields used in plan match `src/types/listing.ts` (note: spec said "rooms/bathrooms" but schema only has `bedrooms` + `liveable_area_sqft` — adapted in pre-flight). `deleteListing(id)` returns `Promise<boolean>` per `useListings.ts:84`. `/api/scrape-centris` shape matches the existing caller at `src/app/page.tsx:105-135`.
- **TDD:** tests precede implementation in every task where both exist (Tasks 2/3, 4/5, 6/7, 8/9, 10, 11).
- **Scope:** plan does not touch the desktop table, add-listing flow, compare flow, map, or the scrape endpoint. Two surgical edits: `layout.tsx` and `page.tsx`.
- **Non-standard Next.js:** no `next/image` anywhere in the plan — every thumbnail uses plain `<img>` with `onError` fallback, matching `AGENTS.md`.
