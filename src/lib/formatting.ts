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

export function formatCellValue(value: unknown, format: ColumnFormat): string {
  if (value === null || value === undefined) return EM_DASH
  switch (format) {
    case 'currency':
      return formatCurrency(value as number)
    case 'integer':
      return formatInteger(value as number)
    case 'link':
    case 'text':
      return String(value)
  }
}
