# Compare Button Relocation

## Problem

The Compare action is rendered as a fixed-position element at `bottom-4 left-1/2` (see [src/app/page.tsx:264-290](src/app/page.tsx:264)). It overlaps table content at narrow widths and on mobile, where there is no horizontal margin to absorb the floating cluster.

## Goal

Move the Compare action into the existing header toolbar so it never overlaps table content, while preserving today's interactions (clear selection, max-5 warning, two-listing minimum).

## Design

### Header layout

In [src/app/page.tsx](src/app/page.tsx), the header (currently lines 163–218) gains a new conditional cluster between the scrape status message and the `ViewToggle`:

```
[URL input] [Paste] [Add] [status message] [Compare cluster] [ViewToggle]
```

The **Compare cluster** renders only when `compareIds.size >= 2` (unchanged threshold) and contains:

1. **Compare button** — blue, identical styling to the current floating button, label `Compare (N)`
2. **Clear-X button** — small slate button, identical to current X

The relative wrapper around the cluster anchors the max-5 warning chip (see below).

`ViewToggle` remains anchored at the far right of the header.

The existing fixed-bottom block (page.tsx lines 264–290) is **removed entirely**. No fallback floating element.

### Responsive behavior

To keep the header on a single row down to ~360px:

- Compare button label collapses to **icon + count only** below the Tailwind `sm` breakpoint. Use `<span className="hidden sm:inline">Compare </span>(N)` so the count is always visible and the word "Compare" appears only on `sm+`.
- The scrape status message gains `truncate` and `min-w-0` so it shrinks before the Compare cluster does. The URL input already has `min-w-0 flex-1`, so it absorbs remaining space first.
- Clear-X button stays icon-only at all sizes (already the case).

No header wrapping or stacking is introduced — the toolbar remains a single row.

### Max-5 warning

The amber `Maximum 5 listings` chip is rendered as an **absolutely-positioned element anchored to the Compare cluster**, e.g. `absolute top-full right-0 mt-1`, inside a `relative` wrapper around the cluster. The existing `compareMaxWarning` state and the 2-second auto-dismiss `useEffect` (page.tsx lines 29, 62–66) are unchanged — only the rendered position moves.

The chip uses the same Tailwind classes as today: `text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg shadow-lg px-3 py-2 whitespace-nowrap`.

## Out of scope

- Any toast infrastructure. The warning stays a per-button anchored chip.
- Changes to the compare flow itself (`/compare` page, `openCompare`, `toggleCompare` logic).
- Changes to selection state, the 5-item cap, or the 2-item minimum to enable the button.
- Map view — the Compare cluster appears in the same header that sits above both table and map views, so map view automatically inherits the new placement with no extra work.

## Testing

- Existing tests in [src/components/__tests__/ListingsTable.test.tsx](src/components/__tests__/ListingsTable.test.tsx) and related files cover `onToggleCompare` wiring and shouldn't need changes.
- Manual verification (browser preview):
  - Select 0, 1, 2, then 5 listings — confirm cluster appears at 2, attempts to select a 6th show the anchored amber chip and dismiss after 2s.
  - Resize to ~360px width — header stays single-row, Compare button shows icon + count only, no horizontal overflow, no overlap with table.
  - Click Clear-X — selection clears, cluster disappears.
  - Click Compare — opens `/compare?ids=...` in a new tab as today.
