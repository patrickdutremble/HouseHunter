# Compare Button Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Compare action from a fixed bottom-center floating cluster into the header toolbar so it never overlaps table content.

**Architecture:** Pure JSX relocation in [src/app/page.tsx](src/app/page.tsx). No state changes, no new components, no new tests. The existing `compareIds` state, `toggleCompare`, `clearCompare`, `openCompare`, `compareMaxWarning` state, and the 2-second auto-dismiss `useEffect` are reused as-is. The amber warning chip is repositioned via `absolute` inside a `relative` wrapper around the header cluster.

**Tech Stack:** Next.js client component, Tailwind CSS.

**Spec:** [docs/superpowers/specs/2026-04-21-compare-button-relocation-design.md](docs/superpowers/specs/2026-04-21-compare-button-relocation-design.md)

**Why no unit tests:** The change is layout-only — no new logic, no new state, no new functions. Existing logic (`toggleCompare`, `clearCompare`, `openCompare`, `compareMaxWarning` effect) is unchanged. The codebase has no tests for `src/app/page.tsx` (it's heavy with `useListings` data fetching). Verification is via browser preview at multiple widths, per the project's CLAUDE.md guidance: *"For UI or frontend changes, start the dev server and use the feature in a browser before reporting the task as complete."*

---

## Task 1: Relocate Compare cluster into header

**Files:**
- Modify: [src/app/page.tsx](src/app/page.tsx) — header JSX (around line 209–218) and remove the fixed-bottom block (lines 264–290)

### - [ ] Step 1: Make the scrape status message shrinkable

In [src/app/page.tsx](src/app/page.tsx), find this block (around lines 209–214):

```tsx
{/* Status message */}
{scrapeStatus !== 'idle' && scrapeStatus !== 'loading' && scrapeMessage && (
  <span className={`text-sm font-medium whitespace-nowrap ${statusColor}`}>
    {scrapeMessage}
  </span>
)}
```

Replace with (adds `truncate min-w-0` so the message shrinks before the Compare cluster does):

```tsx
{/* Status message */}
{scrapeStatus !== 'idle' && scrapeStatus !== 'loading' && scrapeMessage && (
  <span className={`text-sm font-medium truncate min-w-0 ${statusColor}`}>
    {scrapeMessage}
  </span>
)}
```

Note: `whitespace-nowrap` is removed so `truncate` (which implies `whitespace: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`) can take effect properly within a flex row.

### - [ ] Step 2: Insert the Compare cluster before the ViewToggle

In [src/app/page.tsx](src/app/page.tsx), find this line (around line 216):

```tsx
        <ViewToggle current={view} onChange={handleViewChange} />
```

Insert the following block immediately **before** that line:

```tsx
        {/* Compare cluster — appears when 2+ listings selected */}
        {compareIds.size >= 2 && (
          <div className="relative flex items-center gap-1.5">
            <button
              onClick={openCompare}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.166a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
              </svg>
              <span><span className="hidden sm:inline">Compare </span>({compareIds.size})</span>
            </button>
            <button
              onClick={clearCompare}
              className="p-1.5 text-slate-400 bg-white border border-slate-200 rounded-lg hover:text-slate-600 hover:bg-slate-50 transition-colors"
              title="Clear selection"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l10 10M15 5L5 15" />
              </svg>
            </button>
            {compareMaxWarning && (
              <span className="absolute top-full right-0 mt-1 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg shadow-lg whitespace-nowrap z-30">
                Maximum 5 listings
              </span>
            )}
          </div>
        )}
```

Notes on differences from the old fixed-bottom version:
- Padding shrunk from `px-4 py-2.5` → `px-3 py-1.5` and icon from 16 → 14 to match the existing header buttons (Paste/Add).
- `shadow-lg` removed from the buttons — they're now inside the header bar where shadows look out of place.
- `gap-2` → `gap-1.5` to match the rest of the header.
- The wrapper `<div>` is `relative` so the warning chip can anchor to it.

### - [ ] Step 3: Delete the fixed-bottom Compare block

In [src/app/page.tsx](src/app/page.tsx), find and **delete entirely** this block (currently around lines 264–290):

```tsx
      {compareIds.size >= 2 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
          <button
            onClick={openCompare}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 3.75A.75.75 0 012.75 3h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 3.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.166a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75zm0 4.167a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
            </svg>
            Compare ({compareIds.size})
          </button>
          <button
            onClick={clearCompare}
            className="p-2 text-slate-400 bg-white border border-slate-200 rounded-lg shadow-lg hover:text-slate-600 hover:bg-slate-50 transition-colors"
            title="Clear selection"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
          {compareMaxWarning && (
            <span className="px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg shadow-lg">
              Maximum 5 listings
            </span>
          )}
        </div>
      )}
```

### - [ ] Step 4: Verify TypeScript and linting pass

Run: `npm run lint && npx tsc --noEmit`

Expected: no errors. If `npm run lint` doesn't exist in package.json, just run `npx tsc --noEmit`.

### - [ ] Step 5: Verify in browser preview

Use the `preview_*` tools per the project's verification workflow:

1. Start the dev server: `preview_start` (if not already running).
2. Use `preview_snapshot` to load the home page.
3. Test the golden path:
   - Select 1 listing via checkbox — confirm **no** Compare cluster appears (threshold is 2).
   - Select a 2nd listing — confirm Compare cluster appears in the header **between the status message slot and ViewToggle**.
   - Select 3 more (total 5) — confirm count updates to `(5)`.
   - Try to select a 6th — confirm the amber `Maximum 5 listings` chip appears anchored below the Compare cluster (top-right of cluster) and disappears after ~2s.
   - Click the X (Clear) button — confirm cluster disappears and all checkboxes clear.
   - Re-select 2, click Compare — confirm a new tab opens at `/compare?ids=...`.
4. Test responsive behavior with `preview_resize`:
   - At width **1280px**: Compare button shows full `Compare (N)` label.
   - At width **640px** (sm breakpoint): label still shows.
   - At width **500px**: label collapses to icon + `(N)` only.
   - At width **360px**: header stays single-row, no horizontal scroll, no overlap with the table.
5. Use `preview_console_logs` to confirm no React warnings or errors.
6. Use `preview_screenshot` at 1280px **and** 360px to share visual proof.

### - [ ] Step 6: Commit

```bash
git add src/app/page.tsx docs/superpowers/plans/2026-04-21-compare-button-relocation.md
git commit -m "$(cat <<'EOF'
refactor(compare): move Compare action from floating cluster into header

Relocates Compare button + Clear-X from fixed bottom-center to the
header toolbar (between status message and ViewToggle) so it no longer
overlaps table content at narrow widths or on mobile. Label collapses
to icon + count below sm breakpoint. Max-5 warning chip is now anchored
absolutely below the cluster.
EOF
)"
```

---

## Self-review notes

- **Spec coverage:** Header layout (Step 2), responsive collapse (Step 2 — `hidden sm:inline`), max-5 warning anchored to button (Step 2 — `absolute top-full right-0`), removal of fixed-bottom block (Step 3), map view inheritance (header sits above both views — no extra work), out-of-scope items (toast, /compare page, selection logic) all left alone.
- **Type consistency:** No new types or function signatures introduced. All identifiers (`compareIds`, `openCompare`, `clearCompare`, `compareMaxWarning`) match what exists in [src/app/page.tsx](src/app/page.tsx).
- **No placeholders:** All code blocks contain final, copy-pasteable JSX. Browser verification steps are concrete.
