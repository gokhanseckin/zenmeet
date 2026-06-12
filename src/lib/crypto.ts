import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Format: base64(iv[12] | authTag[16] | ciphertext). Key: base64 32 bytes. */
export function encryptJson(value: unknown, keyB64: string, aad?: string): string {
  const key = Buffer.from(keyB64, 'base64')
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes (base64)')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')
}

/**
 * Decrypt a payload produced by {@link encryptJson}.
 *
 * `aad` binds the ciphertext to its context (e.g. `teacherId:provider`) so a
 * blob copied into another row/column fails the GCM auth tag. For backward
 * compat, rows encrypted BEFORE AAD was introduced have no AAD bound: if an
 * AAD-bound decrypt fails the auth tag, we transparently retry WITHOUT AAD.
 * This is safe because GCM still authenticates key + IV + ciphertext on the
 * fallback, so a real tamper/blob-swap (different ciphertext) still throws —
 * only a genuine legacy row (correct ciphertext, no AAD) succeeds. New writes
 * always include AAD, so legacy rows self-heal on the next save.
 */
export function decryptJson<T = unknown>(payloadB64: string, keyB64: string, aad?: string): T {
  const key = Buffer.from(keyB64, 'base64')
  const buf = Buffer.from(payloadB64, 'base64')
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes (base64)')
  if (buf.length < 29) throw new Error('decryptJson: payload too short or corrupted')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const open = (withAad: boolean): T => {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    if (withAad && aad !== undefined) decipher.setAAD(Buffer.from(aad, 'utf8'))
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return JSON.parse(pt.toString('utf8')) as T
  }
  try {
    return open(true)
  } catch (e) {
    // Legacy fallback: only when AAD was requested. Retry without AAD to read
    // rows written before AAD binding existed. If the ciphertext is genuinely
    // tampered/swapped, this also fails the auth tag and rethrows.
    if (aad === undefined) throw e
    return open(false)
  }
}
