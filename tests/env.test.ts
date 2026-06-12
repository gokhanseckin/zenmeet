import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Mirror the TOKEN_ENC_KEY refine in src/lib/env.ts. env() caches process.env
// at first call, so we test the refine rule directly to avoid global mutation.
const tokenKey = z.string().refine(
  (s) => { try { return Buffer.from(s, 'base64').length === 32 } catch { return false } },
  'TOKEN_ENC_KEY must be base64 of exactly 32 bytes',
)

describe('TOKEN_ENC_KEY validation', () => {
  it('accepts base64 of exactly 32 bytes', () => {
    const key = Buffer.alloc(32, 7).toString('base64') // 44 chars
    expect(tokenKey.safeParse(key).success).toBe(true)
  })
  it('rejects a 40+ char string that is not 32 decoded bytes', () => {
    // 31 bytes -> still long enough to pass the old min(40)? 31 bytes b64 ~ 44
    const key = Buffer.alloc(31, 7).toString('base64')
    expect(tokenKey.safeParse(key).success).toBe(false)
  })
  it('rejects a 33-byte key', () => {
    expect(tokenKey.safeParse(Buffer.alloc(33, 7).toString('base64')).success).toBe(false)
  })
  it('rejects a too-short key', () => {
    expect(tokenKey.safeParse('short').success).toBe(false)
  })
})
