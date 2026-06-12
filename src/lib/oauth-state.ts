import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { tokenEnv } from '@/lib/env'

export type OAuthStateProvider = 'google' | 'zoom' | 'stripe'

const STATE_MAX_AGE_SECONDS = 600

type OAuthStatePayload = {
  v: 1
  p: OAuthStateProvider
  n: string
  u: string
  i: number
}

function stateSecret() {
  return Buffer.from(tokenEnv().TOKEN_ENC_KEY, 'base64')
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url')
}

function sign(payload: string) {
  return createHmac('sha256', stateSecret()).update(payload).digest('base64url')
}

function safeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
}

export function createOAuthState(provider: OAuthStateProvider, userId: string) {
  const state = randomBytes(32).toString('base64url')
  const payload: OAuthStatePayload = {
    v: 1,
    p: provider,
    n: state,
    u: userId,
    i: Date.now(),
  }
  const encodedPayload = base64Url(JSON.stringify(payload))
  return {
    state,
    cookieValue: `${encodedPayload}.${sign(encodedPayload)}`,
  }
}

export function verifyOAuthState(input: {
  provider: OAuthStateProvider
  state: string | null
  cookieValue: string | undefined
  userId: string
}) {
  if (!input.state || !input.cookieValue) return false
  const [encodedPayload, signature] = input.cookieValue.split('.')
  if (!encodedPayload || !signature || !safeEqual(sign(encodedPayload), signature)) return false

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload
    const ageSeconds = (Date.now() - payload.i) / 1000
    return (
      payload.v === 1 &&
      payload.p === input.provider &&
      payload.n === input.state &&
      payload.u === input.userId &&
      ageSeconds >= 0 &&
      ageSeconds <= STATE_MAX_AGE_SECONDS
    )
  } catch {
    return false
  }
}
