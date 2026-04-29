# RLS Follow-up Batches C, D, E — Combined Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out the remaining post-RLS-migration follow-ups in one pass — three concern areas (security plumbing, UX polish, doc/file cleanup) bundled because each individual change is too small to warrant its own plan.

**Architecture:** Seven independent tasks, each producing one self-contained commit. Ordered cheapest-first: file deletions, then config tweaks, then doc edits, then security swap-ins, then a UX component change. Tasks within a section don't depend on each other; tasks across sections are fully orthogonal.

**Tech Stack:** Next.js 16, TypeScript, React, Vitest, Supabase. No new dependencies.

---

## File Structure

**Sections (informational only — task numbering is continuous):**

- **Section D — Cleanup & docs** (Tasks 1–3): low-risk mechanical changes
- **Section E — Security follow-ups** (Tasks 4–6): close gaps the Batch A final reviewer flagged
- **Section C — UserMenu UX** (Task 7): keyboard / focus polish

**Files touched:**

- Delete: `public/next.svg`, `public/vercel.svg`, `public/file.svg`, `public/window.svg`, `public/globe.svg`
- Modify: `tsconfig.json`
- Modify: `docs/superpowers/specs/2026-04-28-supabase-auth-rls-design.md`
- Modify: `docs/superpowers/plans/2026-04-28-supabase-auth-rls.md`
- Modify: `src/lib/supabase/client.ts`, `src/lib/supabase/middleware.ts`
- Modify: `src/app/api/scrape-centris/route.ts`
- Modify: `src/app/api/refresh-statuses/route.ts`
- Modify: `src/components/UserMenu.tsx`
- Test: `src/components/__tests__/UserMenu.test.tsx` (new)

---

## Task 1: Delete unused Next.js scaffold SVGs

**Files:**
- Delete: `public/next.svg`
- Delete: `public/vercel.svg`
- Delete: `public/file.svg`
- Delete: `public/window.svg`
- Delete: `public/globe.svg`

These are the default SVGs that ship with `create-next-app`. Confirmed via grep that none of the five files are referenced anywhere in the codebase.

- [ ] **Step 1: Confirm no references (sanity check)**

Run: `grep -rE 'next\.svg|vercel\.svg|file\.svg|window\.svg|globe\.svg' src public --include='*.ts' --include='*.tsx' --include='*.html' --include='*.css'`
Expected: no output (no matches).

- [ ] **Step 2: Delete the files**

```bash
rm public/next.svg public/vercel.svg public/file.svg public/window.svg public/globe.svg
```

- [ ] **Step 3: Verify the build still succeeds**

Run: `npx next build`
Expected: success — no missing-asset errors.

- [ ] **Step 4: Commit**

```bash
git add -A public/
git commit -m "chore: remove unused Next.js scaffold SVGs from public/"
```

---

## Task 2: Fix Vitest globals TS errors via `tsconfig.json`

**Files:**
- Modify: `tsconfig.json`

The test files use Vitest's globals (`describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi`) without importing them — possible because `vitest.config.ts` sets `globals: true`. But TypeScript doesn't know about them, producing `Cannot find name 'describe'` errors. The original Batch A followup said "project uses Vitest, not Jest" but the TS error suggests `@types/jest` — that's misleading, the right fix is to declare Vitest's global types in the project's `compilerOptions.types`.

Current `tsconfig.json` has no `types` field. Add it.

- [ ] **Step 1: Verify the errors are present before the fix**

Run: `npx tsc --noEmit 2>&1 | grep "Cannot find name 'describe'" | head -3`
Expected: 3 lines of `Cannot find name 'describe'` errors confirming the issue.

- [ ] **Step 2: Update `tsconfig.json`**

Add `"types": ["vitest/globals"]` inside `compilerOptions`. The full file should read:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "types": ["vitest/globals"],
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Verify the test-file errors are gone**

Run: `npx tsc --noEmit 2>&1 | grep -c "Cannot find name 'describe'"`
Expected: `0` (no more `describe` errors).

Note: A few unrelated TS errors may remain in test files (e.g. `Tuple type '[]' has no element at index '1'` in `recent/__tests__/page.test.tsx` and `share/__tests__/page.test.tsx`). Those are pre-existing test-mock typing issues, not in scope for this task.

- [ ] **Step 4: Verify the test suite still passes**

Run: `npx vitest run`
Expected: PASS — all tests still green (no behaviour change).

- [ ] **Step 5: Verify the build still succeeds**

Run: `npx next build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add tsconfig.json
git commit -m "chore(tsconfig): declare vitest/globals types to fix test-file TS errors"
```

---

## Task 3: Update RLS plan/spec docs from `middleware.ts` to `proxy.ts`

**Files:**
- Modify: `docs/superpowers/specs/2026-04-28-supabase-auth-rls-design.md`
- Modify: `docs/superpowers/plans/2026-04-28-supabase-auth-rls.md`

Next.js 16 renamed the project-root middleware file from `middleware.ts` to `proxy.ts`, with the exported function renamed from `middleware` to `proxy`. The spec/plan docs from yesterday still describe the file by its old name. The helper at `src/lib/supabase/middleware.ts` has NOT been renamed — only the project-root file changed.

**IMPORTANT distinction — only update references to the project-root file:**
- `src/lib/supabase/middleware.ts` (the helper) → leave alone, file still exists at this path
- `middleware.ts` at the project root → update to `proxy.ts`
- The exported function `middleware` → update to `proxy`

- [ ] **Step 1: Update `docs/superpowers/specs/2026-04-28-supabase-auth-rls-design.md`**

Three lines reference the project-root file. Make these exact replacements:

**Line 43**: change

```
- **`middleware.ts`** at the project root runs before every request. Reads the session cookie via `src/lib/supabase/middleware.ts`, refreshes it if near expiry, and redirects unauthenticated requests to `/login?returnTo=<original path with query>`. Excludes the cron path (`/api/cron/*`), Next.js internals (`/_next/*`), the login page itself, and the auth callback route.
```

to

```
- **`proxy.ts`** at the project root runs before every request. Reads the session cookie via `src/lib/supabase/middleware.ts`, refreshes it if near expiry, and redirects unauthenticated requests to `/login?returnTo=<original path with query>`. Excludes the cron path (`/api/cron/*`), Next.js internals (`/_next/*`), the login page itself, and the auth callback route.
```

**Line 52**: change

```
- **`middleware.ts`** (project root) — ~25 lines. Imports the helper from `src/lib/supabase/middleware.ts`, applies the redirect rule, and sets the `matcher` config to exclude internals.
```

to

```
- **`proxy.ts`** (project root) — ~25 lines. Imports the helper from `src/lib/supabase/middleware.ts`, applies the redirect rule, and sets the `matcher` config to exclude internals.
```

Lines 38 and 55 (which reference `src/lib/supabase/middleware.ts`) are unchanged — that helper file still exists at that path.

- [ ] **Step 2: Update `docs/superpowers/plans/2026-04-28-supabase-auth-rls.md`**

Five lines reference the project-root file. Make these exact replacements:

**Line 7**: change

```
**Architecture:** Add `@supabase/ssr` for cookie-based session sharing across browser, server components, server routes, and middleware. Replace the single `src/lib/supabase.ts` with a folder of focused client factories. Introduce a root `middleware.ts` that redirects unauthenticated requests to `/login`. Enable RLS on `listings` with a single `auth.uid() IS NOT NULL` policy as a defense-in-depth safety net.
```

to

```
**Architecture:** Add `@supabase/ssr` for cookie-based session sharing across browser, server components, server routes, and middleware. Replace the single `src/lib/supabase.ts` with a folder of focused client factories. Introduce a root `proxy.ts` (Next.js 16 renamed middleware → proxy) that redirects unauthenticated requests to `/login`. Enable RLS on `listings` with a single `auth.uid() IS NOT NULL` policy as a defense-in-depth safety net.
```

**Line 19**: change

```
- `middleware.ts` (project root) — Next.js middleware. Imports `updateSession` from the supabase middleware helper.
```

to

```
- `proxy.ts` (project root) — Next.js middleware (renamed from middleware.ts in Next 16). Imports `updateSession` from the supabase middleware helper.
```

**Line 273**: change

```
Expected: no errors. (Note: `shouldGate` is referenced in `middleware.ts` but doesn't exist yet — this will surface as a missing-module error. That's OK; we create it in Task 3 next. If tsc errors only on that, it's expected.)
```

to

```
Expected: no errors. (Note: `shouldGate` is referenced in `proxy.ts` but doesn't exist yet — this will surface as a missing-module error. That's OK; we create it in Task 3 next. If tsc errors only on that, it's expected.)
```

**Line 1038**: change

```
- Create: `middleware.ts` (project root)
```

to

```
- Create: `proxy.ts` (project root)
```

**Line 1042**: change

```
Create `middleware.ts` at the project root:
```

to

```
Create `proxy.ts` at the project root:
```

**Line 1101**: change

```
git add middleware.ts
```

to

```
git add proxy.ts
```

**Line 1491**: change

```
**Type consistency:** `createClient()` is the function name in client.ts, server.ts; `createAdminClient()` in admin.ts (intentionally distinct so callers can't confuse it with the user-scoped clients). `updateSession(request)` is the middleware helper name everywhere it's referenced. `shouldGate(pathname)` matches between definition (Task 3) and consumer (Task 2's middleware.ts).
```

to

```
**Type consistency:** `createClient()` is the function name in client.ts, server.ts; `createAdminClient()` in admin.ts (intentionally distinct so callers can't confuse it with the user-scoped clients). `updateSession(request)` is the middleware helper name everywhere it's referenced. `shouldGate(pathname)` matches between definition (Task 3) and consumer (Task 2's proxy.ts).
```

Lines 22, 145, and 200 (which reference `src/lib/supabase/middleware.ts`) are unchanged — that helper file still exists at that path.

- [ ] **Step 3: Verify the changes**

Run: `grep -nE '\bmiddleware\.ts\b' docs/superpowers/specs/2026-04-28-supabase-auth-rls-design.md docs/superpowers/plans/2026-04-28-supabase-auth-rls.md | grep -v 'src/lib/supabase/middleware'`
Expected: no output. (All remaining `middleware.ts` references should now be inside `src/lib/supabase/middleware.ts` paths only.)

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-28-supabase-auth-rls-design.md docs/superpowers/plans/2026-04-28-supabase-auth-rls.md
git commit -m "docs: update RLS spec/plan to reference proxy.ts (Next 16 rename)"
```

---

## Task 4: Apply `requireEnv` to `client.ts` and `supabase/middleware.ts`

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/supabase/middleware.ts`

Batch A converted `admin.ts` and `server.ts` to `requireEnv` but left these two files using `process.env.X!` non-null assertions. Apply the same treatment so a missing env var fails loudly with a clear actionable message instead of silently passing `undefined` to the Supabase constructor.

`client.ts` runs in the browser bundle. `requireEnv` works there because Next.js inlines `NEXT_PUBLIC_*` env vars at build time — if missing, the inlined value is `undefined` and `requireEnv` throws on first call.

`middleware.ts` (the helper, NOT the project-root file) runs in the Edge Runtime per request. `requireEnv` is called inside `updateSession()`, so it throws on the first request if env vars are missing — same fail-loud guarantee. Note: `import 'server-only'` is **not** appropriate here because the Edge Runtime doesn't honour the `react-server` export condition; the helper's protection comes from being imported only by `proxy.ts`.

- [ ] **Step 1: Update `src/lib/supabase/client.ts`**

Replace the entire file with:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import { requireEnv } from '@/lib/env'

export function createClient() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}
```

- [ ] **Step 2: Update `src/lib/supabase/middleware.ts`**

Find lines 8–10:

```typescript
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
```

Change to use `requireEnv`. Add the import on line 4 (after the existing imports). The full file should read:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { shouldGate } from '@/lib/middleware-paths'
import { requireEnv } from '@/lib/env'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && shouldGate(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    const returnTo = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = '/login'
    url.search = `?returnTo=${encodeURIComponent(returnTo)}`
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
```

The only changes from the current file are:
1. Added `import { requireEnv } from '@/lib/env'` on line 4.
2. Replaced both `process.env.NEXT_PUBLIC_SUPABASE_*!` non-null assertions with `requireEnv(...)` calls.

- [ ] **Step 3: Run the test suite**

Run: `npx vitest run`
Expected: PASS — all 312 tests still green.

- [ ] **Step 4: Run the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/middleware.ts
git commit -m "feat(supabase): adopt requireEnv in client and middleware helper"
```

---

## Task 5: Log scrape-centris insert errors

**Files:**
- Modify: `src/app/api/scrape-centris/route.ts`

The duplicate-check block (Batch A Task 4) now logs the full error object on failure. The insert block right below it still doesn't `console.error` — it just returns a 500 with the message in the response body. Under RLS, an insert permission denial would produce no server-side trace. Match the pattern from the duplicate-check block.

- [ ] **Step 1: Update the insert error handler**

In `src/app/api/scrape-centris/route.ts`, find lines 134–138 (current state):

```typescript
  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? 'Failed to insert listing' },
      { status: 500 }
    )
  }
```

Replace with:

```typescript
  if (insertErr || !inserted) {
    if (insertErr) {
      console.error('[scrape-centris] insert failed:', insertErr)
    }
    return NextResponse.json(
      { error: insertErr?.message ?? 'Failed to insert listing' },
      { status: 500 }
    )
  }
```

The conditional log is intentional — `insertErr` could theoretically be null while `inserted` is also null (Supabase API edge case). In that case the existing fallback message handles it without a misleading log.

- [ ] **Step 2: Verify the build still succeeds**

Run: `npx next build`
Expected: success.

- [ ] **Step 3: Verify the test suite still passes**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scrape-centris/route.ts
git commit -m "fix(scrape): log insert errors for production observability"
```

---

## Task 6: Migrate `refresh-statuses` route to `createAdminClient`

**Files:**
- Modify: `src/app/api/refresh-statuses/route.ts`

This route currently builds its own admin Supabase client by reading env vars and calling `createClient` from `@supabase/supabase-js` directly — bypassing the `createAdminClient` factory and its `import 'server-only'` guard. Switch to the factory so the route benefits from the same defense-in-depth as the cron route.

- [ ] **Step 1: Update the route**

Replace `src/app/api/refresh-statuses/route.ts` (entire file) with:

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAllStatuses } from '@/lib/refresh-statuses'

export const maxDuration = 60

export async function POST() {
  const supabase = createAdminClient()
  try {
    const summary = await refreshAllStatuses(supabase)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[refresh-statuses] failed:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

Differences from the current file:
1. Imports `createAdminClient` instead of `createClient` from `@supabase/supabase-js`.
2. The hand-rolled env-var guard is gone — `createAdminClient` calls `requireEnv` internally.
3. Added a `console.error` line for the catch block (consistent with the observability pattern from Batch A and Task 5).

- [ ] **Step 2: Run the test suite**

Run: `npx vitest run`
Expected: PASS — all tests still green.

- [ ] **Step 3: Run the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/refresh-statuses/route.ts
git commit -m "refactor(refresh-statuses): use createAdminClient factory"
```

---

## Task 7: UserMenu — Escape-to-close + focus restoration (TDD)

**Files:**
- Modify: `src/components/UserMenu.tsx`
- Test: `src/components/__tests__/UserMenu.test.tsx` (new)

The UserMenu dropdown already has outside-click dismissal (lines 31–40). Two pieces are missing:
1. Pressing **Escape** while the menu is open should close it.
2. When the menu closes via Escape (or after Log out fails), focus should return to the trigger button — otherwise keyboard users lose their place.

We'll add a Vitest test for the Escape behaviour, then implement.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/UserMenu.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMenu } from '@/components/UserMenu'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'patrick@example.com' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signOut: vi.fn().mockResolvedValue({}),
    },
  }),
}))

describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('closes the menu when Escape is pressed and restores focus to the trigger', async () => {
    render(<UserMenu />)

    const trigger = await screen.findByRole('button', { name: /account menu/i })
    fireEvent.click(trigger)

    expect(await screen.findByRole('menu')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })

    expect(document.activeElement).toBe(trigger)
  })
})
```

Note: requires `@testing-library/jest-dom` matchers (`toBeInTheDocument`). Verify they're already available by checking `tests/setup.ts`. If not, the test will fail with a clearer error — adjust if needed (likely the project already has them set up since other component tests use them).

- [ ] **Step 2: Run the test — verify it fails**

Run: `npx vitest run src/components/__tests__/UserMenu.test.tsx`
Expected: FAIL — either "menu still in document after Escape" or "activeElement is body, expected trigger".

- [ ] **Step 3: Update `src/components/UserMenu.tsx`**

Replace the entire file with:

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function UserMenu() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
    let active = true
    supabase.auth.getUser().then(({ data }) => {
      if (active) setEmail(data.user?.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setEmail(session?.user?.email ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  // Close on Escape and restore focus to the trigger
  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  if (!mounted || !email) return null

  const initial = email[0].toUpperCase()

  async function handleLogout() {
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${email}`}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-border bg-surface text-sm font-semibold text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {initial}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1.5 w-52 rounded-lg bg-surface border border-border shadow-lg overflow-hidden z-50"
        >
          {/* Email display */}
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs text-fg-subtle truncate">{email}</p>
          </div>

          {/* Log out */}
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-hover transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
```

The only differences from the current file are:
1. Added `triggerRef` ref to the trigger button (line ~14 declaration, attached on the `<button>` element).
2. New `useEffect` hook that listens for `Escape` keydown when `open` is true; closes the menu and refocuses the trigger.

- [ ] **Step 4: Run the test — verify it passes**

Run: `npx vitest run src/components/__tests__/UserMenu.test.tsx`
Expected: PASS — 1 test.

- [ ] **Step 5: Run the full test suite**

Run: `npx vitest run`
Expected: PASS — 313 tests total (312 + 1 new).

- [ ] **Step 6: Run the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/components/UserMenu.tsx src/components/__tests__/UserMenu.test.tsx
git commit -m "feat(usermenu): close on Escape and restore focus to trigger"
```

---

## Final Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: 313/313 passing.

- [ ] **Step 2: Run the production build**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke test (after deploying to prod)**

Verify in the deployed Vercel app:
1. **Sign-in flow** still works end-to-end (proves Tasks 4 + 6 didn't break the auth path).
2. **Bookmarklet** still creates listings; duplicate scrape still returns 409 (proves Task 5 didn't regress the scrape route).
3. **UserMenu**: click avatar → menu opens; press Escape → menu closes and focus returns to the avatar (Task 7).
4. **UserMenu**: click avatar → menu opens; click outside → menu closes (regression check on existing behaviour).

---

## Notes for Patrick

- 7 commits total. Each is independently reversible.
- No data migrations, no env-var changes, no breaking changes to public APIs.
- After Task 4 lands, missing `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` will throw clear errors at first use instead of silently producing broken Supabase clients. (Both vars are already set in `.env.local` and Vercel.)
- Task 6 makes the `refresh-statuses` route depend on `SUPABASE_SERVICE_ROLE_KEY` being set. It already was (verified during Batch A). On Vercel: ✅. Locally: only matters if you ever invoke that route from the dev server.
