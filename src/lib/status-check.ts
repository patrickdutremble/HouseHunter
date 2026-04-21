import * as cheerio from 'cheerio'

export type StatusCheckResult =
  | { status: 'unavailable' }
  | { status: 'active'; price: number | null }

function parsePrice(html: string): number | null {
  const $ = cheerio.load(html)
  const priceText = $('.price span.text-nowrap').first().text() || $('.price span').first().text()
  if (!priceText) return null
  const digits = priceText.replace(/[^\d]/g, '')
  return digits ? Number(digits) : null
}

export async function checkListingStatus(centrisUrl: string): Promise<StatusCheckResult> {
  const res = await fetch(centrisUrl, { redirect: 'follow' })

  if (res.url && res.url.includes('listingnotfound=')) {
    return { status: 'unavailable' }
  }

  if (res.status === 404) {
    return { status: 'unavailable' }
  }

  if (!res.ok) {
    throw new Error(`Centris returned HTTP ${res.status}`)
  }

  const html = await res.text()

  if (/no longer available/i.test(html)) {
    return { status: 'unavailable' }
  }

  return { status: 'active', price: parsePrice(html) }
}
