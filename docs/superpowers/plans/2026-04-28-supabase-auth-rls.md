# Supabase Auth + RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down HouseHunter with Supabase email-OTP auth, a Next.js middleware gate, and Row Level Security on the `listings` table — so only allowlisted users can read or write.

**Architecture:** Add `@supabase/ssr` for cookie-based session sharing across browser, server components, server routes, and middleware. Replace the single `src/lib/supabase.ts` with a folder of focused client factories. Introduce a root `middleware.ts` that redirects unauthenticated requests to `/login`. Enable RLS on `listings` with a single `auth.uid() IS NOT NULL` policy as a defense-in-depth safety net.

**Tech Stack:** Next.js 16 (App Router), `@supabase/supabase-js` ^2.102.1 (already installed), `@supabase/ssr` (to be added), Vitest for unit tests, Supabase Auth (email OTP), PostgreSQL RLS.

**Spec:** [docs/superpowers/specs/2026-04-28-supabase-auth-rls-design.md](../specs/2026-04-28-supabase-auth-rls-design.md)

---

## File Structure

**New files:**

- `middleware.ts` (project root) — Next.js middleware. Imports `updateSession` from the supabase middleware helper.
- `src/lib/supabase/client.ts` — browser-side Supabase client factory (replaces use of old `src/lib/supabase.ts`).
- `src/lib/supabase/server.ts` — server-side cookie-aware Supabase client factory.
- `src/lib/supabase/middleware.ts` — middleware-specific helper that refreshes session and returns a redirect response when needed.
- `src/lib/supabase/admin.ts` — service-role client for the cron and other server tasks that bypass RLS.
- `src/lib/middleware-paths.ts` — pure function `shouldGate(pathname)`. Unit-tested directly.
- `src/lib/__tests__/middleware-paths.test.ts` — unit tests for `shouldGate`.
- `src/app/login/page.tsx` — login screen with two states (email entry, OTP entry).
- `src/app/auth/callback/route.ts` — server route that finalizes OTP exchange and sets session cookies.
- `src/components/UserMenu.tsx` — top-right user menu with email + Log out.

**Modified files:**

- `package.json` — add `@supabase/ssr` dependency.
- `src/app/layout.tsx` — render `<UserMenu />` on every page.
- `src/app/api/scrape-centris/route.ts` — switch from anon client to cookie-aware server client.
- `src/app/api/cron/refresh-statuses/route.ts` — swap to admin client (no behavior change).
- `src/app/add-listing/AddListingClient.tsx` — change import path.
- `src/app/trash/page.tsx` — change import path.
- `src/app/compare/page.tsx` — change import path.
- `src/lib/commute.ts` — change import path.
- `src/hooks/useListings.ts` — change import path.
- `docs/extraction-runbook.md` — note that the app is now auth-gated.
- `docs/bookmarklet-runbook.md` — note that the app is now auth-gated.

**Deleted files:**

- `src/lib/supabase.ts` — replaced by the four-file folder.

---

## Task 0: Supabase dashboard configuration (manual, user-driven)

This task is performed by **the user** in the Supabase web dashboard. No code changes. The implementer (Claude) should pause here and walk the user through these steps, confirming completion before moving on.

**Project ID:** `erklsdwrhscuzkntomxu`

- [ ] **Step 1: Enable email OTP, disable magic-link**

User opens https://supabase.com/dashboard → project `erklsdwrhscuzkntomxu` → **Authentication → Providers → Email**.

- Toggle **"Enable Email provider"** to ON.
- Toggle **"Enable email confirmations"** to ON if not already.
- Find the OTP / Magic Link option. Set it to **OTP** (6-digit code), not magic link.
- Save.

- [ ] **Step 2: Configure custom SMTP (reuse user's Gmail SMTP)**

User opens **Authentication → SMTP Settings** (sometimes labeled **Project Settings → Auth → SMTP Settings** depending on dashboard version).

- Toggle **"Enable Custom SMTP"** to ON.
- Fill in:
  - **Host:** `smtp.gmail.com`
  - **Port:** `465` (SSL) or `587` (TLS) — Gmail supports both. Use whichever the user's existing SMTP setup uses.
  - **Username:** the user's personal Gmail address.
  - **Password:** the user's existing Gmail **app password** (not the regular account password).
  - **Sender email:** the user's Gmail address.
  - **Sender name:** `HouseHunter` (or whatever the user prefers).
- Save.
- Click **"Send test email"** to verify it works. The test email should arrive in the user's inbox within ~30 seconds.

- [ ] **Step 3: Configure email allowlist**

User opens **Authentication → Sign-In / Up** (or **Authentication → Settings**, depending on dashboard version) and finds the option labeled **"Allow new users to sign up"** or **"Email signups"**.

- Either:
  - **Option A (preferred):** disable open signups entirely. Then the user creates the account manually via **Authentication → Users → Invite user** with email `patrickdutremble@gmail.com`. After invite, the user logs in via OTP. Other emails will be rejected because they're not in the users table.
  - **Option B:** if the dashboard exposes an "Allowed email domains / addresses" allowlist textbox, paste `patrickdutremble@gmail.com` and save.

The exact mechanism depends on the current Supabase dashboard. Whichever pattern is available, the goal is: only `patrickdutremble@gmail.com` can authenticate.

- [ ] **Step 4: Capture environment variables**

User confirms the following env vars exist in the `.env.local` file at the project root and in Vercel project settings (production):

- `NEXT_PUBLIC_SUPABASE_URL` — already set, no change.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already set, no change.
- `SUPABASE_SERVICE_ROLE_KEY` — already set (the cron uses it), no change.

If any are missing, copy them from **Project Settings → API** in the Supabase dashboard.

- [ ] **Step 5: Confirm to implementer**

User tells the implementer "dashboard is configured" before the implementer proceeds to Task 1.

---

## Task 1: Install `@supabase/ssr`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run:

```bash
npm install @supabase/ssr
```

Expected: `package.json` and `package-lock.json` are updated with `@supabase/ssr` (latest version, e.g. `^0.5.x`).

- [ ] **Step 2: Verify install**

Run:

```bash
npm list @supabase/ssr
```

Expected: prints the installed version, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @supabase/ssr for cookie-based auth sessions"
```

---

## Task 2: Create supabase client factories (browser, server, middleware, admin)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/middleware.ts`
- Create: `src/lib/supabase/admin.ts`

**Note:** these new modules coexist with the old `src/lib/supabase.ts` for now. No callers are migrated in this task — just the new modules. They'll be wired up in later tasks.

- [ ] **Step 1: Create `src/lib/supabase/client.ts`**

Write:

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create `src/lib/supabase/server.ts`**

Write:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

- [ ] **Step 3: Create `src/lib/supabase/middleware.ts`**

Write:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { shouldGate } from '@/lib/middleware-paths'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

- [ ] **Step 4: Create `src/lib/supabase/admin.ts`**

Write:

```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors. (Note: `shouldGate` is referenced in `middleware.ts` but doesn't exist yet — this will surface as a missing-module error. That's OK; we create it in Task 3 next. If tsc errors only on that, it's expected.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat(auth): add @supabase/ssr client factories"
```

---

## Task 3: Create `shouldGate` helper with TDD

**Files:**
- Create: `src/lib/middleware-paths.ts`
- Test: `src/lib/__tests__/middleware-paths.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/middleware-paths.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { shouldGate } from '../middleware-paths'

describe('shouldGate', () => {
  describe('gates protected paths', () => {
    it('gates root', () => {
      expect(shouldGate('/')).toBe(true)
    })
    it('gates /recent', () => {
      expect(shouldGate('/recent')).toBe(true)
    })
    it('gates dynamic /recent/:id', () => {
      expect(shouldGate('/recent/abc-123')).toBe(true)
    })
    it('gates /add-listing', () => {
      expect(shouldGate('/add-listing')).toBe(true)
    })
    it('gates /compare', () => {
      expect(shouldGate('/compare')).toBe(true)
    })
    it('gates /trash', () => {
      expect(shouldGate('/trash')).toBe(true)
    })
    it('gates /share', () => {
      expect(shouldGate('/share')).toBe(true)
    })
    it('gates /api/scrape-centris', () => {
      expect(shouldGate('/api/scrape-centris')).toBe(true)
    })
    it('gates /api/commute', () => {
      expect(shouldGate('/api/commute')).toBe(true)
    })
    it('gates /api/refresh-statuses (manual button)', () => {
      expect(shouldGate('/api/refresh-statuses')).toBe(true)
    })
  })

  describe('lets through public/internal paths', () => {
    it('lets through /login', () => {
      expect(shouldGate('/login')).toBe(false)
    })
    it('lets through /auth/callback', () => {
      expect(shouldGate('/auth/callback')).toBe(false)
    })
    it('lets through cron route', () => {
      expect(shouldGate('/api/cron/refresh-statuses')).toBe(false)
    })
    it('lets through any /api/cron/* path', () => {
      expect(shouldGate('/api/cron/anything')).toBe(false)
    })
    it('lets through Next.js static internals', () => {
      expect(shouldGate('/_next/static/chunks/main.js')).toBe(false)
    })
    it('lets through Next.js image internals', () => {
      expect(shouldGate('/_next/image')).toBe(false)
    })
    it('lets through favicon', () => {
      expect(shouldGate('/favicon.ico')).toBe(false)
    })
    it('lets through PWA manifest', () => {
      expect(shouldGate('/manifest.json')).toBe(false)
    })
    it('lets through service worker', () => {
      expect(shouldGate('/sw.js')).toBe(false)
    })
    it('lets through icon files', () => {
      expect(shouldGate('/icon-192.png')).toBe(false)
      expect(shouldGate('/icon-512.png')).toBe(false)
      expect(shouldGate('/icon-maskable.png')).toBe(false)
    })
    it('lets through bookmarklet help page', () => {
      expect(shouldGate('/bookmarklet.html')).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- middleware-paths
```

Expected: FAIL with "Cannot find module '../middleware-paths'" or similar.

- [ ] **Step 3: Implement `shouldGate`**

Create `src/lib/middleware-paths.ts`:

```typescript
const PUBLIC_EXACT_PATHS = new Set<string>([
  '/login',
  '/auth/callback',
  '/favicon.ico',
  '/manifest.json',
  '/sw.js',
  '/bookmarklet.html',
])

const PUBLIC_PREFIXES = [
  '/_next/',
  '/api/cron/',
]

const PUBLIC_FILE_PATTERN = /^\/icon-[a-z0-9-]+\.(png|svg|ico)$/

export function shouldGate(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return false
  for (const prefix of PUBLIC_PREFIXES) {
    if (pathname.startsWith(prefix)) return false
  }
  if (PUBLIC_FILE_PATTERN.test(pathname)) return false
  return true
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
npm test -- middleware-paths
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/middleware-paths.ts src/lib/__tests__/middleware-paths.test.ts
git commit -m "feat(auth): add shouldGate path matcher with tests"
```

---

## Task 4: Create login page with email and OTP states

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: Write the login page**

Create `src/app/login/page.tsx`:

```tsx
'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = searchParams.get('returnTo') ?? '/'

  const [stage, setStage] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendHint, setResendHint] = useState(false)

  const supabase = createClient()

  async function sendCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (error) {
      setError("This email isn't authorized, or we couldn't send the code right now. Wait a minute and try again, or contact Patrick if you should have access.")
      return
    }
    setStage('otp')
    setTimeout(() => setResendHint(true), 30000)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setError("That code didn't match. Try again or request a new one.")
      return
    }
    router.push(returnTo)
    router.refresh()
  }

  function resetToEmail() {
    setStage('email')
    setCode('')
    setError(null)
    setResendHint(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in to HouseHunter</h1>
          <p className="text-sm text-slate-500 mt-1">
            {stage === 'email'
              ? "Enter your email and we'll send you a 6-digit code."
              : `We sent a code to ${email}.`}
          </p>
        </div>

        {stage === 'email' ? (
          <form onSubmit={sendCode} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-base"
            />
            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-3">
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-base font-mono tracking-widest text-center"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-md font-medium disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify code'}
            </button>
            <div className="flex items-center justify-between text-sm pt-2">
              <button
                type="button"
                onClick={resetToEmail}
                className="text-slate-500 hover:text-slate-700 underline"
              >
                Use a different email
              </button>
              {resendHint && (
                <button
                  type="button"
                  onClick={() => sendCode({ preventDefault: () => {} } as React.FormEvent)}
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Send a new code
                </button>
              )}
            </div>
            {resendHint && (
              <p className="text-xs text-slate-400 mt-2">
                Didn&apos;t get it? Check your spam folder.
              </p>
            )}
          </form>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  )
}
```

**Why Suspense:** Per the project memory rule, Next.js 16 requires `useSearchParams` to be wrapped in `<Suspense>` or `next build` fails at prerender.

- [ ] **Step 2: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/
git commit -m "feat(auth): add login page with email + OTP flow"
```

---

## Task 5: Create auth callback route

**Files:**
- Create: `src/app/auth/callback/route.ts`

**Note:** Email-OTP verification happens client-side via `verifyOtp`, which sets cookies on the response automatically. The `auth/callback` route is included for compatibility with any Supabase-issued links (e.g., if Supabase falls back to a confirmation link in some edge case). It's exempted by `shouldGate` and is harmless if never hit.

- [ ] **Step 1: Write the callback route**

Create `src/app/auth/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const returnTo = searchParams.get('returnTo') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${returnTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`)
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/
git commit -m "feat(auth): add auth callback route for code exchange"
```

---

## Task 6: Create UserMenu component and wire into layout

**Files:**
- Create: `src/components/UserMenu.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the UserMenu component**

Create `src/components/UserMenu.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function UserMenu() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setEmail(data.user?.email ?? null)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setEmail(session?.user?.email ?? null)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  if (!email) return null

  async function handleLogout() {
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="fixed top-3 right-3 z-50">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 rounded-md bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 shadow-sm hover:bg-white dark:hover:bg-slate-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {email}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden"
        >
          <button
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire into layout**

Modify `src/app/layout.tsx`. Find the existing import block and add an import:

```tsx
import { UserMenu } from '@/components/UserMenu'
```

Then find the `<ThemeProvider>` block in the body, and add `<UserMenu />` inside it just after `<ServiceWorkerRegistrar />`:

```tsx
<body className="h-full antialiased font-[family-name:var(--font-inter)]">
  <ThemeProvider>
    <ServiceWorkerRegistrar />
    <UserMenu />
    {children}
  </ThemeProvider>
</body>
```

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/UserMenu.tsx src/app/layout.tsx
git commit -m "feat(auth): add UserMenu with logout to root layout"
```

---

## Task 7: Migrate the five browser-side Supabase callers

**Files:**
- Modify: `src/app/add-listing/AddListingClient.tsx`
- Modify: `src/app/trash/page.tsx`
- Modify: `src/app/compare/page.tsx`
- Modify: `src/lib/commute.ts`
- Modify: `src/hooks/useListings.ts`

**Note:** These are all client-side or browser-callable modules. They get the new `createClient()` factory.

- [ ] **Step 1: Migrate `useListings.ts`**

Open `src/hooks/useListings.ts`. Find:

```typescript
import { supabase } from '@/lib/supabase'
```

Replace with:

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
```

(Keep all other code unchanged. The `supabase` identifier is still in scope for the rest of the file.)

- [ ] **Step 2: Migrate `AddListingClient.tsx`**

Open `src/app/add-listing/AddListingClient.tsx`. Apply the same transformation:

Find:

```typescript
import { supabase } from '@/lib/supabase'
```

Replace with:

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
```

- [ ] **Step 3: Migrate `trash/page.tsx`**

Open `src/app/trash/page.tsx`. Apply the same transformation as Step 1.

- [ ] **Step 4: Migrate `compare/page.tsx`**

Open `src/app/compare/page.tsx`. Apply the same transformation as Step 1.

- [ ] **Step 5: Migrate `commute.ts`**

Open `src/lib/commute.ts`. Apply the same transformation as Step 1.

**Note on `commute.ts`:** if this module is imported from server contexts (it's called from `scrape-centris/route.ts`), creating a browser client at module top-level may not work in a server context. Inspect first — if the only callers are browser-side, the change above is fine. If `commute.ts` is also used server-side, lift the `createClient()` call inside the function bodies that need it, or split into client/server variants. Verify with `git grep "from '@/lib/commute'"` and read the call sites before committing.

- [ ] **Step 6: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Run existing test suite to make sure nothing broke**

Run:

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useListings.ts src/app/add-listing/AddListingClient.tsx src/app/trash/page.tsx src/app/compare/page.tsx src/lib/commute.ts
git commit -m "refactor(supabase): migrate browser callers to new client factory"
```

---

## Task 8: Migrate `scrape-centris` API route to cookie-aware server client

**Files:**
- Modify: `src/app/api/scrape-centris/route.ts`

- [ ] **Step 1: Update the route**

Open `src/app/api/scrape-centris/route.ts`. Find:

```typescript
import { supabase } from '@/lib/supabase'
```

Replace with:

```typescript
import { createClient } from '@/lib/supabase/server'
```

Then find the function signature line:

```typescript
export async function POST(req: Request) {
```

Add inside the function body, near the top (before the first `supabase.from(...)` call):

```typescript
  const supabase = await createClient()
```

(The duplicate-check, fetch, and insert blocks below all reference `supabase` — keep them unchanged. They'll now use the cookie-aware server client.)

- [ ] **Step 2: Verify final structure of the route**

The function should now begin like this (showing only the relevant top portion):

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCentrisHtml } from '@/lib/centris-parser'
import { recalculateListing } from '@/lib/calculations'
import { calculateAndStoreCommute } from '@/lib/commute'

export async function POST(req: Request) {
  let body: { url?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  // ... validation unchanged ...

  const supabase = await createClient()

  // --- Duplicate check ---
  const { data: existing } = await supabase
    .from('listings')
    // ... unchanged
```

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scrape-centris/route.ts
git commit -m "refactor(scrape-centris): use cookie-aware server client"
```

---

## Task 9: Migrate cron route to admin client (no behavior change)

**Files:**
- Modify: `src/app/api/cron/refresh-statuses/route.ts`

- [ ] **Step 1: Update the route**

Open `src/app/api/cron/refresh-statuses/route.ts`. Replace the file contents with:

```typescript
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshAllStatuses } from '@/lib/refresh-statuses'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`
  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })
  }

  const supabase = createAdminClient()
  try {
    const summary = await refreshAllStatuses(supabase)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: Verify `refreshAllStatuses` signature still accepts the admin client**

Run:

```bash
git grep -n "export.*refreshAllStatuses" src/lib/refresh-statuses.ts
```

Expected: the function signature accepts a `SupabaseClient`-compatible argument. The admin client is the same `SupabaseClient` type as before, so this should be fine. If TypeScript complains, the admin factory may need its return type adjusted to match — verify and fix inline.

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: all existing tests still pass (the cron route doesn't have unit tests, but the `refresh-statuses` tests should be unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/refresh-statuses/route.ts
git commit -m "refactor(cron): use admin client factory"
```

---

## Task 10: Wire root middleware

**Files:**
- Create: `middleware.ts` (project root)

- [ ] **Step 1: Create the middleware**

Create `middleware.ts` at the project root:

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     * - _next/static, _next/image (Next.js internals)
     * - common static files (favicons, icons, sw, manifest, bookmarklet)
     * The shouldGate() function inside updateSession() handles fine-grained
     * rules including auth/* and api/cron/* exemptions.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|icon-.*\\.(png|svg|ico)|bookmarklet\\.html).*)',
  ],
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test — local dev**

Run in one terminal:

```bash
npm run dev
```

Open browser to http://localhost:3000.

Expected: redirected to http://localhost:3000/login?returnTo=%2F

Then test the login:
- Enter `patrickdutremble@gmail.com`.
- Click "Send code".
- Wait for the email (check spam if needed).
- Enter the 6-digit code.
- Click "Verify code".
- Expected: redirected to `/`, see the main app.

If login fails: check browser console for errors, check that the dashboard config from Task 0 is correct.

- [ ] **Step 4: Stop dev server and commit**

```bash
git add middleware.ts
git commit -m "feat(auth): add root middleware to gate unauthenticated requests"
```

---

## Task 11: Apply RLS policy via SQL

**Files:**
- None in repo. This is a database change applied via the Supabase MCP server (or the SQL editor in the Supabase dashboard).

**Important context for the implementer:** Per project memory, the Supabase project ID is `erklsdwrhscuzkntomxu`. Use the Supabase MCP `execute_sql` tool with this exact project ID, **not** the other project ID that exists in some older notes. Apply via migration is preferred since this is a schema change.

- [ ] **Step 1: Inspect current RLS state on `listings`**

Run via Supabase MCP `execute_sql`:

```sql
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relname = 'listings';
```

Expected: row returned showing `relrowsecurity = false`. Confirm this is the case before applying changes.

- [ ] **Step 2: Inspect existing policies (should be none)**

Run:

```sql
SELECT polname, polcmd, polqual::text
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'listings';
```

Expected: no rows.

- [ ] **Step 3: Apply RLS migration**

Run via Supabase MCP `apply_migration` with name `enable_rls_listings`:

```sql
-- Enable RLS on the listings table
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Authenticated users have full access (read and write).
-- Unauthenticated requests using the anon key are denied for all operations.
-- The service role bypasses RLS entirely (used by the cron).
CREATE POLICY "authenticated_full_access"
  ON public.listings
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
```

Expected: migration applied successfully.

- [ ] **Step 4: Verify RLS is active**

Run via `execute_sql`:

```sql
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'listings';
```

Expected: `relrowsecurity = true`.

Run:

```sql
SELECT polname, polcmd, polqual::text, polwithcheck::text
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname = 'listings';
```

Expected: one row with `polname = 'authenticated_full_access'`, `polcmd = '*'`, both qual and withcheck containing `auth.uid() IS NOT NULL`.

- [ ] **Step 5: Smoke test — locally, the app still works while logged in**

Run `npm run dev`, log in, and verify:
- The main listings table loads.
- You can flag a listing as favorite (write).
- You can open a listing detail page (read).

If any of these fail with a permission error, the policy is too restrictive — check that the user is genuinely logged in (cookies present in dev tools) and that the policy SQL was applied to the right table.

- [ ] **Step 6: Smoke test — anon access denied**

In a fresh incognito browser tab, open dev tools → Console, and run:

```javascript
fetch('https://erklsdwrhscuzkntomxu.supabase.co/rest/v1/listings?select=id&limit=1', {
  headers: {
    apikey: '<NEXT_PUBLIC_SUPABASE_ANON_KEY value>',
    Authorization: 'Bearer <NEXT_PUBLIC_SUPABASE_ANON_KEY value>',
  },
}).then(r => r.json()).then(console.log)
```

(Substitute the anon key from `.env.local`.)

Expected: returns an empty array `[]` (RLS silently filters everything out for anonymous requests). If it returns actual listing data, RLS is not active — debug.

- [ ] **Step 7: Commit a note**

No code changed in this task, but document the migration:

```bash
git commit --allow-empty -m "feat(db): enable RLS on listings (migration enable_rls_listings)"
```

---

## Task 12: Update runbooks

**Files:**
- Modify: `docs/extraction-runbook.md`
- Modify: `docs/bookmarklet-runbook.md`

- [ ] **Step 1: Add an "Authentication" section to `docs/extraction-runbook.md`**

Open `docs/extraction-runbook.md`. Near the top of the file (after any title and before the first SQL step), insert a new section:

```markdown
## Authentication

The app is now auth-gated. Extraction queries you run via the Supabase MCP use the service role and bypass RLS — no auth needed for those.

Backfill scripts in `scripts/` that use `@supabase/supabase-js` directly with the anon key will fail under RLS. If you need a backfill script, use the service role key (only on a trusted machine, never check it in).
```

- [ ] **Step 2: Add an "Authentication" section to `docs/bookmarklet-runbook.md`**

Open `docs/bookmarklet-runbook.md`. Near the top, add:

```markdown
## Authentication

The bookmarklet itself does not authenticate. It relies on the user being logged in to the HouseHunter web app in the same browser. If the user is logged in, the new tab opened by the bookmarklet inherits the session cookie and works seamlessly. If not, the new tab lands on `/login` with `returnTo=/add-listing?...` and the user completes OTP, then the params flow through to the listing-add page.

No bookmarklet code changes are needed when modifying auth.
```

- [ ] **Step 3: Commit**

```bash
git add docs/extraction-runbook.md docs/bookmarklet-runbook.md
git commit -m "docs: note auth requirement in extraction and bookmarklet runbooks"
```

---

## Task 13: Delete the old `src/lib/supabase.ts`

**Files:**
- Delete: `src/lib/supabase.ts`

- [ ] **Step 1: Verify no remaining imports**

Run:

```bash
git grep -n "from '@/lib/supabase'" -- src/
```

Expected: no results. (All callers should now import from `@/lib/supabase/client`, `/server`, or `/admin`.)

If any imports remain, fix them before deleting. Common candidates: a test file, a script.

- [ ] **Step 2: Delete the file**

```bash
rm src/lib/supabase.ts
```

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A src/lib/supabase.ts
git commit -m "chore: remove obsolete src/lib/supabase.ts"
```

---

## Task 14: Full local manual test pass

**Files:** none. This is a manual verification task. Run the full checklist from the spec's Testing section.

- [ ] **Step 1: Start fresh**

```bash
npm run dev
```

Open an **incognito** browser window (no existing session).

- [ ] **Step 2: Cold login (Spec test #1)**

- Hit http://localhost:3000 → expect redirect to `/login?returnTo=%2F`.
- Enter `patrickdutremble@gmail.com` → click Send code.
- OTP arrives within ~30s.
- Enter code → click Verify.
- Expect: land on `/`, main app loads.
- Open dev tools → Application → Cookies → confirm `sb-*-auth-token` cookies exist.

- [ ] **Step 3: returnTo (Spec test #2)**

- Open a new incognito window.
- Pick a listing ID from the existing table. Hit `http://localhost:3000/recent/<id>`.
- Expect: redirect to `/login?returnTo=%2Frecent%2F<id>`.
- Log in.
- Expect: land back on `/recent/<id>` (not `/`).

- [ ] **Step 4: Bookmarklet, logged in (Spec test #3)**

- Already logged in.
- Open any Centris listing in another tab.
- Drag the local bookmarklet from `public/bookmarklet.html` to the bookmarks bar (or click it from the help page).
- Click bookmarklet on the Centris page.
- Expect: new tab opens `/add-listing?...`, listing saves successfully.

- [ ] **Step 5: Bookmarklet, logged out (Spec test #4)**

- Log out via the user menu.
- On a Centris listing page, click the bookmarklet.
- Expect: new tab opens, redirected to `/login?returnTo=/add-listing?url=...`.
- Log in.
- Expect: forwarded to `/add-listing?url=...`, listing saves.

- [ ] **Step 6: Allowlist rejection (Spec test #5)**

- Log out.
- On `/login`, enter a different email (e.g., `not-allowlisted@example.com`).
- Click Send code.
- Expect: error message displayed; no email arrives at that address (or, if it does, no user is created in Supabase Authentication → Users).

- [ ] **Step 7: Wrong OTP (Spec test #6)**

- On `/login`, enter `patrickdutremble@gmail.com`.
- Send code.
- Type a wrong code (e.g., `000000`).
- Click Verify.
- Expect: error "That code didn't match." Use real code from email → succeeds.

- [ ] **Step 8: Logout (Spec test #7)**

- Click the email in the top-right → Log out.
- Expect: redirected to `/login`. Hitting `/` again redirects to `/login`.

- [ ] **Step 9: Cron still works (Spec test #8)**

In a terminal, run:

```bash
curl -i -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2-)" http://localhost:3000/api/cron/refresh-statuses
```

Expected: HTTP 200 with a JSON summary (not 401).

- [ ] **Step 10: RLS without auth (Spec test #9)**

In incognito dev tools console:

```javascript
const url = '<NEXT_PUBLIC_SUPABASE_URL>'
const key = '<NEXT_PUBLIC_SUPABASE_ANON_KEY>'
fetch(`${url}/rest/v1/listings?select=id&limit=5`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
}).then(r => r.json()).then(console.log)
```

(Substitute actual values from `.env.local`.)

Expected: empty array `[]`. If it returns actual rows, **stop and debug** — RLS is not protecting the data.

- [ ] **Step 11: Session persistence (Spec test #10)**

- Logged in.
- Close the browser entirely.
- Reopen, navigate to http://localhost:3000.
- Expect: lands on `/` directly, no re-login.

- [ ] **Step 12: Proceed only if all 10 tests pass**

If any test fails, debug before proceeding to deployment. No code commit in this task — it's pure verification.

---

## Task 15: Deploy to Vercel and re-test on production

**Files:** none. This task involves Vercel dashboard work and production smoke tests.

- [ ] **Step 1: Confirm Vercel env vars are present**

In the Vercel dashboard for the project:
- `NEXT_PUBLIC_SUPABASE_URL` — already set.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — already set.
- `SUPABASE_SERVICE_ROLE_KEY` — already set (cron uses it).
- `CRON_SECRET` — already set.

No new env vars are needed for auth (Supabase Auth is configured server-side in the dashboard, not via env).

- [ ] **Step 2: Push to master**

```bash
git push origin master
```

Vercel auto-deploys.

- [ ] **Step 3: Watch the build**

In the Vercel dashboard, watch the deployment. Expected: green build.

If build fails on `next build`: most likely a Suspense issue (per project memory). Check the error and fix locally, push again.

- [ ] **Step 4: Production smoke test**

Open the production URL in incognito. Run a subset of the manual test checklist:
- Cold login.
- returnTo.
- Bookmarklet (using the production bookmarklet, not the local one).
- Logout.
- Cron via curl against the production `/api/cron/refresh-statuses` URL with the production CRON_SECRET.
- RLS check (replace localhost with production Supabase URL — same key, same expected empty result).

- [ ] **Step 5: If all production tests pass, the rollout is complete**

If any production test fails, decide whether to roll back (revert the merge commit) or hotfix forward.

---

## Task 16: Document how to add a second email (for future reference)

**Files:**
- Modify: `docs/superpowers/specs/2026-04-28-supabase-auth-rls-design.md` (already contains the steps in the "Adding a second email later" section).

- [ ] **Step 1: No code change**

The spec already documents this. Just confirm with the user that the steps in the spec's "Adding a second email later" section make sense, and answer any questions they have at that point.

The steps from the spec, restated:

1. Open the Supabase dashboard for project `erklsdwrhscuzkntomxu`.
2. Navigate to **Authentication → Users → Invite user** (Option A from Task 0) and enter the new email — or if Option B (allowlist textbox) was used, navigate to **Authentication → Sign-In / Up** and add the new email to the allowlist.
3. Save.
4. Tell that person to visit the app, enter their email, and complete the OTP.

No code change, no deploy.

---

## Self-Review

**Spec coverage:** Each spec section maps to tasks:
- Architecture (Auth provider, library, code layout, enforcement, public surface, cron exception) → Tasks 1, 2, 3, 9, 10, 11.
- Components (new files, edited files, files that don't change) → Tasks 2, 3, 4, 5, 6, 7, 8, 9, 13.
- Data flow (login, authenticated request, bookmarklet, cron, logout) → exercised in manual tests (Task 14) and verified in Task 15.
- Error handling → wired into login page (Task 4) and middleware (Task 2/10); spec out-of-scope items not implemented by design.
- Testing (automated, manual, dashboard checks, what's not tested) → Task 3 (automated unit tests for shouldGate), Task 14 (manual checklist), Task 11 (dashboard checks via SQL), Task 0 (dashboard config).

No gaps.

**Placeholder scan:** No "TBD," no "implement later," no vague "add error handling" — all errors are concrete with literal copy. All code blocks are complete.

**Type consistency:** `createClient()` is the function name in client.ts, server.ts; `createAdminClient()` in admin.ts (intentionally distinct so callers can't confuse it with the user-scoped clients). `updateSession(request)` is the middleware helper name everywhere it's referenced. `shouldGate(pathname)` matches between definition (Task 3) and consumer (Task 2's middleware.ts).

One minor inconsistency caught and fixed inline: the auth callback route uses `exchangeCodeForSession` but for OTP the actual session is set by `verifyOtp` client-side; the callback route is documented as a fallback for any link-based emails Supabase might send. This is noted in the task description.
