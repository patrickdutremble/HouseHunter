# Dark mode — design

**Date:** 2026-04-25
**Status:** Approved (pending plan)

## Goal

Add full dark mode support to HouseHunter with a three-state user toggle (Light / Dark / System) accessible from every route, no flash on load, and consistent visual treatment across every component, page, and the map.

## Non-goals

- Cross-device sync (no auth in the app).
- Per-route theme overrides.
- High-contrast / accessibility-extreme palettes beyond what the chosen tokens provide.
- Print stylesheet (none exists).

## Decisions

| # | Decision | Choice | Notes |
|---|---|---|---|
| 1 | Mode set | Light + Dark + System | Defaults to System on first visit. |
| 2 | Toggle placement | Fixed `top-4 right-4 z-50`, mounted in `layout.tsx` | Visible on every route. |
| 3 | Map tiles | CARTO `light_all` and `dark_all` (free, attribution-only) | Replaces current OSM tiles in both modes for consistency. |
| 4 | Color strategy | Hybrid — semantic CSS variable tokens for surfaces/text/borders/accent, plus per-class `dark:` variants for one-off accents (favorite amber, flag red, status pills, commute zones). | Avoids both repetition and over-collapse. |
| 5 | Persistence | `localStorage` + blocking inline `<head>` script | No flash. Per-device. |

## Architecture

Three coordinated pieces:

1. **Inline blocking script in `<head>`** (in `src/app/layout.tsx`, via `dangerouslySetInnerHTML`). Runs before React hydrates. Reads `localStorage.theme` (`"light" | "dark"`; absence means `"system"`), resolves system via `matchMedia('(prefers-color-scheme: dark)')`, sets `class="dark"` on `<html>` if dark.
2. **`ThemeProvider`** (`src/components/ThemeProvider.tsx`, `"use client"`). Wraps `{children}`. Holds `theme` state. Exposes `useTheme()` returning `{ theme, setTheme, resolvedTheme }`. Subscribes to `matchMedia` change events when in `"system"` mode. Mirrors writes to `localStorage` and toggles the `dark` class on `documentElement`.
3. **`ThemeToggle`** (`src/components/ThemeToggle.tsx`, `"use client"`). Three-button segmented pill at `top-4 right-4 z-50`. Sun / Moon / Monitor icons. `aria-pressed` reflects current theme. Returns `null` until mounted (avoids hydration mismatch).

Tailwind v4 dark variant is configured via `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css`, keying off the `.dark` class.

## Color tokens

Defined in `globals.css`. Light values in `:root` via `@theme`; dark values in `.dark { ... }`.

| Token | Purpose | Light | Dark |
|---|---|---|---|
| `--color-bg` | Page background | `#f8fafc` | `#020617` |
| `--color-surface` | Card / panel / popover | `#ffffff` | `#0f172a` |
| `--color-surface-muted` | Table headers, sidebar, hover | `#f1f5f9` | `#1e293b` |
| `--color-surface-hover` | Interactive hover on surface | `#f8fafc` | `#1e293b` |
| `--color-border` | Default borders, dividers | `#e2e8f0` | `#334155` |
| `--color-border-strong` | Emphasized borders | `#cbd5e1` | `#475569` |
| `--color-fg` | Primary text | `#0f172a` | `#f1f5f9` |
| `--color-fg-muted` | Secondary text | `#475569` | `#94a3b8` |
| `--color-fg-subtle` | Tertiary text / placeholders | `#94a3b8` | `#64748b` |
| `--color-accent` | Primary action / link / focus ring | `#0ea5e9` | `#38bdf8` |
| `--color-accent-fg` | Text on accent background | `#ffffff` | `#0f172a` |

**Accents kept literal in both modes** (semantic colors that read on either background): favorite amber `#f59e0b`, flag red `#ef4444`, commute teal `#14b8a6`, commute yellow `#eab308`. Their *containers* use tokens; only their hover states or muted backgrounds get explicit `dark:` overrides where needed.

## File-by-file change inventory

### A. Foundation — 4 files (2 modified, 2 new)

- `src/app/globals.css` — replace `:root` with `@theme` block, add `.dark` override, add `@custom-variant dark`, rewrite scrollbar to use tokens, add leaflet dark-mode overrides.
- `src/app/layout.tsx` — inline `<head>` script; mount `<ThemeProvider>` and `<ThemeToggle>`; add per-scheme `<meta name="theme-color">` for iOS PWA status bar (light: `#f8fafc`, dark: `#020617`) using `media="(prefers-color-scheme: ...)"` attributes.
- `src/components/ThemeProvider.tsx` — **new**, ~40 lines.
- `src/components/ThemeToggle.tsx` — **new**, ~50 lines.

### B. Layout shells / page chrome — 8 files

`src/app/page.tsx`, `src/app/add-listing/page.tsx`, `src/app/add-listing/AddListingClient.tsx`, `src/app/compare/page.tsx`, `src/app/recent/page.tsx`, `src/app/recent/[id]/page.tsx`, `src/app/share/page.tsx`, `src/app/trash/page.tsx`. Convert hardcoded `bg-white`, `bg-slate-*`, `text-slate-*`, `border-slate-*` to semantic token classes. `compare/page.tsx` also has inline `style={{ }}` colors — convert to tokens.

### C. Toolbar / chrome — 5 files

`FilterBar.tsx`, `FilterPanel.tsx`, `SortPanel.tsx`, `ViewToggle.tsx`, `RefreshStatusesButton.tsx`. Same conversion. Active-state pills use `bg-accent text-accent-fg`.

### D. Table & cells — 5 files

- `ListingsTable.tsx` — sticky header inline `style` → token.
- `TableHeader.tsx` — header bg, sort indicators, inline styles → tokens.
- `TableRow.tsx` — row bg, hover, selected (selected row bg gets explicit `dark:bg-sky-900` override since the light `bg-sky-50` doesn't have a token).
- `EditableCell.tsx` — input bg, focus ring, error border.
- `LocationCell.tsx`, `LocationField.tsx` — pill backgrounds.

### E. Card / detail / popup — 4 files

- `ListingCard.tsx` — bg, border, status pills.
- `DetailPanel.tsx` — panel bg, field labels (use `text-fg-muted`), link colors (use `text-accent`).
- `ListingPopup.tsx` — popup body classes; container styled by leaflet override in globals.css.
- `SharePreviewCard.tsx` — read-only share card. **Locked to light mode** regardless of viewer's theme so shared snapshots render consistently for recipients. Implemented by wrapping the card root in a `<div class="hh-force-light">` and adding a `globals.css` rule that resets the tokens inside it back to the light values, so descendant classes resolve to light colors even under `.dark`.

### F. Action buttons — 2 files

- `FavoriteButton.tsx` — amber star stays; only inactive/hover states get `dark:` overrides.
- `FlagButton.tsx` — red flag stays; same treatment.

### G. Map — 3 files

- `MapView.tsx` — read `useTheme()`; swap `<TileLayer>` `url` based on `resolvedTheme` (CARTO light_all / dark_all); add `key={resolvedTheme}` so leaflet remounts the layer; updated attribution string includes CARTO. Commute circle colors unchanged.
- `ListingMarker.tsx` — pill consumes new class strings from `marker-style.ts`; no other change.
- `src/lib/marker-style.ts` — `getPillClasses` returns token-based class strings (`bg-surface border-border-strong text-fg`). Favorite pill keeps `bg-amber-500 text-white` (semantic).

### H. Tests touched — 2 files

- `src/components/__tests__/TableRow.test.tsx` — update class-string assertions.
- `src/lib/__tests__/marker-style.test.ts` — update class-string assertions.

### Totals

33 files: 2 new + 29 modified source + 2 modified tests. ~303 color-class occurrences edited.

## Map tile swap (detail)

URLs:
- Light: `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
- Dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- Attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>`

Leaflet's own popup and zoom-control CSS overridden in `globals.css`:

```css
.dark .leaflet-popup-content-wrapper,
.dark .leaflet-popup-tip { background: var(--color-surface); color: var(--color-fg); }
.dark .leaflet-control-zoom a { background: var(--color-surface); color: var(--color-fg); border-color: var(--color-border); }
.dark .leaflet-bar { border-color: var(--color-border); }
```

## Toggle component (detail)

- Three-button segmented control, fixed `top-4 right-4 z-50`.
- Sun / Moon / Monitor icons (`lucide-react` if available; else inline SVG).
- Active button: `bg-accent text-accent-fg`. Inactive: `text-fg-muted hover:text-fg`.
- `role="group" aria-label="Theme"`, each button has `aria-label` ("Light theme" / "Dark theme" / "System theme") and `aria-pressed`.
- `focus-visible:ring-2 focus-visible:ring-accent`.
- Returns `null` until `mounted` (set in `useEffect`) to avoid hydration mismatch.

## Persistence & flash prevention

Inline script in `<head>`:

```html
<script>(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();</script>
```

Provider:
- `setTheme("light"|"dark")` writes `localStorage.theme`, sets/removes `.dark`.
- `setTheme("system")` deletes `localStorage.theme`, recomputes from `matchMedia`.
- In `"system"` mode, a `matchMedia` `change` listener updates the class.

## Testing

**Updated tests:**
- `src/lib/__tests__/marker-style.test.ts` — new asserted strings.
- `src/components/__tests__/TableRow.test.tsx` — new asserted strings.

**New tests:**
- `src/components/__tests__/ThemeProvider.test.tsx` — defaults to system; reads stored value; `setTheme` mutates documentElement and localStorage; `matchMedia` change in system mode toggles class.
- `src/components/__tests__/ThemeToggle.test.tsx` — renders three buttons with correct `aria-pressed`; clicks call `setTheme`; renders nothing before mount.

**Manual verification (preview tools):**
- `preview_screenshot` every route in both modes: `/`, `/add-listing`, `/compare`, `/recent`, `/recent/<id>`, `/share`, `/trash`.
- `preview_resize colorScheme: dark` to confirm system mode picks up OS theme.
- `preview_console_logs` for hydration warnings; `preview_network` for CARTO tile 404s.
- Hard reload in dark mode → confirm zero flash.

**Build:**
- `npm run lint` clean.
- `npm run build` succeeds.
- `npm test` green.

## Out of scope

- Cross-browser color verification beyond Chromium (preview tool).
- Print stylesheet.
- Theming other than light/dark (no high-contrast variant).
- Cross-device sync.
