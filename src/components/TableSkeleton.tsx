import { tableColumns } from '@/lib/columns'

const SKELETON_ROW_COUNT = 8

const cellWidthPercents = [70, 55, 80, 60, 65, 75, 50, 60]

export function TableSkeleton() {
  return (
    <div className="flex flex-col h-full" aria-busy="true" aria-label="Loading listings">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface gap-4">
        <div className="flex items-center gap-3">
          <div className="h-7 w-32 rounded bg-surface-muted animate-pulse" />
          <div className="h-7 w-24 rounded bg-surface-muted animate-pulse" />
          <div className="h-7 w-20 rounded bg-surface-muted animate-pulse" />
        </div>
        <div className="h-4 w-20 rounded bg-surface-muted animate-pulse" />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th
                className="sticky top-0 z-10 bg-surface-muted px-1 py-2.5 border-b border-border"
                style={{ width: '32px', minWidth: '32px' }}
              />
              {tableColumns.map(col => (
                <th
                  key={col.key}
                  className={`
                    sticky top-0 z-10 bg-surface-muted px-3 py-2.5
                    text-xs font-semibold uppercase tracking-wider text-fg-subtle
                    border-b border-border
                    ${col.align === 'right' ? 'text-right' : 'text-left'}
                  `}
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIdx) => (
              <tr key={rowIdx} className="border-b border-border">
                <td className="px-1 py-2" style={{ width: '32px', minWidth: '32px' }}>
                  <div className="h-4 w-4 mx-auto rounded bg-surface-muted animate-pulse" />
                </td>
                {tableColumns.map((col, colIdx) => {
                  const widthPct = cellWidthPercents[(rowIdx + colIdx) % cellWidthPercents.length]
                  return (
                    <td
                      key={col.key}
                      className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                      style={{ width: col.width, minWidth: col.width }}
                    >
                      <div
                        className={`h-4 rounded bg-surface-muted animate-pulse ${col.align === 'right' ? 'ml-auto' : ''}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
