# RLS Follow-up Batch B — Code DRY-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove two pieces of duplication / sloppiness left by yesterday's RLS migration: the open-redirect-prevention `returnTo` validator (currently copy-pasted in two places) and three Supabase client initialisations that ended up sandwiched between import statements.

**Architecture:** Extract the validator into a single tiny pure module at `src/lib/safe-return-to.ts`, unit-test it, and replace both inline copies with a call to the helper. Separately, move the three stray `const supabase = createClient()` lines below their import blocks where they belong.

**Tech Stack:** Next.js 16, TypeScript, Vitest. Pure functions only — no Supabase or env access in the helper.

---

## File Structure

**Create:**
- `src/lib/safe-return-to.ts` — `safeReturnTo(raw: string | null | undefined): string`
- `src/lib/__tests__/safe-return-to.test.ts` — unit tests covering same-origin paths, null/empty, protocol-relative attacks, absolute URLs

**Modify:**
- `src/app/login/page.tsx` — replace inline validator with helper call
- `src/app/auth/callback/route.ts` — replace inline validator with helper call
- `src/app/add-listing/AddListingClient.tsx` — move `const supabase = createClient()` below imports
- `src/app/compare/page.tsx` — same
- `src/app/trash/page.tsx` — same

---

## Task 1: `safeReturnTo` helper (TDD)

**Files:**
- Create: `src/lib/safe-return-to.ts`
- Test: `src/lib/__tests__/safe-return-to.test.ts`

The current inline expression (duplicated in both call sites) is:

```typescript
const returnTo = rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/'
```

This rejects: null/undefined/empty, anything not starting with `/`, and protocol-relative URLs like `//evil.com`. It accepts: any same-origin path starting with a single `/`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/safe-return-to.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { safeReturnTo } from '@/lib/safe-return-to'

describe('safeReturnTo', () => {
  it('returns "/" for null', () => {
    expect(safeReturnTo(null)).toBe('/')
  })

  it('returns "/" for undefined', () => {
    expect(safeReturnTo(undefined)).toBe('/')
  })

  it('returns "/" for empty string', () => {
    expect(safeReturnTo('')).toBe('/')
  })

  it('returns the path when it starts with a single "/"', () => {
    expect(safeReturnTo('/')).toBe('/')
    expect(safeReturnTo('/recent')).toBe('/recent')
    expect(safeReturnTo('/add-listing?url=https%3A%2F%2Fcentris.ca%2F123')).toBe(
      '/add-listing?url=https%3A%2F%2Fcentris.ca%2F123'
    )
  })

  it('returns "/" for protocol-relative URLs (open-redirect attack)', () => {
    expect(safeReturnTo('//evil.com')).toBe('/')
    expect(safeReturnTo('//evil.com/path')).toBe('/')
  })

  it('returns "/" for absolute URLs', () => {
    expect(safeReturnTo('https://evil.com')).toBe('/')
    expect(safeReturnTo('http://example.com/path')).toBe('/')
  })

  it('returns "/" for paths that do not start with "/"', () => {
    expect(safeReturnTo('recent')).toBe('/')
    expect(safeReturnTo('javascript:alert(1)')).toBe('/')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `npx vitest run src/lib/__tests__/safe-return-to.test.ts`
Expected: FAIL — module `@/lib/safe-return-to` not found.

- [ ] **Step 3: Implement `safeReturnTo`**

Create `src/lib/safe-return-to.ts`:

```typescript
export function safeReturnTo(raw: string | null | undefined): string {
  if (!raw) return '/'
  if (!raw.startsWith('/')) return '/'
  if (raw.startsWith('//')) return '/'
  return raw
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run src/lib/__tests__/safe-return-to.test.ts`
Expected: PASS — all 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/safe-return-to.ts src/lib/__tests__/safe-return-to.test.ts
git commit -m "feat(auth): add safeReturnTo helper to centralise open-redirect guard"
```

---

## Task 2: Replace the inline validator in `login/page.tsx`

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Update the imports and the validator usage**

In `src/app/login/page.tsx`, find lines 3–11:

```typescript
import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawReturnTo = searchParams.get('returnTo')
  const returnTo = rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/'
```

Change to:

```typescript
import { Suspense, useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { safeReturnTo } from '@/lib/safe-return-to'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
```

Note: `rawReturnTo` is no longer needed — the helper accepts the raw nullable string directly. The rest of the file (lines 13+) is unchanged.

- [ ] **Step 2: Run the test suite**

Run: `npx vitest run`
Expected: PASS — all existing tests + the 7 new helper tests.

- [ ] **Step 3: Run the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "refactor(login): use safeReturnTo helper"
```

---

## Task 3: Replace the inline validator in `auth/callback/route.ts`

**Files:**
- Modify: `src/app/auth/callback/route.ts`

- [ ] **Step 1: Update the imports and the validator usage**

Replace `src/app/auth/callback/route.ts` (entire file) with:

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeReturnTo } from '@/lib/safe-return-to'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const returnTo = safeReturnTo(searchParams.get('returnTo'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${returnTo}`)
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error)
  } else {
    console.error('[auth/callback] missing code parameter')
  }

  return NextResponse.redirect(`${origin}/login?error=callback_failed`)
}
```

The only differences from the current file are:
1. Added `import { safeReturnTo } from '@/lib/safe-return-to'` on line 3.
2. Removed the `rawReturnTo` line and replaced the inline validator expression with a `safeReturnTo()` call.

Behaviour is identical — the helper encodes the same logic as the inline expression.

- [ ] **Step 2: Run the test suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 3: Run the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/callback/route.ts
git commit -m "refactor(auth): use safeReturnTo helper in callback route"
```

---

## Task 4: Tidy import grouping (3 files)

**Files:**
- Modify: `src/app/add-listing/AddListingClient.tsx`
- Modify: `src/app/compare/page.tsx`
- Modify: `src/app/trash/page.tsx`

Each file currently has `const supabase = createClient()` sandwiched between two import statements. Move it below all imports. Behaviour is unchanged because module-level statements run in source order regardless — this is purely cosmetic / lint-friendly.

- [ ] **Step 1: Fix `src/app/add-listing/AddListingClient.tsx`**

Find lines 6–10:

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
```

Change to:

```typescript
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'

const supabase = createClient()
```

- [ ] **Step 2: Fix `src/app/compare/page.tsx`**

Find lines 6–15:

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { getBestValues, type BestMap } from '@/lib/comparison'
import { criteria, countChecked, deriveCriteria, isDerivedCriterion, type CriterionKey } from '@/lib/criteria'
import { formatCellValue } from '@/lib/formatting'
import type { ColumnFormat } from '@/lib/columns'
import type { Listing } from '@/types/listing'
```

Change to:

```typescript
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import { getBestValues, type BestMap } from '@/lib/comparison'
import { criteria, countChecked, deriveCriteria, isDerivedCriterion, type CriterionKey } from '@/lib/criteria'
import { formatCellValue } from '@/lib/formatting'
import type { ColumnFormat } from '@/lib/columns'
import type { Listing } from '@/types/listing'

const supabase = createClient()
```

- [ ] **Step 3: Fix `src/app/trash/page.tsx`**

Find lines 5–10:

```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import type { Listing } from '@/types/listing'
```

Change to:

```typescript
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/ThemeToggle'
import { UserMenu } from '@/components/UserMenu'
import type { Listing } from '@/types/listing'

const supabase = createClient()
```

- [ ] **Step 4: Run the test suite**

Run: `npx vitest run`
Expected: PASS — all tests still green (this is a pure cosmetic move, behaviour unchanged).

- [ ] **Step 5: Run the build**

Run: `npx next build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/app/add-listing/AddListingClient.tsx src/app/compare/page.tsx src/app/trash/page.tsx
git commit -m "style: move createClient() calls below import blocks"
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
1. Navigate to `/login?returnTo=/recent` while signed out → after sign-in, you should land on `/recent` (not `/`). This proves the helper still passes through legitimate paths.
2. Navigate to `/login?returnTo=//evil.com` → after sign-in, you should land on `/` (the helper rejected the malicious value).
3. Navigate to `/add-listing?url=...`, `/compare?...`, and `/trash` while signed in → all three pages should still load and Supabase queries should still work (proves the import-tidy didn't break the module-level `supabase` constant).

---

## Notes for Patrick

- 4 commits total, each safe to roll back independently.
- Zero behavioural change for legitimate users. The validator behaves identically to the inline copies it replaces — this is just code organisation.
- The new helper centralises a small but security-relevant piece of code, so any future tightening (e.g. blocking specific paths, normalising case) only needs to be made in one place.
