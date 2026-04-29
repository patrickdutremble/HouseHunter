import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { requireEnv } from '@/lib/env'

describe('requireEnv', () => {
  const ORIGINAL = process.env

  beforeEach(() => {
    process.env = { ...ORIGINAL }
  })

  afterEach(() => {
    process.env = ORIGINAL
  })

  it('returns the value when the env var is set', () => {
    process.env.MY_VAR = 'hello'
    expect(requireEnv('MY_VAR')).toBe('hello')
  })

  it('throws a clear error when the env var is missing', () => {
    delete process.env.MY_VAR
    expect(() => requireEnv('MY_VAR')).toThrow(/MY_VAR/)
  })

  it('throws when the env var is an empty string', () => {
    process.env.MY_VAR = ''
    expect(() => requireEnv('MY_VAR')).toThrow(/MY_VAR/)
  })

  it('throws when the env var is whitespace-only', () => {
    process.env.MY_VAR = '   '
    expect(() => requireEnv('MY_VAR')).toThrow(/MY_VAR/)
  })
})
