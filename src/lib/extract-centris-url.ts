export function extractCentrisUrl(input: string): string | null {
  if (!input) return null
  const match = input.match(/https?:\/\/(?:www\.)?centris\.ca\/[^\s<>"']+/i)
  if (!match) return null
  return match[0].replace(/[.,;:!?)\]]+$/, '')
}
