import { describe, it, expect } from 'vitest'
import { encryptJson, decryptJson } from '@/lib/crypto'

const KEY = Buffer.alloc(32, 7).toString('base64')

describe('token crypto', () => {
  it('round-trips an object', () => {
    const enc = encryptJson({ access_token: 'a', refresh_token: 'r' }, KEY)
    expect(decryptJson(enc, KEY)).toEqual({ access_token: 'a', refresh_token: 'r' })
  })
  it('produces different ciphertext each call (random IV)', () => {
    expect(encryptJson({ a: 1 }, KEY)).not.toEqual(encryptJson({ a: 1 }, KEY))
  })
  it('rejects tampered ciphertext', () => {
    const enc = encryptJson({ a: 1 }, KEY)
    const tampered = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptJson(tampered, KEY)).toThrow()
  })
  it('rejects a wrong key', () => {
    const enc = encryptJson({ a: 1 }, KEY)
    const otherKey = Buffer.alloc(32, 9).toString('base64')
    expect(() => decryptJson(enc, otherKey)).toThrow()
  })
  it('rejects truncated payloads with a clear error', () => {
    expect(() => decryptJson(Buffer.alloc(10).toString('base64'), KEY)).toThrow(/too short/)
  })

  it('round-trips with AAD', () => {
    const enc = encryptJson({ a: 1 }, KEY, 'teacher-1:zoom')
    expect(decryptJson(enc, KEY, 'teacher-1:zoom')).toEqual({ a: 1 })
  })
  it('rejects decrypt when AAD differs (blob-swap defence)', () => {
    const enc = encryptJson({ secret: 1 }, KEY, 'teacherA:zoom')
    expect(() => decryptJson(enc, KEY, 'teacherB:zoom')).toThrow()
  })
  it('decrypts legacy ciphertext (written without AAD) when AAD is requested', () => {
    // Pre-AAD rows: encrypted with no AAD. Reading with AAD must still work.
    const legacy = encryptJson({ a: 1 }, KEY)
    expect(decryptJson(legacy, KEY, 'teacher-1:zoom')).toEqual({ a: 1 })
  })
  it('legacy fallback still rejects genuinely tampered ciphertext', () => {
    const enc = encryptJson({ a: 1 }, KEY, 'teacher-1:zoom')
    const tampered = enc.slice(0, -4) + (enc.endsWith('AAAA') ? 'BBBB' : 'AAAA')
    expect(() => decryptJson(tampered, KEY, 'teacher-1:zoom')).toThrow()
  })
})
