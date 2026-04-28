import { useEffect, useRef } from 'react'
import { tableColumns } from '@/lib/columns'
import { criteria, countChecked, deriveCriteria } from '@/lib/criteria'
import { EditableCell } from './EditableCell'
import { LocationCell } from './LocationCell'
import { FavoriteButton } from './FavoriteButton'
import { FlagButton } from './FlagButton'
import type { Listing } from '@/types/listing'

interface TableRowProps {
  listing: Listing
  isSelected: boolean
  isFocused?: boolean
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
  const color = dropped ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
  return {
    label: `${arrow} ${formatPriceDelta(listing.price, listing.previous_price)}`,
    colorClass: color,
  }
}

function getRowStateClass(
  isSelected: boolean,
  flagged: boolean,
  favorite: boolean,
): string {
  if (isSelected) return 'bg-blue-50 dark:bg-sky-900/40 border-blue-200 dark:border-sky-700'
  if (flagged) return 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/40'
  if (favorite) return 'bg-amber-50 dark:bg-amber-400/15 hover:bg-amber-100 dark:hover:bg-amber-400/25'
  return 'hover:bg-surface-hover'
}

export function TableRow({ listing, isSelected, isFocused = false, onSelect, onUpdate, isCompared, onToggleCompare }: TableRowProps) {
  const rowRef = useRef<HTMLTableRowElement>(null)
  const hasHighFees = (listing.common_fees_yearly ?? 0) > 6000
  const hasFlags = listing.notes && (
    listing.notes.toLowerCase().includes('foundation') ||
    listing.notes.toLowerCase().includes('water') ||
    listing.notes.toLowerCase().includes('sewer')
  )
  const isUnavailable = listing.status === 'unavailable'
  const priceBadge = computePriceChangeBadge(listing)

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [isFocused])

  return (
    <tr
      ref={rowRef}
      onClick={() => onSelect(listing.id)}
      className={`
        border-b border-border cursor-pointer transition-colors
        ${getRowStateClass(isSelected, listing.flagged_for_deletion, listing.favorite)}
        ${hasFlags ? 'ring-1 ring-inset ring-amber-200 dark:ring-amber-800' : ''}
        ${isFocused ? 'ring-2 ring-inset ring-blue-400 dark:ring-sky-500' : ''}
        ${isCompared ? 'border-l-2 border-l-blue-400 dark:border-l-sky-500' : ''}
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
          className="w-3.5 h-3.5 rounded border-border-strong text-accent focus:ring-accent cursor-pointer"
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
              <div className="inline-flex items-center gap-1">
                <FavoriteButton
                  value={listing.favorite}
                  onToggle={() => onUpdate(listing.id, 'favorite', !listing.favorite)}
                />
                <FlagButton
                  value={listing.flagged_for_deletion}
                  onToggle={() => onUpdate(listing.id, 'flagged_for_deletion', !listing.flagged_for_deletion)}
                />
              </div>
            </td>
          )
        }

        if (col.key === 'criteria_count') {
          const checked = countChecked(deriveCriteria(listing))
          return (
            <td
              key={col.key}
              className="px-3 py-2.5 text-sm text-fg-muted text-right"
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
              className="px-3 py-2.5 text-sm text-fg-muted"
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
                    className="inline-flex items-center rounded-full border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-fg-muted"
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
        const showTollBadge =
          col.key === 'commute_school_car' && listing.commute_school_has_toll === true

        return (
          <td
            key={col.key}
            className={`px-3 py-2.5 text-sm ${
              isHighFeeCell ? 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 font-medium' : 'text-fg-muted'
            }`}
            style={{ width: col.width, minWidth: col.width }}
          >
            <div className={showPriceBadge || showTollBadge ? 'flex items-center justify-end gap-1' : ''}>
              {showTollBadge && (
                <span
                  className="shrink-0 text-[9px] font-semibold text-accent pointer-events-none select-none"
                  title="Route includes toll road A-25"
                  data-testid="toll-badge"
                >
                  A25
                </span>
              )}
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
