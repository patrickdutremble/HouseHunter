import type { Listing } from '@/types/listing'

const CSV_COLUMNS: { key: keyof Listing; label: string }[] = [
  { key: 'location', label: 'Location' },
  { key: 'full_address', label: 'Full Address' },
  { key: 'mls_number', label: 'MLS #' },
  { key: 'property_type', label: 'Type' },
  { key: 'price', label: 'Price' },
  { key: 'taxes_yearly', label: 'Taxes (yearly)' },
  { key: 'common_fees_yearly', label: 'Common Fees (yearly)' },
  { key: 'bedrooms', label: 'Bedrooms' },
  { key: 'liveable_area_sqft', label: 'Area (sqft)' },
  { key: 'price_per_sqft', label: '$/sqft' },
  { key: 'parking', label: 'Parking' },
  { key: 'storey', label: 'Storey' },
  { key: 'year_built', label: 'Year Built' },
  { key: 'downpayment', label: 'Downpayment' },
  { key: 'monthly_mortgage', label: 'Monthly Mortgage' },
  { key: 'total_monthly_cost', label: 'Total Monthly Cost' },
  { key: 'commute_school_car', label: 'Commute to School (car)' },
  { key: 'commute_pvm_transit', label: 'Commute to PVM (transit)' },
  { key: 'personal_rating', label: 'Rating' },
  { key: 'notes', label: 'Notes' },
  { key: 'centris_link', label: 'Centris Link' },
  { key: 'broker_link', label: 'Broker Link' },
  { key: 'status', label: 'Status' },
]

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function listingsToCSV(listings: Listing[]): string {
  const header = CSV_COLUMNS.map(c => c.label).join(',')
  const rows = listings.map(listing =>
    CSV_COLUMNS.map(c => escapeCSV(listing[c.key])).join(',')
  )
  return [header, ...rows].join('\n')
}
