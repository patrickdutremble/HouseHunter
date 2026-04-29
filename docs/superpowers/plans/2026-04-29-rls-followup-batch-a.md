# RLS Follow-up Batch A — Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the security/observability gaps left after the Supabase RLS migration: fail loudly on missing env vars, prevent server-only modules from leaking into client bundles, and stop silently swallowing errors in auth and scrape paths.

**Architecture:** A new `requireEnv` helper centralises env-var validation. The two server-side Supabase factories (`admin.ts`, `server.ts`) gain `import 'server-only'` and switch to `requireEnv`. The auth callback and the scrape route's duplicate check are updated to log errors instead of swallowing them.

**Tech Stack:** Next.js 16, TypeScript, Supabase (`@supabase/ssr`, `@supabase/supabase-js`), Vitest.

---

## File Structure

**Create:**
- `src/lib/env.ts` — `requireEnv(name: string): string` helper
- `src/lib/__tests__/env.test.ts` — unit tests for `requireEnv`

**Modify:**
- `src/lib/supabase/admin.ts` — add `import 'server-only'`, use `requireEnv`
- `src/lib/supabase/server.ts` — add `import 'server-only'`, use `requireEnv`
- `src/app/auth/callback/route.ts` — log auth-exchange errors before redirecting
- `src/app/api/scrape-centris/route.ts` — surface the swallowed duplicate-check error
- `.env.example` — add the missing `SUPABASE_SERVICE_ROLE_KEY` entry (it's referenced in `admin.ts` but not documented)

---

## Task 1: `requireEnv` helper

**Files:**
- Create: `src/lib/env.ts`
- Test: `src/lib/__tests__/env.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/env.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requireEnv } from '@/lib/env'

describe('requireEnv', () => {
  const ORIGINAL = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL }
  })

  afterEach(() => {
    process.env = ORIGINAL
  })

  it('returns the value when the env var is set', () => {
    process.env.MY_VAR = 'hello'
    expect(requireEnv('MY_VAR')).toBe('hello')
  })

  it('throws a clear error when the env var is missing', () => {
    delete process.env.MY_VAR
    expect(() => requireEnv('MY_VAR')).toThrow(/MY_VAR/)
  })

  it('throws when the env var is an empty string', () => {
    process.env.MY_VAR = ''
    expect(() => requireEnv('MY_VAR')).toThrow(/MY_VAR/)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/lib/__tests__/env.test.ts`
Expected: FAIL — module `@/lib/env` not found.

- [ ] **Step 3: Implement `requireEnv`**

Create `src/lib/env.ts`:

```typescript
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `Set it in .env.local (development) or your deployment environment (production).`
    )
  }
  return value
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run src/lib/__tests__/env.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/lib/__tests__/env.test.ts
git commit -m "feat(env): add requireEnv helper that fails fast on missing vars"
```

---

## Task 2: `server-only` guards + `requireEnv` adoption in Supabase factories

**Files:**
- Modify: `src/lib/supabase/admin.ts`
- Modify: `src/lib/supabase/server.ts`
- Modify: `.env.example`

This task has no new tests — `import 'server-only'` is a *build-time* guarantee enforced by Next.js (any client component that imports a `server-only` module will fail the build). The runtime behaviour is unchanged on success.

- [ ] **Step 1: Update `src/lib/supabase/admin.ts`**

Replace the entire file with:

```typescript
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/env'

export function createAdminClient() {
  return createSupabaseClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
```

- [ ] **Step 2: Update `src/lib/supabase/server.ts`**

Replace the entire file with:

```typescript
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireEnv } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll() called from a Server Component — ignored.
            // Middleware refreshes the session, so this is safe.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 3: Add the missing service-role-key entry to `.env.example`**

Append to `.env.example` (after the `NEXT_PUBLIC_SUPABASE_ANON_KEY` line):

```
# Server-side only — bypasses RLS. Used by admin/cron routes.
# NEVER expose this to the client (no NEXT_PUBLIC_ prefix).
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

- [ ] **Step 4: Verify the existing test suite still passes**

Run: `npx vitest run`
Expected: PASS (all existing tests + the 3 new env tests from Task 1).

- [ ] **Step 5: Verify the production build still succeeds**

Run: `npx next build`
Expected: build completes without errors. (If a client component is accidentally importing a server-only module, the build will fail here with a clear `'server-only' cannot be imported from a Client Component` error — that would be a real bug to fix, not a Task 2 regression.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/admin.ts src/lib/supabase/server.ts .env.example
git commit -m "feat(supabase): guard server clients with server-only + requireEnv"
```

---

## Task 3: Log auth-callback errors instead of swallowing them

**Files:**
- Modify: `src/app/auth/callback/route.ts`

Currently, if `exchangeCodeForSession` returns an error, the callback redirects to `/login?error=callback_failed` with no server-side trace. This task adds a `console.error` so the failure shows up in Vercel logs / local dev console.

- [ ] **Step 1: Update the callback route**

Replace `src/app/auth/callback/route.ts` with:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawReturnTo = searchParams.get('returnTo')
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${returnTo}`)
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message)
  } else {
    console.error('[auth/callback] missing code parameter')
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`)
}
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npx next build`
Expected: build completes without errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "fix(auth): log callback failures so they're not silently swallowed"
```

---

## Task 4: Surface the swallowed duplicate-check error in scrape route

**Files:**
- Modify: `src/app/api/scrape-centris/route.ts`

The duplicate-check query currently destructures only `data`, dropping the `error`. Under RLS, a permissions error here would look identical to "no duplicate found" — meaning the route would proceed to insert and create a duplicate, OR the insert would fail with a less-helpful message. This task surfaces the error and fails the request with a 500 + log line.

- [ ] **Step 1: Update the duplicate-check block**

In `src/app/api/scrape-centris/route.ts`, find the block at lines 43–55:

```typescript
  // --- Duplicate check ---
  const { data: existing } = await supabase
    .from('listings')
    .select('id')
    .eq('centris_link', url)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', listingId: existing.id },
      { status: 409 }
    )
  }
```

Replace it with:

```typescript
  // --- Duplicate check ---
  const { data: existing, error: dupErr } = await supabase
    .from('listings')
    .select('id')
    .eq('centris_link', url)
    .maybeSingle()

  if (dupErr) {
    console.error('[scrape-centris] duplicate-check failed:', dupErr.message)
    return NextResponse.json(
      { error: 'Failed to check for existing listing' },
      { status: 500 }
    )
  }

  if (existing) {
    return NextResponse.json(
      { error: 'duplicate', listingId: existing.id },
      { status: 409 }
    )
  }
```

- [ ] **Step 2: Verify the build still succeeds**

Run: `npx next build`
Expected: build completes without errors.

- [ ] **Step 3: Verify the existing test suite still passes**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scrape-centris/route.ts
git commit -m "fix(scrape): surface duplicate-check errors instead of swallowing them"
```

---

## Final Verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass.

- [ ] **Step 2: Run the production build**

Run: `npx next build`
Expected: build succeeds.

- [ ] **Step 3: Manual smoke test (dev server)**

Run: `npm run dev`

Verify:
1. Sign in still works end-to-end (magic link → callback → redirect to `/`).
2. Scraping a brand-new Centris URL still creates a listing.
3. Scraping the *same* URL twice returns the duplicate 409 (not a 500).

- [ ] **Step 4: Confirm `.env.local` has `SUPABASE_SERVICE_ROLE_KEY`**

If the dev server now throws `Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY`, that's `requireEnv` doing its job — copy the key from the Supabase dashboard into `.env.local`.

---

## Notes for Patrick

- Each task ends in a commit, so if anything breaks, we can roll back one task at a time without losing the others.
- The only behavioural change a *user* might notice is in Task 4 — if a duplicate-check ever fails (very rare), they'll see a generic "Failed to check for existing listing" instead of an unexplained 500 from the insert step. That's an improvement.
- Tasks 1, 2, and 4 add zero runtime cost. Task 3 adds two `console.error` calls that only fire on failure.
