import { describe, it, expect } from 'vitest'
import {
  recalculateListing,
} from '@/lib/calculations'

describe('recalculateListing', () => {
  it('fills all calculated fields from price, taxes, fees, area', () => {
    const result = recalculateListing({
      price: 500000,
      taxes_yearly: 4000,
      common_fees_yearly: 3600,
      hydro_yearly: null,
      liveable_area_sqft: 1200,
    })
    expect(result.downpayment).toBe(100000)
    expect(result.monthly_mortgage).toBe(2109)
    expect(result.total_monthly_cost).toBe(2742)
    expect(result.price_per_sqft).toBe(417)
  })

  it('handles missing optional fields', () => {
    const result = recalculateListing({
      price: 300000,
      taxes_yearly: null,
      common_fees_yearly: null,
      hydro_yearly: null,
      liveable_area_sqft: null,
    })
    expect(result.downpayment).toBe(60000)
    expect(result.monthly_mortgage).toBe(1265)
    expect(result.total_monthly_cost).toBe(1265)
    expect(result.price_per_sqft).toBeNull()
  })
})
