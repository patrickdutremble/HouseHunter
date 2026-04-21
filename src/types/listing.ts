export interface Listing {
  id: string
  centris_link: string | null
  broker_link: string | null
  location: string | null
  full_address: string | null
  mls_number: string | null
  property_type: string | null
  price: number | null
  taxes_yearly: number | null
  common_fees_yearly: number | null
  bedrooms: string | null
  liveable_area_sqft: number | null
  price_per_sqft: number | null
  parking: string | null
  year_built: number | null
  hydro_yearly: number | null
  downpayment: number | null
  monthly_mortgage: number | null
  total_monthly_cost: number | null
  commute_school_car: string | null
  commute_pvm_transit: string | null
  notes: string | null
  personal_rating: string | null
  status: 'active' | 'unavailable'
  status_checked_at: string | null
  previous_price: number | null
  price_changed_at: string | null
  favorite: boolean
  flagged_for_deletion: boolean
  image_url: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  criteria: Record<string, boolean> | null
}
