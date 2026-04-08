const HIGH_FEE_YEARLY_THRESHOLD = 6000 // $500/month × 12

const NON_STANDARD_FOUNDATION_KEYWORDS = [
  'stone', 'block', 'brick', 'wood', 'pile', 'pier',
]

const NON_STANDARD_WATER_KEYWORDS = [
  'well', 'septic', 'cistern', 'holding tank', 'private',
]

export function hasHighFees(commonFeesYearly: number | null): boolean {
  if (commonFeesYearly === null) return false
  return commonFeesYearly > HIGH_FEE_YEARLY_THRESHOLD
}

export function hasNonStandardFoundation(foundationText: string | null): boolean {
  if (!foundationText) return false
  const lower = foundationText.toLowerCase()
  if (lower.includes('block')) return true
  if (lower.includes('concrete') && !lower.includes('block')) return false
  return NON_STANDARD_FOUNDATION_KEYWORDS.some(kw => lower.includes(kw))
}

export function hasNonStandardWater(waterSewerText: string | null): boolean {
  if (!waterSewerText) return false
  const lower = waterSewerText.toLowerCase()
  if (lower.includes('municipal')) return false
  return NON_STANDARD_WATER_KEYWORDS.some(kw => lower.includes(kw))
}

export interface FlagInput {
  common_fees_yearly: number | null
  foundation: string | null
  water_sewer: string | null
}

export function generateFlags(input: FlagInput): string {
  const flags: string[] = []

  if (hasHighFees(input.common_fees_yearly)) {
    const monthly = Math.round((input.common_fees_yearly ?? 0) / 12)
    flags.push(`High condo fees ($${monthly}/mo)`)
  }

  if (hasNonStandardFoundation(input.foundation)) {
    flags.push(`Non-standard foundation: ${input.foundation}`)
  }

  if (hasNonStandardWater(input.water_sewer)) {
    flags.push(`Non-standard water/sewer: ${input.water_sewer}`)
  }

  return flags.join(' | ')
}
