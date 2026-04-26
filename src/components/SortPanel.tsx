'use client'

import { tableColumns } from '@/lib/columns'
import type { SortState, SortLevel } from '@/hooks/useSort'

interface SortPanelProps {
  sort: SortState
  onChange: (next: SortState) => void
}

function labelFor(key: string): string {
  return tableColumns.find(c => c.key === key)?.label ?? key
}

export function SortPanel({ sort, onChange }: SortPanelProps) {
  const flip = (idx: number) => {
    const next = [...sort]
    next[idx] = {
      ...next[idx],
      direction: next[idx].direction === 'asc' ? 'desc' : 'asc',
    }
    onChange(next)
  }

  const remove = (idx: number) => {
    onChange(sort.filter((_, i) => i !== idx))
  }

  const move = (idx: number, delta: -1 | 1) => {
    const target = idx + delta
    if (target < 0 || target >= sort.length) return
    const next = [...sort]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    onChange(next)
  }

  const add = (column: string) => {
    if (!column) return
    onChange([...sort, { column, direction: 'asc' } satisfies SortLevel])
  }

  const usedKeys = new Set(sort.map(s => s.column))
  const available = tableColumns.filter(c => !usedKeys.has(c.key) && c.sortable !== false)

  return (
    <div className="w-80 rounded-lg border border-border bg-surface p-4 shadow-lg space-y-3">
      {sort.length === 0 ? (
        <p className="text-sm text-fg-subtle">No sort applied.</p>
      ) : (
        <ul className="space-y-1.5">
          {sort.map((level, idx) => (
            <li key={level.column} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-fg-subtle tabular-nums">{idx + 1}.</span>
              <span className="flex-1 text-fg-muted">{labelFor(level.column)}</span>
              <button
                onClick={() => flip(idx)}
                aria-label={`Flip direction of ${labelFor(level.column)}`}
                className="px-1.5 py-0.5 text-xs border border-border rounded hover:bg-surface-hover"
              >
                {level.direction === 'asc' ? '\u2191' : '\u2193'}
              </button>
              <button
                onClick={() => move(idx, -1)}
                aria-label={`Move ${labelFor(level.column)} up`}
                disabled={idx === 0}
                className="px-1.5 py-0.5 text-xs text-fg-subtle hover:text-fg disabled:opacity-30"
              >
                &#x25B2;
              </button>
              <button
                onClick={() => move(idx, 1)}
                aria-label={`Move ${labelFor(level.column)} down`}
                disabled={idx === sort.length - 1}
                className="px-1.5 py-0.5 text-xs text-fg-subtle hover:text-fg disabled:opacity-30"
              >
                &#x25BC;
              </button>
              <button
                onClick={() => remove(idx)}
                aria-label={`Remove ${labelFor(level.column)}`}
                className="px-1.5 py-0.5 text-xs text-fg-subtle hover:text-red-600 dark:hover:text-red-400"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-border">
        <select
          aria-label="Add sort"
          value=""
          onChange={e => add(e.target.value)}
          className="w-full px-2 py-1.5 text-sm border border-border rounded-lg bg-surface text-fg-muted"
        >
          <option value="">+ Add sort…</option>
          {available.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>
    </div>
  )
}
