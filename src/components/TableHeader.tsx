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
      <tr className="border-b border-slate-200">
        {hasCompare && (
          <th
            className="sticky top-0 z-10 bg-slate-50 px-1 py-2.5 border-b border-slate-200"
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
                sticky top-0 z-10 bg-slate-50 px-3 py-2.5
                text-xs font-semibold uppercase tracking-wider text-slate-500
                cursor-pointer select-none hover:text-slate-800 hover:bg-slate-100
                transition-colors border-b border-slate-200
                ${col.align === 'right' ? 'text-right' : 'text-left'}
              `}
              style={{ width: col.width, minWidth: col.width }}
            >
              {col.label}{rank > 0 && sort.length > 1 ? ` ${rank}` : ''}{arrow}
            </th>
          )
        })}
      </tr>
    </thead>
  )
}
