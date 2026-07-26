import type { ColumnFormat } from './columns'
import { parseDurationToMinutes } from './duration'

const EM_DASH = '—'

function formatWithCommas(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatCurrency(value: number | null): string {
  if (value === null) return EM_DASH
  return '$' + formatWithCommas(value)
}

function formatInteger(value: number | null): string {
  if (value === null) return EM_DASH
  return formatWithCommas(value)
}

function formatYear(value: number | null): string {
  if (value === null) return EM_DASH
  return String(Math.trunc(value))
}

function formatDuration(value: string | null): string {
  if (value === null || value === undefined || value === '') return EM_DASH
  const total = parseDurationToMinutes(value)
  // Preserve non-numeric text (e.g. "unknown") rather than showing an em dash.
  if (total === null) return String(value).trim()
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}

function formatDate(value: string | null): string {
  if (!value) return EM_DASH
  const d = new Date(value)
  if (isNaN(d.getTime())) return EM_DASH
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatCellValue(value: unknown, format: ColumnFormat): string {
  if (value === null || value === undefined) return EM_DASH
  switch (format) {
    case 'currency':
      return formatCurrency(value as number)
    case 'integer':
      return formatInteger(value as number)
    case 'year':
      return formatYear(value as number)
    case 'duration':
      return formatDuration(value as string)
    case 'date':
      return formatDate(value as string)
    case 'favorite':
      return value ? '\u2605' : '\u2606'
    case 'link':
    case 'link-icon':
    case 'location-link':
    case 'text':
      return String(value)
  }
}
