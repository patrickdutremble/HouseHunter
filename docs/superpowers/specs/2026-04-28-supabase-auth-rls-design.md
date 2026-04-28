# Supabase Auth + RLS for HouseHunter

**Date:** 2026-04-28
**Status:** Design (pre-implementation)

## Goal

Lock down the HouseHunter app and its Supabase database so that only allowlisted users can read or write data. Today, anyone who finds the Vercel URL can read every listing, and the public anon key (visible in the browser bundle) lets anyone insert, update, or delete rows. This design adds a login screen, gates every page and write API behind a session, and adds a Row Level Security (RLS) policy as a safety net at the database itself.

## Non-goals

- Per-user data isolation (private notes, separate listing sets per user). Both authenticated users see and edit the same shared data, by design.
- Password reset, account recovery, or "lost access" flows. For a personal tool with a small allowlist, recovery is "edit the allowlist via the Supabase dashboard."
- Public landing page, marketing pages, or any unauthenticated read access.
- Auditing who did what. No `created_by` / `updated_by` columns added.

## Decisions

| Question | Decision | Rationale |
|---|---|---|
| Login mechanism | Email OTP (6-digit code) | Avoids Gmail link prefetching that has burned the user before; no password to manage. |
| SMTP | Reuse user's existing personal Gmail SMTP (app password) | Already configured for another project; lifts the default Supabase rate limit. |
| Where to enforce auth | Next.js middleware + RLS as defense-in-depth | One enforcement point in code; database refuses unauthenticated requests even if middleware fails. |
| Session storage | Cookies via `@supabase/ssr` | Canonical Supabase + Next.js App Router pattern. Same session readable from browser, server components, server routes, and middleware. |
| Logout UX | Visible "Log out" item in a small top-right user menu on every page | Needed once a second user is added so accounts can be switched cleanly. |
| Allowlist | Start with `patrickdutremble@gmail.com`; structure ready for adding a second email | Plain-language steps to add second email at deploy time. |

## Architecture

**Auth provider:** Supabase Auth, email OTP enabled, magic-link disabled, custom SMTP populated with the user's Gmail credentials. Allowlist enforced via Supabase Auth's "allowed email addresses" setting.

**Library:** `@supabase/ssr` (added as a dependency). Provides three client factories that share session state via cookies: browser, server, middleware.

**Code layout:** the existing single-file `src/lib/supabase.ts` is replaced with a folder:

- `src/lib/supabase/client.ts` — browser-side client. Used by client components and `'use client'` files.
- `src/lib/supabase/server.ts` — server-side client (cookie-aware). Used by server components and API routes that act as the user.
- `src/lib/supabase/middleware.ts` — used only by the root `middleware.ts`. Refreshes the session cookie on each request.
- `src/lib/supabase/admin.ts` — service-role client. Used only by the cron and any server task that must bypass RLS.

**Enforcement:**

- **`middleware.ts`** at the project root runs before every request. Reads the session cookie via `src/lib/supabase/middleware.ts`, refreshes it if near expiry, and redirects unauthenticated requests to `/login?returnTo=<original path with query>`. Excludes the cron path (`/api/cron/*`), Next.js internals (`/_next/*`), the login page itself, and the auth callback route.
- **Row Level Security** enabled on the `listings` table. A single policy named `authenticated_full_access` permits all operations (SELECT, INSERT, UPDATE, DELETE) when `auth.uid() IS NOT NULL`. The cron uses the service-role client, which bypasses RLS by design.

**Public surface:** none. The bookmarklet target (`/add-listing`) is gated like every other page.

## Components

### New files

- **`middleware.ts`** (project root) — ~25 lines. Imports the helper from `src/lib/supabase/middleware.ts`, applies the redirect rule, and sets the `matcher` config to exclude internals.
- **`src/lib/supabase/client.ts`** — ~10 lines. Exports `createClient()` that wraps `createBrowserClient` from `@supabase/ssr`.
- **`src/lib/supabase/server.ts`** — ~20 lines. Exports `createClient()` that wraps `createServerClient` from `@supabase/ssr` and wires it to Next.js's `cookies()` helper.
- **`src/lib/supabase/middleware.ts`** — ~30 lines. Exports `updateSession(request)` that creates a middleware client, refreshes the session, and returns either a redirect response or a passthrough response with refreshed cookies.
- **`src/lib/supabase/admin.ts`** — ~10 lines. Exports a service-role client built from `SUPABASE_SERVICE_ROLE_KEY`. No cookie awareness.
- **`src/lib/middleware-paths.ts`** — ~15 lines. Exports `shouldGate(pathname: string): boolean` — pure function used by middleware and unit-tested directly.
- **`src/app/login/page.tsx`** — login screen. Two states: email entry → OTP entry. Calls `signInWithOtp({ email })` then `verifyOtp({ email, token, type: 'email' })`. On success redirects to `searchParams.returnTo ?? '/'`.
- **`src/app/auth/callback/route.ts`** — server route used by Supabase's PKCE finalization. Standard pattern from Supabase docs. ~20 lines.
- **`src/components/UserMenu.tsx`** — small top-right menu showing the signed-in email and a "Log out" item. Renders `null` when not authenticated.
- **`src/lib/__tests__/middleware-paths.test.ts`** — unit tests for `shouldGate`.

### Edited files

- **`src/lib/supabase.ts`** — deleted once all callers migrate.
- **`src/app/layout.tsx`** — drop `<UserMenu />` into the layout so it appears on every page.
- **`src/app/api/scrape-centris/route.ts`** — switch from anon client to server client (cookie-aware) so RLS sees the user.
- **`src/app/api/cron/refresh-statuses/route.ts`** — swap `createClient` from `@supabase/supabase-js` to `createAdminClient` from `@/lib/supabase/admin`. No behavior change.
- **The five other Supabase callers** (`AddListingClient.tsx`, `trash/page.tsx`, `compare/page.tsx`, `commute.ts`, `useListings.ts`) — change import from `@/lib/supabase` to `@/lib/supabase/client`. Call sites unchanged.
- **`docs/extraction-runbook.md`** and **`docs/bookmarklet-runbook.md`** — note that the app is now auth-gated; future Claude sessions reading these runbooks need to know to log in (or use service-role for backfill scripts).
- **`package.json`** — adds `@supabase/ssr` dependency.

### Files that don't change

- `public/bookmarklet.html` — the bookmarklet still opens `/add-listing?...` in a new tab; middleware handles the rest. The first time it runs without a session, the user lands on `/login` with `returnTo` set; after OTP, they're forwarded to `/add-listing` with all params intact.

## Data flow

### Login (cold, no session)

1. User hits any URL → middleware detects no session → redirects to `/login?returnTo=<path>`.
2. User submits email → page calls `supabase.auth.signInWithOtp({ email })` → Supabase emails a 6-digit code via Gmail SMTP.
3. User submits code → page calls `supabase.auth.verifyOtp({ email, token, type: 'email' })` → Supabase sets session cookies on the response.
4. Page redirects to `returnTo` (defaulting to `/`) → middleware sees a valid session → request continues.

### Authenticated request (the common case)

1. User hits a URL → middleware reads the session cookie → cookie is valid (refreshes silently if near expiry) → request continues.
2. The page or API route uses the server Supabase client (cookie-aware), which forwards the user identity to Supabase.
3. Supabase checks RLS: `auth.uid() IS NOT NULL` → policy passes → query runs.

### Bookmarklet

1. User on a Centris page clicks the bookmarklet → it opens a new tab to `/add-listing?url=...&price=...&...`.
2. **If logged in:** new tab inherits the session cookie → middleware allows → page runs → `POST /api/scrape-centris` runs as the user → RLS allows → listing inserted.
3. **If not logged in (rare):** middleware redirects to `/login?returnTo=/add-listing?url=...&price=...&...` → user enters OTP → forwarded to `/add-listing` with params intact → flow proceeds as in case 2.

### Cron (no user)

1. Vercel Cron pings `/api/cron/refresh-statuses` with `Authorization: Bearer <CRON_SECRET>`.
2. Route validates the secret → uses the admin (service-role) client → bypasses RLS → does its work.

### Logout

1. User clicks "Log out" in `<UserMenu />` → calls `supabase.auth.signOut()` → cookies cleared.
2. Next navigation hits middleware → no session → redirected to `/login`.

## Error handling

### Login page

- **Email not on allowlist** — Supabase rejects the OTP request. UI: *"This email isn't authorized. Contact Patrick if you should have access."* Message is intentionally generic to avoid leaking which addresses are valid.
- **Wrong OTP code** — Supabase returns `invalid token`. UI: *"That code didn't match. Try again or request a new one."* with a "Send a new code" button.
- **Expired OTP code** (default 1-hour window) — same UX as wrong code.
- **SMTP rate limit / send failure** — UI: *"Couldn't send the code right now. Wait a minute and try again."* Underlying error logged to the browser console.
- **No email arrives** — not detectable from our side. After ~30 seconds the page surfaces a *"Didn't get it? Check spam, or send a new code"* hint.
- **Network error mid-verify** — generic UI: *"Something went wrong. Try again."*

### Protected pages and API routes (post-login)

- **Session expired between page loads** — middleware redirects to `/login?returnTo=...`. User logs in once, lands back where they were.
- **Session expired mid-action** — server client returns an auth error → page shows: *"Your session expired. Please log in again."* with a button to `/login` with `returnTo` set to the current page.
- **RLS denies a query** (defense-in-depth, should not occur in normal use) — API routes return `401 { error: 'Unauthorized' }`; pages catch and bounce to login.

### Bookmarklet flow

- **Params survive login redirect** — `returnTo` carries the full path including query string. Standard URL encoding handles ampersands and special characters.
- **Params lost edge case** — if `returnTo` is somehow stripped (encoding issue or proxy), the new tab lands on `/` instead of `/add-listing`. User would re-click the bookmarklet on the source Centris page. Annoying but not data loss; not building defensive infra unless we observe it.

### Cron failures

No change. Existing handler returns 401 on missing secret and 500 with the error message on Supabase rejection.

### Explicitly out of scope

- **Lost Gmail access** (can't receive OTP). Recovery is "edit the allowlist or rotate via the Supabase dashboard." No in-app recovery flow.
- **Concurrent logins** (phone + desktop). Supabase handles this natively; both sessions valid.

## Testing

### Automated (Vitest)

- **`shouldGate(pathname)` unit tests** — gates `/`, `/recent`, `/recent/<id>`, `/add-listing`, `/api/scrape-centris`; lets through `/login`, `/auth/callback`, `/api/cron/refresh-statuses`, `/_next/static/*`, `/_next/image`, `/manifest.json`, `/icon-*.png`, `/sw.js`, `/bookmarklet.html`.
- No mocked-Supabase-auth tests. They prove little; the real flow is verified manually.

### Manual checklist

Run on `npm run dev`, then again on a Vercel preview before merging to master.

1. **Cold login** — incognito → hit `/` → redirected to `/login` → enter email → OTP arrives within ~30s → enter code → land on `/`. Session cookie present in dev tools.
2. **`returnTo`** — incognito → hit `/recent/<id>` → redirected → log in → land back on the same `/recent/<id>`.
3. **Bookmarklet logged in** — already logged in → click bookmarklet on a Centris page → new tab opens `/add-listing?...` → listing saves successfully.
4. **Bookmarklet logged out** — log out → click bookmarklet → bounced to login → complete OTP → land on `/add-listing` with params → listing saves.
5. **Allowlist rejection** — try a non-allowlisted email → clean error message → no OTP sent → no user created in Supabase.
6. **Wrong OTP** — request a code → type a wrong code → see error → request a fresh code → succeed.
7. **Logout** — click "Log out" → redirected to `/login` → hitting `/` redirects back to login.
8. **Cron still works** — manually invoke `/api/cron/refresh-statuses` with the bearer token via `curl` → 200 + summary JSON.
9. **RLS without auth** — open dev tools → run a raw `fetch` against the Supabase REST endpoint with the anon key but no session → confirm empty result or error. This is the security claim.
10. **Session persistence** — close browser → reopen → navigate to `/` → no re-login required.

### Pre-deployment Supabase dashboard checks

- RLS confirmed enabled on the `listings` table.
- Policy visible; SQL reads `auth.uid() IS NOT NULL` for all four operations.
- Auth → Email provider: OTP enabled, magic-link disabled.
- SMTP populated; "send test email" succeeds.
- Allowlist contains exactly `patrickdutremble@gmail.com`.

### What is deliberately not tested

- SMTP rate limits in production (would burn real budget for low value).
- OTP expiry timing (Supabase's responsibility).
- Session refresh edge cases at the cookie-expiry boundary (Supabase's responsibility).

## Open items deferred to implementation plan

- Exact UI styling of the login page (matches existing design system).
- Whether the user menu is a hover dropdown or a click toggle.
- Exact wording of error messages (will iterate during manual testing).

## Adding a second email later (steps for the user)

1. Open the Supabase dashboard for project `erklsdwrhscuzkntomxu`.
2. Navigate to **Authentication → Sign-In / Up → Email**.
3. Find the allowlist setting (exact label depends on Supabase dashboard version; either an "Allowed email addresses" textarea or a similar field).
4. Add the new email on its own line, save.
5. Tell that person to visit the app, enter their email, and complete the OTP.

No code change needed.
