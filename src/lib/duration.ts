/**
 * Canonical parser for commute duration strings.
 *
 * Handles every shape these values appear in:
 *   - stored auto format: "9 min", "32 min"
 *   - hours: "1 hour", "1 hour 15 mins"
 *   - display format (defensive): "0:09", "1:15"
 *   - bare integer minutes: "9"
 *
 * Returns whole minutes, or null for blank / unparseable values so callers can
 * sort them last and skip them in comparisons.
 */
export function parseDurationToMinutes(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  if (s === '') return null

  // H:MM form, e.g. "0:09", "1:15"
  const hm = s.match(/^(\d+):([0-5]?\d)$/)
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10)

  // "N hour(s)" and/or "N min(s)" form
  const hoursMatch = s.match(/(\d+)\s*(?:hours?|hrs?|h)\b/i)
  const minsMatch = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/i)
  if (hoursMatch || minsMatch) {
    const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0
    const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0
    return hours * 60 + mins
  }

  // Bare integer → minutes
  const bare = s.match(/^-?\d+$/)
  if (bare) {
    const n = parseInt(bare[0], 10)
    return Number.isFinite(n) ? n : null
  }

  return null
}
