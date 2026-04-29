# Migrate `<img>` → `next/image` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 9 raw `<img>` tags loading Centris-hosted images with `next/image` to get automatic WebP/AVIF conversion, responsive resizing, and lazy-loading — improving mobile LCP.

**Architecture:** Add `mspublic.centris.ca` to `next.config.ts` `images.remotePatterns`. For each `<img>`: small fixed-size thumbnails get explicit `width`/`height` props; full-width / aspect-ratio images get `fill` mode inside their already-sized container with a `sizes` hint. Existing `onError` fallback behavior is preserved. The two clear LCP candidates (single-listing detail page, comparison-grid first row) get `preload`.

**Tech Stack:** Next.js 16 (`next/image`), React 19, Tailwind CSS, Vitest + @testing-library/react.

**Verification model:** This is a UI migration with no behavior changes. Per task, the verification is: (a) Vitest passes for any updated tests, (b) `npm run build` succeeds, (c) the page renders the image correctly in the dev server (eyeball via preview tools). Classical TDD doesn't apply — there is no new behavior to test-drive.

**Out of scope:** Self-uploaded images (`AddListingClient` later phases that allow user uploads), favicon, OG metadata images.

---

## File Structure

Files to modify (no new files needed):

| Path | Reason |
|------|--------|
| `next.config.ts` | Add `images.remotePatterns` for Centris hostname |
| `src/components/LocationCell.tsx` | 44×36 fixed thumbnail in table cell |
| `src/components/ListingCard.tsx` | 80×80 fixed thumbnail in mobile card |
| `src/components/ListingPopup.tsx` | 224×112 image in map popup |
| `src/components/DetailPanel.tsx` | Full-width × 192 image in side panel |
| `src/components/SharePreviewCard.tsx` | Full-width aspect-video share card |
| `src/app/add-listing/AddListingClient.tsx` | Full-width × 160 success preview |
| `src/app/trash/page.tsx` | 80×80 fixed thumbnail in trash list |
| `src/app/recent/[id]/page.tsx` | Full-width aspect-video detail hero (LCP) |
| `src/app/compare/page.tsx` | Full-width × 180 comparison grid images |
| `src/components/__tests__/ListingCard.test.tsx` | Tests assert `img.src` equality — needs to use `toContain` |
| `src/components/__tests__/LocationCell.test.tsx` | Same |
| `src/components/__tests__/ListingPopup.test.tsx` | Same |

---

## Task 1: Configure `next/image` for Centris images

**Files:**
- Modify: `next.config.ts`

**Why this task:** Without allowlisting `mspublic.centris.ca`, `<Image>` will refuse to load Centris URLs and return a 400. Also, Next.js 16 requires `qualities` to be configured if anything other than the default `[75]` is used — we'll declare `[75]` explicitly to make the constraint visible.

- [ ] **Step 1: Read current config**

Run: `cat next.config.ts`

Expected current contents:
```ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
});
```

- [ ] **Step 2: Add images config**

Replace the `nextConfig` object with:

```ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mspublic.centris.ca',
        pathname: '/**',
        // Centris serves images through media.ashx with required ?id=&t=&w=&h=&sm= query params,
        // so we cannot lock `search` to ''. The pathname allowlist is the security boundary.
      },
    ],
    qualities: [75],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2678400, // 31 days — Centris image URLs include hashes, safe to cache long
  },
};
```

- [ ] **Step 3: Verify the build still succeeds**

Run: `npm run build`
Expected: build completes without "Invalid src prop" or config-validation errors.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "feat(images): allowlist Centris hostname for next/image optimization"
```

---

## Task 2: Make existing tests tolerant of `next/image` URL rewriting

**Files:**
- Modify: `src/components/__tests__/ListingCard.test.tsx:67`
- Modify: `src/components/__tests__/LocationCell.test.tsx:46`
- Modify: `src/components/__tests__/ListingPopup.test.tsx:61`

**Why this task:** `next/image` rewrites `src` to `/_next/image?url=<encoded-original>&w=...&q=75`. Tests that do `expect(img.src).toBe('https://example.com/house.jpg')` will fail after migration. Update them to assert the encoded original is present in the rewritten URL. Do this *before* migrating components so the test failures we see during the next tasks are real, not pre-existing.

- [ ] **Step 1: Update ListingCard test**

In `src/components/__tests__/ListingCard.test.tsx`, replace line 67:

```tsx
// Before:
expect(img.src).toBe('https://example.com/h.jpg')

// After:
expect(decodeURIComponent(img.src)).toContain('https://example.com/h.jpg')
```

- [ ] **Step 2: Update LocationCell test**

In `src/components/__tests__/LocationCell.test.tsx`, replace line 46:

```tsx
// Before:
expect(img.src).toBe('https://example.com/house.jpg')

// After:
expect(decodeURIComponent(img.src)).toContain('https://example.com/house.jpg')
```

- [ ] **Step 3: Update ListingPopup test**

In `src/components/__tests__/ListingPopup.test.tsx`, replace line 61:

```tsx
// Before:
expect(img.src).toBe('https://example.com/house.jpg')

// After:
expect(decodeURIComponent(img.src)).toContain('https://example.com/house.jpg')
```

- [ ] **Step 4: Run tests — they should still pass (unchanged components)**

Run: `npm test -- ListingCard LocationCell ListingPopup`
Expected: all 3 test files pass. The `toContain` is strictly weaker than `toBe`, so the assertions still hold against the current `<img>` output.

- [ ] **Step 5: Commit**

```bash
git add src/components/__tests__/
git commit -m "test: loosen image src assertions ahead of next/image migration"
```

---

## Task 3: Migrate fixed-size thumbnails (3 sites, same pattern)

**Files:**
- Modify: `src/components/LocationCell.tsx:72-78`
- Modify: `src/components/ListingCard.tsx:66-72`
- Modify: `src/app/trash/page.tsx:148-152`

**Why this task:** All three sites render a small, fixed-pixel thumbnail (`w-11 h-9`, `w-20 h-20`, `w-20 h-20`). With known width/height, `<Image>` works without `fill` mode — simpler, no positioned-parent requirement. `onError` handlers carry over unchanged.

- [ ] **Step 1: Migrate LocationCell.tsx**

At the top of the file, add:
```tsx
import Image from 'next/image'
```

Replace the `<img>` block at line 72-78:

```tsx
// Before:
<img
  src={imageUrl}
  alt={text ? `${text} listing photo` : 'Listing photo'}
  loading="lazy"
  className="shrink-0 w-11 h-9 rounded-md object-cover bg-surface-muted"
  onError={() => setImgError(true)}
/>

// After:
<Image
  src={imageUrl}
  alt={text ? `${text} listing photo` : 'Listing photo'}
  width={44}
  height={36}
  className="shrink-0 w-11 h-9 rounded-md object-cover bg-surface-muted"
  onError={() => setImgError(true)}
/>
```

(Remove `loading="lazy"` — it's the default for `<Image>`.)

- [ ] **Step 2: Migrate ListingCard.tsx**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the `<img>` block at line 66-72:

```tsx
// Before:
<img
  src={listing.image_url}
  alt={address}
  loading="lazy"
  className="shrink-0 w-20 h-20 rounded-lg object-cover bg-surface-muted"
  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
/>

// After:
<Image
  src={listing.image_url}
  alt={address}
  width={80}
  height={80}
  className="shrink-0 w-20 h-20 rounded-lg object-cover bg-surface-muted"
  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
/>
```

- [ ] **Step 3: Migrate trash/page.tsx**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the `<img>` block at line 148-152:

```tsx
// Before:
<img
  src={listing.image_url}
  alt=""
  className="w-20 h-20 object-cover rounded-lg border border-border shrink-0"
/>

// After:
<Image
  src={listing.image_url}
  alt=""
  width={80}
  height={80}
  className="w-20 h-20 object-cover rounded-lg border border-border shrink-0"
/>
```

- [ ] **Step 4: Run unit tests for the components that have them**

Run: `npm test -- ListingCard LocationCell`
Expected: PASS. (`trash/page.tsx` has no test.)

- [ ] **Step 5: Visually verify in dev server**

Run: `npm run dev` (if not already running).

Use preview_start, then preview_snapshot on `/` (table view shows LocationCell thumbnails), `/?view=cards` or whatever triggers ListingCard, and `/trash`. Confirm:
- Thumbnails render at the correct visual size (no layout shift, no oversized fallback)
- No console errors mentioning "Invalid src prop" or "remotePatterns"

If any image doesn't load: check `next.config.ts` from Task 1 was applied and dev server was restarted (Next.js requires a restart after config changes).

- [ ] **Step 6: Commit**

```bash
git add src/components/LocationCell.tsx src/components/ListingCard.tsx src/app/trash/page.tsx
git commit -m "perf(images): migrate fixed-size thumbnails to next/image"
```

---

## Task 4: Migrate ListingPopup (map popup)

**Files:**
- Modify: `src/components/ListingPopup.tsx:13-18`

**Why this task:** Popup image renders at 224×112 (parent is `w-56`, image is `h-28`). Image is sized at 224px wide × 112px tall — known dimensions, no need for `fill`. Use explicit width/height. The map popup is dynamically loaded (only when user opens a marker), so no preload.

- [ ] **Step 1: Update the file**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the `<img>` block at line 13-18:

```tsx
// Before:
<img
  src={listing.image_url}
  alt={listing.full_address ?? listing.location ?? 'Listing thumbnail'}
  loading="lazy"
  className="w-full h-28 object-cover rounded-md bg-surface-muted mb-2"
/>

// After:
<Image
  src={listing.image_url}
  alt={listing.full_address ?? listing.location ?? 'Listing thumbnail'}
  width={224}
  height={112}
  className="w-full h-28 object-cover rounded-md bg-surface-muted mb-2"
/>
```

- [ ] **Step 2: Run unit tests**

Run: `npm test -- ListingPopup`
Expected: PASS.

- [ ] **Step 3: Visually verify**

Open `/` in the preview, click any map marker. Confirm popup image renders without layout shift and at full popup width.

- [ ] **Step 4: Commit**

```bash
git add src/components/ListingPopup.tsx
git commit -m "perf(images): migrate map popup image to next/image"
```

---

## Task 5: Migrate DetailPanel hero image

**Files:**
- Modify: `src/components/DetailPanel.tsx:120-124`

**Why this task:** Image is `w-full h-48` — width depends on the side panel width (variable). Use `fill` mode in a positioned wrapper. `sizes` is set for the largest realistic panel width on desktop.

- [ ] **Step 1: Update the file**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the `<img>` block at line 119-125:

```tsx
// Before:
{listing.image_url && (
  <img
    src={listing.image_url}
    alt="Listing photo"
    className="w-full h-48 object-cover rounded-lg border border-border mb-5"
  />
)}

// After:
{listing.image_url && (
  <div className="relative w-full h-48 mb-5 rounded-lg overflow-hidden border border-border">
    <Image
      src={listing.image_url}
      alt="Listing photo"
      fill
      sizes="(max-width: 768px) 100vw, 480px"
      className="object-cover"
    />
  </div>
)}
```

(Note: the wrapper div absorbs the `rounded-lg`/`border`/`mb-5`/sizing classes; `<Image fill>` requires a positioned parent and styles itself absolutely inside it.)

- [ ] **Step 2: Run all component tests**

Run: `npm test -- DetailPanel`
Expected: PASS.

- [ ] **Step 3: Visually verify**

Click any listing in the table to open the detail panel. Confirm the image fills the panel width, has rounded corners + border, and doesn't shift the layout while loading.

- [ ] **Step 4: Commit**

```bash
git add src/components/DetailPanel.tsx
git commit -m "perf(images): migrate detail panel image to next/image"
```

---

## Task 6: Migrate AddListingClient success preview

**Files:**
- Modify: `src/app/add-listing/AddListingClient.tsx:235-241`

**Why this task:** `w-full h-40` — same shape as Task 5, fill mode in positioned wrapper.

- [ ] **Step 1: Update the file**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the `<img>` block at line 235-241:

```tsx
// Before:
{imageUrl && (
  <img
    src={imageUrl}
    alt="Listing photo"
    className="w-full h-40 object-cover rounded-lg border border-border mb-4"
  />
)}

// After:
{imageUrl && (
  <div className="relative w-full h-40 mb-4 rounded-lg overflow-hidden border border-border">
    <Image
      src={imageUrl}
      alt="Listing photo"
      fill
      sizes="(max-width: 768px) 100vw, 600px"
      className="object-cover"
    />
  </div>
)}
```

- [ ] **Step 2: Visually verify**

Open `/add-listing`, paste a Centris URL, hit Add, and confirm the success preview renders the image correctly.

- [ ] **Step 3: Commit**

```bash
git add src/app/add-listing/AddListingClient.tsx
git commit -m "perf(images): migrate add-listing success preview to next/image"
```

---

## Task 7: Migrate SharePreviewCard

**Files:**
- Modify: `src/components/SharePreviewCard.tsx:79-89`

**Why this task:** `w-full aspect-video` — fill mode in a wrapper that owns the aspect ratio. The fallback `<div>` already uses `aspect-video`, so the wrapper carries that class.

- [ ] **Step 1: Update the file**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the conditional block at line 79-89:

```tsx
// Before:
{l?.image_url ? (
  <img
    src={l.image_url}
    alt={`Photo of ${l?.full_address ?? l?.location ?? 'listing'}`}
    loading="lazy"
    className="w-full aspect-video object-cover bg-surface-muted"
    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
  />
) : (
  <div className="w-full aspect-video bg-surface-muted" />
)}

// After:
{l?.image_url ? (
  <div className="relative w-full aspect-video bg-surface-muted">
    <Image
      src={l.image_url}
      alt={`Photo of ${l?.full_address ?? l?.location ?? 'listing'}`}
      fill
      sizes="(max-width: 640px) 100vw, 400px"
      className="object-cover"
      onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
    />
  </div>
) : (
  <div className="w-full aspect-video bg-surface-muted" />
)}
```

- [ ] **Step 2: Run unit tests**

Run: `npm test -- SharePreviewCard`
Expected: PASS.

- [ ] **Step 3: Visually verify**

Trigger the share preview (depends on entry point — typically the bookmarklet success screen or the share modal). Confirm aspect ratio + image render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/SharePreviewCard.tsx
git commit -m "perf(images): migrate share preview card to next/image"
```

---

## Task 8: Migrate compare page grid

**Files:**
- Modify: `src/app/compare/page.tsx:167-179`

**Why this task:** Compare grid shows N listings side-by-side, each image `w-full h-[180px]`. Width varies with column count. Fill mode + `sizes` reflecting the column distribution. The first column's image is a likely LCP candidate when comparing on mobile, but since the layout is `repeat(N, minmax(0,1fr))`, no single image dominates — skipping `preload` to avoid loading every column eagerly.

- [ ] **Step 1: Update the file**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the conditional block at line 167-179:

```tsx
// Before:
{listing.image_url ? (
  <img
    src={listing.image_url}
    alt=""
    className="w-full h-[180px] object-cover"
  />
) : (
  <div className="w-full h-[180px] bg-surface-muted flex items-center justify-center">
    <svg className="text-fg-subtle" width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
    </svg>
  </div>
)}

// After:
{listing.image_url ? (
  <div className="relative w-full h-[180px]">
    <Image
      src={listing.image_url}
      alt=""
      fill
      sizes={`(max-width: 768px) ${Math.round(100 / listings.length)}vw, ${Math.round(800 / listings.length)}px`}
      className="object-cover"
    />
  </div>
) : (
  <div className="w-full h-[180px] bg-surface-muted flex items-center justify-center">
    <svg className="text-fg-subtle" width="32" height="32" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81V14.75c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.06l-2.22-2.22a.75.75 0 00-1.06 0L9.06 13.06a.75.75 0 01-1.06 0l-1.94-1.94a.75.75 0 00-1.06 0L2.5 11.06zM12 7a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
    </svg>
  </div>
)}
```

(The `sizes` value adapts to N columns: at mobile, each is `100vw / N`; at desktop, capped at `800px / N`. Browser uses this to pick the smallest fitting srcset variant.)

- [ ] **Step 2: Visually verify**

Navigate to `/compare?ids=…` with 2 and 3 listings. Confirm images render and don't reflow.

- [ ] **Step 3: Commit**

```bash
git add src/app/compare/page.tsx
git commit -m "perf(images): migrate compare page grid to next/image"
```

---

## Task 9: Migrate recent listing detail page (LCP candidate)

**Files:**
- Modify: `src/app/recent/[id]/page.tsx:71-80`

**Why this task:** This is the single image at the top of the listing detail page on mobile — clearly the LCP. Use `fill` and add `preload` so it starts loading from the document `<head>`.

- [ ] **Step 1: Update the file**

At the top, add:
```tsx
import Image from 'next/image'
```

Replace the conditional block at line 71-80:

```tsx
// Before:
{listing.image_url ? (
  <img
    src={listing.image_url}
    alt=""
    className="w-full aspect-video object-cover bg-surface-muted"
    onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
  />
) : (
  <div className="w-full aspect-video bg-surface-muted" />
)}

// After:
{listing.image_url ? (
  <div className="relative w-full aspect-video bg-surface-muted">
    <Image
      src={listing.image_url}
      alt=""
      fill
      sizes="100vw"
      preload
      className="object-cover"
      onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
    />
  </div>
) : (
  <div className="w-full aspect-video bg-surface-muted" />
)}
```

- [ ] **Step 2: Visually verify**

Open `/recent/<some-id>` on mobile viewport (`preview_resize` to 390×844). Confirm:
- Image loads quickly at the top
- No layout shift when it appears
- DevTools network shows it being requested with high priority (a `<link rel="preload">` should be in the document head)

- [ ] **Step 3: Commit**

```bash
git add src/app/recent/[id]/page.tsx
git commit -m "perf(images): migrate recent-listing hero to next/image with preload"
```

---

## Task 10: End-to-end verification

**Files:** none modified.

**Why this task:** Catch any regressions across the whole flow before merging — type errors, build failures, image-loading failures on real Centris URLs.

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: no errors. (Catches any prop mismatches.)

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: build completes; no warnings about missing `width`/`height` on `<Image>`.

- [ ] **Step 4: Smoke-test the key flows in dev**

In `npm run dev`, walk through:
1. Home table view → thumbnails in LocationCell render
2. Click a row → DetailPanel image renders
3. Switch to mobile cards (resize to 390×844) → ListingCard thumbnails render
4. Open the map → click a marker → ListingPopup image renders
5. `/compare?ids=A,B` with 2 listings → both grid images render
6. `/recent/<id>` → hero image renders, `<link rel="preload">` present in head
7. `/trash` (with at least one trashed listing) → thumbnails render
8. `/add-listing` → paste a Centris URL → success card image renders

For each: take a `preview_screenshot` and confirm visually.

- [ ] **Step 5: Confirm Vercel image-optimization is being used**

In dev tools network tab, confirm image requests go to `/_next/image?url=…` (not directly to `mspublic.centris.ca`). If they go direct, Task 1's config didn't apply — check the dev server was restarted.

- [ ] **Step 6: Final commit if anything was tweaked**

If any of the above surfaces a small fix, commit it as `fix(images): <what>`. Otherwise no commit needed — the migration is done.

---

## Post-merge follow-ups (NOT part of this plan)

- Monitor Vercel "Image Optimization" usage in the dashboard. Free tier is 5,000 transformations/month. If usage gets close, options are: bump `minimumCacheTTL` higher, set `qualities: [60]` to reduce variants, or set `images.unoptimized: true` (loses optimization but keeps lazy-loading + layout-shift fix).
- If LCP measurements (Vercel Analytics > Web Vitals) show improvement, the migration paid off. If not, investigate whether Centris is serving slow source images regardless of optimization.
