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
