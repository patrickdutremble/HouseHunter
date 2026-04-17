# Two-Click Edit Behaviour

**Date:** 2026-04-16

## Summary

Editable table cells currently enter edit mode on a single click. This design changes them to require two clicks: the first click selects the row (opening the detail panel), and the second click activates edit mode on the cell. The detail panel fields are unchanged — they remain single-click to edit.

## Scope

- **In scope:** All editable cells in the listing table (`EditableCell`, `LocationCell`)
- **Out of scope:** Detail panel fields — these keep single-click editing

## Interaction Model

| Row state | Click on editable cell | Result |
|-----------|----------------------|--------|
| Unselected | First click | Row is selected (detail panel opens). Cell does NOT enter edit mode. |
| Selected | Click on editable cell | Cell enters edit mode. |
| Selected | Click on non-editable cell | Nothing (row stays selected). |

The row's existing `onClick` handler continues to fire on all clicks, so the first click always selects/re-selects the row regardless of where on the row the user clicks.

## Visual Feedback

When a row is selected, hovering over an editable cell shows a dashed blue border (`hover:border hover:border-dashed hover:border-blue-300 hover:rounded`) to signal it is clickable to edit. Unselected rows show no hover effect on cells — they appear read-only.

## Component Changes

### `EditableCell` (`src/components/EditableCell.tsx`)

- Add `isSelected?: boolean` prop (default: `false`)
- `handleClick`: add early return `if (!isSelected) return` before `setEditing(true)`
- `link-icon` edit button `onClick` (`handleEditClick`): add same `isSelected` guard
- Display span `cursorClass`: change from always-on `cursor-pointer hover:bg-blue-50` to conditional:
  - When `isSelected && editable`: `cursor-pointer hover:border hover:border-dashed hover:border-blue-300 hover:rounded`
  - Otherwise: no hover styles, no pointer cursor (the row's own `cursor-pointer` still applies at the `<tr>` level)
- `title` attribute on span: show `'Click to edit'` only when `isSelected && editable`; no title otherwise

### `TableRow` (`src/components/TableRow.tsx`)

- Pass `isSelected={isSelected}` to every `EditableCell` (already has `isSelected` prop)
- Pass `isSelected={isSelected}` to `LocationCell`

### `LocationCell` (`src/components/LocationCell.tsx`)

- Add `isSelected?: boolean` prop (default: `false`)
- `startEdit`: add early return `if (!isSelected) return`
- Apply same dashed-border hover style when `isSelected && editable`; no hover style otherwise

### `DetailPanel` (`src/components/DetailPanel.tsx`)

- Pass `isSelected={true}` to every `EditableCell` to preserve existing single-click edit behaviour

## Data Flow

No data model changes. Selection state (`isSelected`) already flows from `page.tsx` → `ListingsTable` → `TableRow`. This design extends that prop one level further into `EditableCell` and `LocationCell`.

## Error Handling

No new error states. The guard in `handleClick` is a no-op (early return) — no side effects on unselected clicks.

## Testing

- Click an unselected row cell: row selects, cell does not enter edit mode
- Click an editable cell on the selected row: cell enters edit mode
- Click a non-editable cell on the selected row: nothing (row stays selected)
- Hover an editable cell on a selected row: dashed blue border appears
- Hover an editable cell on an unselected row: no hover effect
- Detail panel: single click still enters edit mode (isSelected=true always)
- Link-icon edit button: only clickable when row is selected
