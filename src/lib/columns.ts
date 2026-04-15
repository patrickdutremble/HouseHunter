export type ColumnAlign = 'left' | 'right'
export type ColumnFormat =
  | 'text'
  | 'currency'
  | 'integer'
  | 'year'
  | 'duration'
  | 'date'
  | 'link'
  | 'link-icon'
  | 'location-link'
  | 'favorite'

export interface ColumnDef {
  key: string
  label: string
  align: ColumnAlign
  format: ColumnFormat
  editable: boolean
  showInTable: boolean
  showInDetail: boolean
  width?: string
}

export const columns: ColumnDef[] = [
  { key: 'favorite', label: '\u2605', align: 'left', format: 'favorite', editable: true, showInTable: true, showInDetail: false, width: '36px' },
  { key: 'centris_link', label: 'Centris', align: 'left', format: 'link-icon', editable: true, showInTable: true, showInDetail: true, width: '60px' },
  { key: 'broker_link', label: 'Broker', align: 'left', format: 'link-icon', editable: true, showInTable: false, showInDetail: true, width: '60px' },
  { key: 'location', label: 'Location', align: 'left', format: 'location-link', editable: true, showInTable: true, showInDetail: true, width: '160px' },
  { key: 'property_type', label: 'Type', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '90px' },
  { key: 'price', label: 'Price', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '120px' },
  { key: 'taxes_yearly', label: 'Taxes/yr', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'common_fees_yearly', label: 'Fees/yr', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'bedrooms', label: 'Beds', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '60px' },
  { key: 'liveable_area_sqft', label: 'Area (sqft)', align: 'right', format: 'integer', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'price_per_sqft', label: '$/sqft', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'parking', label: 'Parking', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'year_built', label: 'Year Built', align: 'right', format: 'year', editable: true, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'downpayment', label: 'Down', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'monthly_mortgage', label: 'Mortgage/mo', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '110px' },
  { key: 'hydro_yearly', label: 'Hydro/yr', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '90px' },
  { key: 'total_monthly_cost', label: 'Total/mo', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'commute_school_car', label: 'School', align: 'right', format: 'duration', editable: true, showInTable: true, showInDetail: true, width: '70px' },
  { key: 'commute_pvm_transit', label: 'PVM', align: 'right', format: 'duration', editable: true, showInTable: true, showInDetail: true, width: '70px' },
  { key: 'created_at', label: 'Added', align: 'left', format: 'date', editable: false, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'personal_rating', label: 'Rating', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: false, width: '80px' },
  { key: 'notes', label: 'Notes', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'full_address', label: 'Full Address', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: false },
  { key: 'mls_number', label: 'MLS #', align: 'left', format: 'text', editable: false, showInTable: false, showInDetail: false },
  { key: 'status', label: 'Status', align: 'left', format: 'text', editable: false, showInTable: false, showInDetail: false, width: '80px' },
]

export const tableColumns = columns.filter(c => c.showInTable)
export const detailColumns = columns.filter(c => c.showInDetail)
