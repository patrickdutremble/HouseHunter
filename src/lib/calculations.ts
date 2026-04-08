const DOWNPAYMENT_RATE = 0.20
const ANNUAL_INTEREST_RATE = 0.0399
const MONTHLY_INTEREST_RATE = ANNUAL_INTEREST_RATE / 12
const AMORTIZATION_MONTHS = 25 * 12

export function calculateDownpayment(price: number | null): number | null {
  if (price === null) return null
  return Math.round(price * DOWNPAYMENT_RATE)
}

export function calculateMonthlyMortgage(price: number | null): number | null {
  if (price === null) return null
  const principal = price * (1 - DOWNPAYMENT_RATE)
  const r = MONTHLY_INTEREST_RATE
  const n = AMORTIZATION_MONTHS
  const payment = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return Math.round(payment)
}

export function calculateTotalMonthlyCost(
  monthlyMortgage: number | null,
  taxesYearly: number | null,
  commonFeesYearly: number | null
): number | null {
  if (monthlyMortgage === null) return null
  const monthlyTaxes = taxesYearly ? Math.round(taxesYearly / 12) : 0
  const monthlyFees = commonFeesYearly ? Math.round(commonFeesYearly / 12) : 0
  return monthlyMortgage + monthlyTaxes + monthlyFees
}

export function calculatePricePerSqft(
  price: number | null,
  area: number | null
): number | null {
  if (price === null || area === null || area === 0) return null
  return Math.round(price / area)
}

export interface RecalculateInput {
  price: number | null
  taxes_yearly: number | null
  common_fees_yearly: number | null
  liveable_area_sqft: number | null
}

export interface RecalculateOutput {
  downpayment: number | null
  monthly_mortgage: number | null
  total_monthly_cost: number | null
  price_per_sqft: number | null
}

export function recalculateListing(input: RecalculateInput): RecalculateOutput {
  const downpayment = calculateDownpayment(input.price)
  const monthly_mortgage = calculateMonthlyMortgage(input.price)
  const total_monthly_cost = calculateTotalMonthlyCost(
    monthly_mortgage,
    input.taxes_yearly,
    input.common_fees_yearly
  )
  const price_per_sqft = calculatePricePerSqft(input.price, input.liveable_area_sqft)
  return { downpayment, monthly_mortgage, total_monthly_cost, price_per_sqft }
}
