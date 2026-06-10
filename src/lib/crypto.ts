import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/** Format: base64(iv[12] | authTag[16] | ciphertext). Key: base64 32 bytes. */
export function encryptJson(value: unknown, keyB64: string): string {
  const key = Buffer.from(keyB64, 'base64')
  if (key.length !== 32) throw new Error('TOKEN_ENC_KEY must be 32 bytes (base64)')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')
}

export function decryptJson<T = unknown>(payloadB64: string, keyB64: string): T {
  const key = Buffer.from(keyB64, 'base64')
  const buf = Buffer.from(payloadB64, 'base64')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const ct = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  const pt = Buffer.concat([decipher.update(ct), decipher.final()])
  return JSON.parse(pt.toString('utf8')) as T
}
