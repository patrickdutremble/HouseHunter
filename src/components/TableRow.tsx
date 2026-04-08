import { tableColumns } from '@/lib/columns'
import { EditableCell } from './EditableCell'
import { StatusBadge } from './StatusBadge'
import type { Listing } from '@/types/listing'

interface TableRowProps {
  listing: Listing
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | null) => void
}

export function TableRow({ listing, isSelected, onSelect, onUpdate }: TableRowProps) {
  const hasHighFees = (listing.common_fees_yearly ?? 0) > 6000
  const hasFlags = listing.notes && (
    listing.notes.toLowerCase().includes('foundation') ||
    listing.notes.toLowerCase().includes('water') ||
    listing.notes.toLowerCase().includes('sewer')
  )

  return (
    <tr
      onClick={() => onSelect(listing.id)}
      className={`
        border-b border-slate-100 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'}
        ${hasFlags ? 'ring-1 ring-inset ring-amber-200' : ''}
      `}
    >
      {tableColumns.map(col => {
        if (col.key === 'status') {
          return (
            <td key={col.key} className="px-3 py-2.5" style={{ width: col.width }}>
              <StatusBadge status={listing.status} />
            </td>
          )
        }

        const value = listing[col.key as keyof Listing]
        const isHighFeeCell = col.key === 'common_fees_yearly' && hasHighFees

        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 text-sm ${isHighFeeCell ? 'bg-red-50 text-red-800 font-medium' : 'text-slate-700'}`}
            style={{ width: col.width, minWidth: col.width }}
          >
            <EditableCell
              value={value}
              format={col.format}
              editable={col.editable}
              align={col.align}
              onSave={(newValue) => {
                onUpdate(listing.id, col.key, newValue)
              }}
            />
          </td>
        )
      })}
    </tr>
  )
}
