import { describe, it, expect } from 'vitest'
import { parseCentrisHtml } from '../centris-parser'

function htmlWithType(typeLabel: string, suffix: string): string {
  return `<html><body><h1>${typeLabel} ${suffix}</h1></body></html>`
}

describe('parseCentrisHtml — property_type normalization', () => {
  it('maps "Maison" to "House"', () => {
    expect(parseCentrisHtml(htmlWithType('Maison', 'à vendre')).property_type).toBe('House')
  })

  it('maps "Maison de ville" to "Townhouse"', () => {
    expect(parseCentrisHtml(htmlWithType('Maison de ville', 'à vendre')).property_type).toBe('Townhouse')
  })

  it('maps "Maison en copropriété" to "Condominium house"', () => {
    expect(parseCentrisHtml(htmlWithType('Maison en copropriété', 'à vendre')).property_type).toBe('Condominium house')
  })

  it('maps "Appartement" to "Condo"', () => {
    expect(parseCentrisHtml(htmlWithType('Appartement', 'à vendre')).property_type).toBe('Condo')
  })

  it('leaves English labels unchanged', () => {
    expect(parseCentrisHtml(htmlWithType('House', 'for sale')).property_type).toBe('House')
    expect(parseCentrisHtml(htmlWithType('Condo', 'for sale')).property_type).toBe('Condo')
  })

  it('leaves Plex variants unchanged', () => {
    expect(parseCentrisHtml(htmlWithType('Duplex', 'à vendre')).property_type).toBe('Duplex')
    expect(parseCentrisHtml(htmlWithType('Triplex', 'à vendre')).property_type).toBe('Triplex')
  })
})

// New Centris BEM markup (rolled out ~July 2026). The server-side parser must
// read these the same way the bookmarklet does, while still falling back to the
// old markup for any pages still served the legacy way.
const newLayoutFinancials = `
  <div class="financial-details-table-container">
    <div class="financial-details-table-section-title">Taxes</div>
    <table class="financial-details-table financial-details-table--yearly">
      <tr class="financial-details-table__row financial-details-table__row--total">
        <td class="financial-details-table__value">$4,250</td>
      </tr>
    </table>
  </div>
  <div class="financial-details-table-container">
    <div class="financial-details-table-section-title">Fees</div>
    <table class="financial-details-table financial-details-table--yearly">
      <tr class="financial-details-table__row financial-details-table__row--total">
        <td class="financial-details-table__value">$3,600</td>
      </tr>
    </table>
  </div>`

const oldLayoutFinancials = `
  <div class="financial-details-table-yearly">
    <div class="financial-details-table-title">Taxes</div>
    <div class="financial-details-table-total">$4,250</div>
  </div>
  <div class="financial-details-table-yearly">
    <div class="financial-details-table-title">Fees</div>
    <div class="financial-details-table-total">$3,600</div>
  </div>`

describe('parseCentrisHtml — price', () => {
  it('reads price from meta[itemprop=price] (new layout)', () => {
    const html = `<html><body><meta itemprop="price" content="649000"></body></html>`
    expect(parseCentrisHtml(html).price).toBe(649000)
  })

  it('falls back to .price span (old layout)', () => {
    const html = `<html><body><div class="price"><span class="text-nowrap">$649,000</span></div></body></html>`
    expect(parseCentrisHtml(html).price).toBe(649000)
  })
})

describe('parseCentrisHtml — financial details', () => {
  it('reads yearly taxes and fees from the new BEM markup', () => {
    const html = `<html><body>${newLayoutFinancials}</body></html>`
    const result = parseCentrisHtml(html)
    expect(result.taxes_yearly).toBe(4250)
    expect(result.common_fees_yearly).toBe(3600)
  })

  it('still reads yearly taxes and fees from the old markup', () => {
    const html = `<html><body>${oldLayoutFinancials}</body></html>`
    const result = parseCentrisHtml(html)
    expect(result.taxes_yearly).toBe(4250)
    expect(result.common_fees_yearly).toBe(3600)
  })

  it('matches the French "Frais" label for fees', () => {
    const html = `<html><body>
      <div class="financial-details-table-container">
        <div class="financial-details-table-section-title">Frais</div>
        <table class="financial-details-table financial-details-table--yearly">
          <tr class="financial-details-table__row financial-details-table__row--total">
            <td class="financial-details-table__value">$3 600</td>
          </tr>
        </table>
      </div>
    </body></html>`
    expect(parseCentrisHtml(html).common_fees_yearly).toBe(3600)
  })
})
