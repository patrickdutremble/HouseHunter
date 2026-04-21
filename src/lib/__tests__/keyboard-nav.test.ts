import { describe, it, expect } from 'vitest'
import { nextId, prevId, firstId, lastId } from '../keyboard-nav'

const ITEMS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('keyboard-nav', () => {
  describe('nextId', () => {
    it('returns first id when current is null', () => {
      expect(nextId(ITEMS, null)).toBe('a')
    })
    it('returns next id when current is in list', () => {
      expect(nextId(ITEMS, 'a')).toBe('b')
    })
    it('clamps at last id when current is last', () => {
      expect(nextId(ITEMS, 'c')).toBe('c')
    })
    it('returns first id when current is not in list', () => {
      expect(nextId(ITEMS, 'missing')).toBe('a')
    })
    it('returns null when list is empty', () => {
      expect(nextId([], null)).toBeNull()
      expect(nextId([], 'a')).toBeNull()
    })
  })

  describe('prevId', () => {
    it('returns last id when current is null', () => {
      expect(prevId(ITEMS, null)).toBe('c')
    })
    it('returns previous id when current is in list', () => {
      expect(prevId(ITEMS, 'b')).toBe('a')
    })
    it('clamps at first id when current is first', () => {
      expect(prevId(ITEMS, 'a')).toBe('a')
    })
    it('returns last id when current is not in list', () => {
      expect(prevId(ITEMS, 'missing')).toBe('c')
    })
    it('returns null when list is empty', () => {
      expect(prevId([], null)).toBeNull()
    })
  })

  describe('firstId / lastId', () => {
    it('returns first/last for non-empty list', () => {
      expect(firstId(ITEMS)).toBe('a')
      expect(lastId(ITEMS)).toBe('c')
    })
    it('returns null for empty list', () => {
      expect(firstId([])).toBeNull()
      expect(lastId([])).toBeNull()
    })
  })
})
