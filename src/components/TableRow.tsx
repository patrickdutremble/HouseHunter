import { tableColumns } from '@/lib/columns'
import { criteria, countChecked, deriveCriteria } from '@/lib/criteria'
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

const PRICE_CHANGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function formatPriceDelta(current: number, previous: number): string {
  const delta = Math.abs(current - previous)
  const rounded = Math.round(delta / 1000)
  return `$${rounded}k`
}

interface PriceChangeBadge {
  label: string
  colorClass: string
}

function computePriceChangeBadge(listing: Listing): PriceChangeBadge | null {
  if (!listing.price_changed_at || listing.previous_price == null || listing.price == null) return null
  const changedAt = new Date(listing.price_changed_at).getTime()
  if (Number.isNaN(changedAt)) return null
  if (Date.now() - changedAt > PRICE_CHANGE_WINDOW_MS) return null

  const dropped = listing.price < listing.previous_price
  const arrow = dropped ? '\u2193' : '\u2191'
  const color = dropped ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
  return {
    label: `${arrow} ${formatPriceDelta(listing.price, listing.previous_price)}`,
    colorClass: color,
  }
}

export function TableRow({ listing, isSelected, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
  const hasHighFees = (listing.common_fees_yearly ?? 0) > 6000
  const hasFlags = listing.notes && (
    listing.notes.toLowerCase().includes('foundation') ||
    listing.notes.toLowerCase().includes('water') ||
    listing.notes.toLowerCase().includes('sewer')
  )
  const isUnavailable = listing.status === 'unavailable'
  const priceBadge = computePriceChangeBadge(listing)

  return (
    <tr
      onClick={() => onSelect(listing.id)}
      className={`
        border-b border-slate-100 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-50 border-blue-200' : listing.favorite ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-slate-50'}
        ${hasFlags ? 'ring-1 ring-inset ring-amber-200' : ''}
        ${isCompared ? 'border-l-2 border-l-blue-400' : ''}
        ${isUnavailable ? 'opacity-50' : ''}
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

        if (col.key === 'criteria_count') {
          const checked = countChecked(deriveCriteria(listing))
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-slate-700 text-right"
              style={{ width: col.width, minWidth: col.width }}
            >
              {checked}/{criteria.length}
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
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <LocationCell
                    text={listing.location}
                    mapQuery={listing.full_address ?? listing.location}
                    editable={col.editable}
                    isSelected={isSelected}
                    imageUrl={listing.image_url}
                    onSave={(newValue) => onUpdate(listing.id, col.key, newValue)}
                  />
                </div>
                {isUnavailable && (
                  <span
                    className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                    data-testid="unavailable-pill"
                  >
                    Unavailable
                  </span>
                )}
              </div>
            </td>
          )
        }

        const value = listing[col.key as keyof Listing]
        const isHighFeeCell = col.key === 'common_fees_yearly' && hasHighFees
        const showPriceBadge = col.key === 'price' && priceBadge !== null

        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 text-sm ${isHighFeeCell ? 'bg-red-50 text-red-800 font-medium' : 'text-slate-700'}`}
            style={{ width: col.width, minWidth: col.width }}
          >
            <div className={showPriceBadge ? 'flex items-center justify-end gap-2' : ''}>
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
              {showPriceBadge && priceBadge && (
                <span
                  className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${priceBadge.colorClass}`}
                  data-testid="price-change-badge"
                >
                  {priceBadge.label}
                </span>
              )}
            </div>
          </td>
        )
      })}
    </tr>
  )
}
