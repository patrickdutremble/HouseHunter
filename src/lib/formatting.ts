import type { ColumnFormat } from './columns'

const EM_DASH = '—'

function formatWithCommas(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function formatCurrency(value: number | null): string {
  if (value === null) return EM_DASH
  return '$' + formatWithCommas(value)
}

export function formatInteger(value: number | null): string {
  if (value === null) return EM_DASH
  return formatWithCommas(value)
}

export function formatYear(value: number | null): string {
  if (value === null) return EM_DASH
  return String(Math.trunc(value))
}

export function formatDuration(value: string | null): string {
  if (value === null || value === undefined || value === '') return EM_DASH
  const s = String(value).trim()

  // Try to extract hours and minutes from the Google Directions text (e.g. "32 mins", "1 hour 15 mins", "2 hours").
  const hoursMatch = s.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i)
  const minsMatch = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i)

  let hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
  let mins = minsMatch ? parseInt(minsMatch[1], 10) : 0

  if (!hoursMatch && !minsMatch) {
    // Fall back to treating the whole string as a minute count.
    const pureNum = parseInt(s, 10)
    if (isNaN(pureNum)) return s
    hours = Math.floor(pureNum / 60)
    mins = pureNum % 60
  }

  return `${hours}:${mins.toString().padStart(2, '0')}`
}

export function formatDate(value: string | null): string {
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
    case 'link':
    case 'link-icon':
    case 'location-link':
    case 'text':
      return String(value)
  }
}
