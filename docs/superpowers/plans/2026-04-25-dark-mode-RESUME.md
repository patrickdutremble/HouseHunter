# Dark Mode — Resume Note

**Branch:** `feat/dark-mode`
**Last session ended at:** Checkpoint 4 (after Task 10)
**Plan:** [`docs/superpowers/plans/2026-04-25-dark-mode.md`](./2026-04-25-dark-mode.md)
**Spec:** [`docs/superpowers/specs/2026-04-25-dark-mode-design.md`](../specs/2026-04-25-dark-mode-design.md)

## Status

10 of 16 plan tasks complete + a handful of fixes. Foundation, map, page shells, and toolbar all done. Table content, cards, action buttons, share-card lock, manual verification, and final cleanup remain.

| Task | Status | Notes |
|---|---|---|
| 1 — globals.css tokens | ✅ done | |
| 2 — ThemeProvider | ✅ done | TDD, 5 tests |
| 3 — ThemeToggle | ✅ done | TDD, 4 tests; later moved from fixed to inline |
| 4 — layout.tsx wiring | ✅ done | Inline script + provider + statusBar fix |
| 5 — marker-style.ts | ✅ done | Non-favorite pill uses tokens |
| 6 — MapView CARTO tiles | ✅ done | Light/dark basemap swap with `key={resolvedTheme}` |
| 7 — Main page shell | ✅ done | Add/Compare buttons standardized to `bg-accent` |
| 8 — Secondary route shells | ✅ done | 6 files; ThemeToggle added to all headers |
| 9 — Compare page | ✅ done | No inline color styles found; tokenized only |
| 10 — Toolbar components | ✅ done | 5 files: FilterBar, FilterPanel, SortPanel, ViewToggle, RefreshStatusesButton |
| **11 — Table components** | ⏳ **NEXT** | 6 files; biggest single task; state-tinted rows |
| 12 — Cards/details | ⏳ pending | ListingCard, DetailPanel, ListingPopup |
| 13 — Action buttons | ⏳ pending | FavoriteButton, FlagButton |
| 14 — SharePreviewCard locked-light | ⏳ pending | Special `hh-force-light` wrapper |
| 15 — Manual verification | ⏳ pending | Walk every route in both modes |
| 16 — Build/lint/test/cleanup | ⏳ pending | Plus delete `public/theme-preview.html` |

## Deviations from the original plan (worth knowing)

1. **ThemeToggle is inline, not fixed.** Plan called for `fixed top-4 right-4`. That overlapped with ViewToggle on desktop and the trash icon on mobile. Now placed inline next to ViewToggle on `/` and inside each route's header.
2. **`--color-accent` is sky-600 (`#0284c7`) in light mode.** Plan said sky-500. Reviewer caught a WCAG AA contrast violation (3.0:1). Bumped to sky-600 → 4.6:1. Hover/active also shifted up: `hover:bg-sky-700 dark:hover:bg-sky-300 active:bg-sky-800 dark:active:bg-sky-200`.
3. **iOS PWA `statusBarStyle`** is `'black-translucent'` (was `'black'`) so the status bar follows the page background.
4. **Test setup has a global `matchMedia` stub** in [`tests/setup.ts`](../../../tests/setup.ts), and 4 page-test files wrap renders in `<ThemeProvider>` so `useTheme()` doesn't throw.

## Pending follow-ups (non-blocking)

- **Cosmetic indentation regression** in `src/app/add-listing/AddListingClient.tsx` (lines ~209-315) and `src/app/share/page.tsx` (lines ~121-165) — wrappers were added without re-indenting children. User said "fix later". Not addressed.
- **`flagBtnHideActive` constant** in `FilterBar.tsx` — declared but possibly unused (pre-existing, flagged by reviewer).

## How to resume

1. **Open a new conversation.** Paste the resume prompt below.
2. **Decide the next batch size.** Recommended: Task 11 alone (it's the biggest, riskiest task). Then group 12+13+14 as one batch. Then Task 15+16 as the final controller-driven batch.
3. **For each task:** dispatch implementer subagent → spec reviewer subagent → code quality reviewer subagent (`superpowers:code-reviewer`).

The implementer prompts for Tasks 11-14 should follow the same pattern as Batch A and Task 10:
- Provide the canonical mapping table (copy from any of the prior task prompts).
- List the files in scope and per-file gotchas.
- Require browser verification via the preview MCP tools.
- Require lint + tests pass.
- Single commit per task with the spec's commit message.

## Resume prompt (copy this into the new conversation)

```
I'm resuming dark mode work on this repo, branch `feat/dark-mode`.
Read `docs/superpowers/plans/2026-04-25-dark-mode-RESUME.md` for the full status.
Don't re-read the plan or spec files unless you need to draft a task prompt.
Don't re-explore the codebase to recap state — the resume note is sufficient.

I want to continue with subagent-driven-development.
Next up is Task 11 (table components — the biggest task).
Wait for me to confirm before dispatching anything.
```
