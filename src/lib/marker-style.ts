export interface PillInputs {
  favorite: boolean
  commute_school_car: string | null
}

export interface PillClasses {
  pill: string
  text: string
  showDot: boolean
}

export function isCloseToSchool(commute: string | null): boolean {
  if (!commute) return false
  const match = commute.match(/-?\d+/)
  if (!match) return false
  const minutes = parseInt(match[0], 10)
  return Number.isFinite(minutes) && minutes < 20
}

export function getPillClasses(listing: PillInputs): PillClasses {
  const close = isCloseToSchool(listing.commute_school_car)
  if (listing.favorite) {
    return {
      pill: 'bg-amber-500 border-2 border-amber-500',
      text: 'text-white',
      showDot: close,
    }
  }
  return {
    pill: 'bg-white border-2 border-slate-400',
    text: 'text-slate-900',
    showDot: close,
  }
}

export function formatPillPrice(price: number | null): string {
  if (price == null) return '$—'
  if (price < 1_000_000 && price < 999_500) {
    return `$${Math.round(price / 1000)}k`
  }
  const millions = price / 1_000_000
  return `$${millions.toFixed(1)}m`
}
