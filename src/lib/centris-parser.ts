import * as cheerio from 'cheerio'

export interface CentrisParseResult {
  location: string | null
  full_address: string | null
  property_type: string | null
  price: number | null
  taxes_yearly: number | null
  common_fees_yearly: number | null
  bedrooms: string | null
  liveable_area_sqft: number | null
  parking: string | null
  year_built: number | null
  lat: number | null
  lon: number | null
  image_url: string | null
}

export function parseCentrisHtml(html: string): CentrisParseResult {
  const $ = cheerio.load(html)

  // --- Price ---
  let price: number | null = null
  const priceEl = $('.price span.text-nowrap').first().text() || $('.price span').first().text()
  if (priceEl) {
    const digits = priceEl.replace(/[^\d]/g, '')
    if (digits) price = Number(digits)
  }

  // --- Property type (from first h1 matching "... for sale / à vendre") ---
  let property_type: string | null = null
  $('h1').each((_i, el) => {
    if (property_type) return
    const text = $(el).text().trim().replace(/\s+/g, ' ')
    const m = text.match(/^(.+?)\s+(?:for sale|à vendre|for rent|à louer)/i)
    if (m) property_type = m[1].trim()
  })

  // --- Address & location (from first h2 starting with digits + comma) ---
  let full_address: string | null = null
  let location: string | null = null
  $('h2').each((_i, el) => {
    if (full_address) return
    const text = $(el).text().trim().replace(/\s+/g, ' ')
    if (/^\d+[\s,]/.test(text) && text.includes(',')) {
      full_address = text
      const parts = text.split(',').map(p => p.trim()).filter(Boolean)
      location = parts[parts.length - 1] || null
    }
  })

  // --- Financial details helper (yearly table) ---
  function extractYearly(rx: RegExp): number | null {
    let result: number | null = null
    $('.financial-details-table-yearly').each((_i, el) => {
      if (result !== null) return
      const titleEl = $(el).find('.financial-details-table-title')
      if (!titleEl.length || !rx.test(titleEl.text().trim())) return
      const totalEl = $(el).find('.financial-details-table-total')
      if (!totalEl.length) return
      const digits = totalEl.text().replace(/[^\d]/g, '')
      if (digits) result = Number(digits)
    })
    return result
  }

  const taxes_yearly = extractYearly(/^taxes$/i)
  const common_fees_yearly = extractYearly(/^(fees|frais)$/i)

  // --- Bedrooms (from body text) ---
  let bedrooms: string | null = null
  const bodyText = $('body').text()
  const bedMatch = bodyText.match(/(\d+)\s+(?:bedroom|chambre)/i)
  if (bedMatch) bedrooms = bedMatch[1]

  // --- Carac-container helper ---
  function getCarac(rx: RegExp): string | null {
    let result: string | null = null
    $('.carac-container').each((_i, el) => {
      if (result !== null) return
      const titleEl = $(el).find('.carac-title')
      if (!titleEl.length || !rx.test(titleEl.text().trim())) return
      const valEl = $(el).find('.carac-value')
      if (valEl.length) result = valEl.text().replace(/\s+/g, ' ').trim()
    })
    return result
  }

  // --- Living area ---
  let liveable_area_sqft: number | null = null
  const areaRaw = getCarac(/^(net area|living area|superficie (nette|habitable))$/i)
  if (areaRaw) {
    const n = parseFloat(areaRaw.replace(/,/g, ''))
    if (!isNaN(n)) {
      liveable_area_sqft = /m²|m2/i.test(areaRaw) ? Math.round(n * 10.764) : Math.round(n)
    }
  }

  // --- Parking ---
  const parking = getCarac(/^(parking \(total\)|stationnement \(total\))$/i)

  // --- Year built ---
  let year_built: number | null = null
  const yearRaw = getCarac(/^(year built|année de construction)$/i)
  if (yearRaw) {
    const ym = yearRaw.match(/\d{4}/)
    if (ym) year_built = Number(ym[0])
  }

  // --- Coordinates ---
  const latEl = $('meta[itemprop="latitude"]').attr('content')
  const lonEl = $('meta[itemprop="longitude"]').attr('content')
  const lat = latEl ? Number(latEl) : null
  const lon = lonEl ? Number(lonEl) : null

  // --- Image ---
  let image_url: string | null = null
  const ogImg = $('meta[property="og:image"]').attr('content')
  if (ogImg) {
    image_url = ogImg
  } else {
    const fallback = $('.main-img img, .photo-gallery img, .primary-photo img, img[src*="mspublic.centris.ca"]').first().attr('src')
    if (fallback) image_url = fallback
  }

  return {
    location,
    full_address,
    property_type,
    price,
    taxes_yearly,
    common_fees_yearly,
    bedrooms,
    liveable_area_sqft,
    parking,
    year_built,
    lat: lat != null && Number.isFinite(lat) ? lat : null,
    lon: lon != null && Number.isFinite(lon) ? lon : null,
    image_url,
  }
}
