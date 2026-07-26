# Email Favorites Notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Include each favorited listing's `Notes` text alongside its Centris link in the "Email favorites" email body.

**Architecture:** Single-function change in `src/components/UserMenu.tsx`. Extend the existing Supabase `select` to also fetch `notes`, then build the mail body as one "link + `Note:` line" block per listing instead of a bare newline-joined link list. No schema, query-shape, or backend changes.

**Tech Stack:** Next.js (React client component), Supabase JS client, `mailto:` URL.

---

### Task 1: Fetch notes and format link + note in the email body

**Files:**
- Modify: `src/components/UserMenu.tsx:60-87` (the `handleEmailFavorites` function)

- [ ] **Step 1: Add `notes` to the select**

In `handleEmailFavorites`, change the `.select('centris_link')` call to also request `notes`:

```ts
const { data, error } = await supabase
  .from('listings')
  .select('centris_link, notes')
  .eq('favorite', true)
  .is('deleted_at', null)
  .not('centris_link', 'is', null)
```

Leave the `setOpen(false)`, the `error` guard, and the `console.error` line exactly as they are.

- [ ] **Step 2: Build link + note blocks instead of a bare link list**

Replace the current block that maps to `links`, checks for empty, and builds `subject`/`body`:

```ts
const links = (data ?? [])
  .map((l) => l.centris_link)
  .filter((link): link is string => Boolean(link))

if (links.length === 0) {
  window.alert('No favorited listings with Centris links.')
  return
}

const subject = `Favorited listings (${links.length})`
const body = links.join('\n')
window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
```

with a version that keeps each row's link and note together:

```ts
const entries = (data ?? []).filter(
  (l): l is { centris_link: string; notes: string | null } => Boolean(l.centris_link),
)

if (entries.length === 0) {
  window.alert('No favorited listings with Centris links.')
  return
}

const subject = `Favorited listings (${entries.length})`
const body = entries
  .map((l) => {
    const note = l.notes?.trim()
    return `${l.centris_link}\nNote: ${note ? note : '(none)'}`
  })
  .join('\n\n')
window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
```

Notes on this code:
- `entries` replaces the old `links` array so the row's `notes` stays paired with its `centris_link`.
- The `filter` type guard narrows out any row whose `centris_link` is falsy (the query already excludes nulls, but this keeps TypeScript happy and the count honest).
- `note ? note : '(none)'` yields `Note: (none)` when `notes` is null or blank after trimming, matching the approved spec.
- `\n\n` puts a blank line between listings.

- [ ] **Step 3: Verify the type checker and linter pass**

Run: `npm run lint`
Expected: no new errors from `src/components/UserMenu.tsx`.

Run: `npx tsc --noEmit`
Expected: no type errors. (If the project has a dedicated typecheck script, e.g. `npm run typecheck`, run that instead.)

- [ ] **Step 4: Manual verification**

There is no test file for `UserMenu.tsx` and the behavior is a `mailto:` side-effect, so verify by hand:

1. Start the dev server (`npm run dev`) and sign in.
2. Favorite 2–3 listings — at least one with a `Notes` value and one with the `Notes` field empty.
3. Open the account menu and click "Email favorites".
4. Confirm the draft email opens with, for each listing, the Centris link on one line and `Note: <text>` on the next, with `Note: (none)` for the listing that had no note, and a blank line between listings.

- [ ] **Step 5: Commit**

```bash
git add src/components/UserMenu.tsx
git commit -m "feat(email-favorites): include listing notes in the email body"
```
