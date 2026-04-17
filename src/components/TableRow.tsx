import { tableColumns } from '@/lib/columns'
import { EditableCell } from './EditableCell'
import { LocationCell } from './LocationCell'
import { FavoriteButton } from './FavoriteButton'
import type { Listing } from '@/types/listing'

interface TableRowProps {
  listing: Listing
  isSelected: boolean
  onSelect: (id: string) => void
  onUpdate: (id: string, field: string, value: string | number | boolean | null | Record<string, boolean>) => void
  isCompared: boolean
  onToggleCompare: (id: string) => void
}

export function TableRow({ listing, isSelected, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
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
        ${isSelected ? 'bg-blue-50 border-blue-200' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
        ${hasFlags ? 'ring-1 ring-inset ring-amber-200' : ''}
        ${isCompared ? 'border-l-2 border-l-blue-400' : ''}
      `}
    >
      <td
        className="px-1 py-2.5 text-center"
        style={{ width: '32px', minWidth: '32px' }}
        onClick={e => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isCompared}
          onChange={() => onToggleCompare(listing.id)}
          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      </td>
      {tableColumns.map(col => {
        if (col.key === 'favorite') {
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-center"
              style={{ width: col.width, minWidth: col.width }}
              onClick={e => e.stopPropagation()}
            >
              <FavoriteButton
                value={listing.favorite}
                onToggle={() => onUpdate(listing.id, 'favorite', !listing.favorite)}
              />
            </td>
          )
        }

        if (col.key === 'location') {
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-slate-700"
              style={{ width: col.width, minWidth: col.width }}
            >
              <LocationCell
                text={listing.location}
                mapQuery={listing.full_address ?? listing.location}
                editable={col.editable}
                isSelected={isSelected}
                onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
              />
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
              isSelected={isSelected}
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
