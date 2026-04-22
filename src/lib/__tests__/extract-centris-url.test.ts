import { describe, it, expect } from 'vitest'
import { extractCentrisUrl } from '@/lib/extract-centris-url'

describe('extractCentrisUrl', () => {
  it('returns the url unchanged when the input is just a centris url', () => {
    const u = 'https://www.centris.ca/en/condo~for-sale/montreal/123'
    expect(extractCentrisUrl(u)).toBe(u)
  })

  it('extracts the url from the Centris Android share prefix', () => {
    const text = 'This property might interest you: https://www.centris.ca/en/condo~for-sale/montreal/123'
    expect(extractCentrisUrl(text)).toBe('https://www.centris.ca/en/condo~for-sale/montreal/123')
  })

  it('handles the French prefix too', () => {
    const text = 'Cette propriété pourrait vous intéresser : https://www.centris.ca/fr/condo~a-vendre/montreal/456'
    expect(extractCentrisUrl(text)).toBe('https://www.centris.ca/fr/condo~a-vendre/montreal/456')
  })

  it('strips trailing punctuation that is not part of the url', () => {
    const text = 'Look at this: https://www.centris.ca/en/x/1.'
    expect(extractCentrisUrl(text)).toBe('https://www.centris.ca/en/x/1')
  })

  it('accepts urls without the www subdomain', () => {
    const text = 'Check https://centris.ca/en/x/1 please'
    expect(extractCentrisUrl(text)).toBe('https://centris.ca/en/x/1')
  })

  it('returns null when no centris url is present', () => {
    expect(extractCentrisUrl('hello world')).toBeNull()
    expect(extractCentrisUrl('https://google.com')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(extractCentrisUrl('')).toBeNull()
  })

  it('returns the first centris url when multiple are present', () => {
    const text = 'See https://www.centris.ca/en/a and https://www.centris.ca/en/b'
    expect(extractCentrisUrl(text)).toBe('https://www.centris.ca/en/a')
  })
})
