import { tableColumns } from '@/lib/columns'
import type { SortState } from '@/hooks/useSort'

interface TableHeaderProps {
  sort: SortState
  onSort: (column: string, shift: boolean) => void
  hasCompare?: boolean
}

export function TableHeader({ sort, onSort, hasCompare }: TableHeaderProps) {
  return (
    <thead>
      <tr className="border-b border-border">
        {hasCompare && (
          <th
            className="sticky top-0 z-10 bg-surface-muted px-1 py-2.5 border-b border-border"
            style={{ width: '32px', minWidth: '32px' }}
          />
        )}
        {tableColumns.map(col => {
          const level = sort.find(s => s.column === col.key)
          const rank = level ? sort.findIndex(s => s.column === col.key) + 1 : 0
          const arrow = level ? (level.direction === 'asc' ? ' \u2191' : ' \u2193') : ''

          return (
            <th
              key={col.key}
              onClick={(e) => onSort(col.key, e.shiftKey)}
              className={`
                sticky top-0 z-10 bg-surface-muted px-3 py-2.5
                text-xs font-semibold uppercase tracking-wider text-fg-subtle
                cursor-pointer select-none hover:text-fg hover:bg-surface-hover
                transition-colors border-b border-border
                ${col.align === 'right' ? 'text-right' : 'text-left'}
              `}
              style={{ width: col.width, minWidth: col.width }}
            >
              {col.label}{rank > 0 ? ` ${rank}` : ''}{arrow}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
