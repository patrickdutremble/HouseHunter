export type ColumnAlign = 'left' | 'right'
export type ColumnFormat = 'text' | 'currency' | 'integer' | 'link'

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
  { key: 'location', label: 'Location', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '140px' },
  { key: 'property_type', label: 'Type', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '90px' },
  { key: 'price', label: 'Price', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '120px' },
  { key: 'taxes_yearly', label: 'Taxes/yr', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'common_fees_yearly', label: 'Fees/yr', align: 'right', format: 'currency', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'bedrooms', label: 'Beds', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '60px' },
  { key: 'liveable_area_sqft', label: 'Area (sqft)', align: 'right', format: 'integer', editable: true, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'price_per_sqft', label: '$/sqft', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'parking', label: 'Parking', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'storey', label: 'Storey', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'year_built', label: 'Year Built', align: 'right', format: 'integer', editable: true, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'downpayment', label: 'Down', align: 'right', format: 'currency', editable: false, showInTable: false, showInDetail: true },
  { key: 'monthly_mortgage', label: 'Mortgage/mo', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '110px' },
  { key: 'total_monthly_cost', label: 'Total/mo', align: 'right', format: 'currency', editable: false, showInTable: true, showInDetail: true, width: '100px' },
  { key: 'commute_school_car', label: 'School', align: 'right', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '70px' },
  { key: 'commute_pvm_transit', label: 'PVM', align: 'right', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '70px' },
  { key: 'personal_rating', label: 'Rating', align: 'left', format: 'text', editable: true, showInTable: true, showInDetail: true, width: '80px' },
  { key: 'notes', label: 'Notes', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'link', label: 'Link', align: 'left', format: 'link', editable: false, showInTable: false, showInDetail: true },
  { key: 'full_address', label: 'Full Address', align: 'left', format: 'text', editable: true, showInTable: false, showInDetail: true },
  { key: 'mls_number', label: 'MLS #', align: 'left', format: 'text', editable: false, showInTable: false, showInDetail: true },
  { key: 'status', label: 'Status', align: 'left', format: 'text', editable: false, showInTable: true, showInDetail: true, width: '80px' },
]

export const tableColumns = columns.filter(c => c.showInTable)
export const detailColumns = columns.filter(c => c.showInDetail)
