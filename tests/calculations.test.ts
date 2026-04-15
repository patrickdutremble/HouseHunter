import { describe, it, expect } from 'vitest'
import {
  calculateDownpayment,
  calculateMonthlyMortgage,
  calculateTotalMonthlyCost,
  calculatePricePerSqft,
  recalculateListing,
} from '@/lib/calculations'

describe('calculateDownpayment', () => {
  it('returns 20% of price, rounded', () => {
    expect(calculateDownpayment(500000)).toBe(100000)
  })

  it('rounds to nearest dollar', () => {
    expect(calculateDownpayment(333333)).toBe(66667)
  })

  it('returns null if price is null', () => {
    expect(calculateDownpayment(null)).toBeNull()
  })
})

describe('calculateMonthlyMortgage', () => {
  it('calculates standard amortization at 3.99% over 25 years', () => {
    const result = calculateMonthlyMortgage(500000)
    expect(result).toBe(2109)
  })

  it('returns null if price is null', () => {
    expect(calculateMonthlyMortgage(null)).toBeNull()
  })

  it('handles small prices', () => {
    const result = calculateMonthlyMortgage(100000)
    expect(result).toBe(422)
  })
})

describe('calculateTotalMonthlyCost', () => {
  it('sums mortgage + monthly taxes + monthly fees', () => {
    const result = calculateTotalMonthlyCost(2106, 4000, 3600)
    expect(result).toBe(2739)
  })

  it('includes hydro when provided', () => {
    const result = calculateTotalMonthlyCost(2106, 4000, 3600, 1200)
    expect(result).toBe(2839)
  })

  it('handles null taxes and fees', () => {
    const result = calculateTotalMonthlyCost(2106, null, null)
    expect(result).toBe(2106)
  })

  it('returns null if mortgage is null', () => {
    expect(calculateTotalMonthlyCost(null, 4000, 3600)).toBeNull()
  })
})

describe('calculatePricePerSqft', () => {
  it('divides price by area, rounded', () => {
    expect(calculatePricePerSqft(500000, 1200)).toBe(417)
  })

  it('returns null if area is null', () => {
    expect(calculatePricePerSqft(500000, null)).toBeNull()
  })

  it('returns null if area is 0', () => {
    expect(calculatePricePerSqft(500000, 0)).toBeNull()
  })

  it('returns null if price is null', () => {
    expect(calculatePricePerSqft(null, 1200)).toBeNull()
  })
})

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
