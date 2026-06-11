import type { StoredTokens, TokenStore, RefreshFn } from './types'

export class TokenRefreshError extends Error {}

const EXPIRY_MARGIN_MS = 60_000

export async function getValidAccessToken(store: TokenStore, refresh: RefreshFn, now = new Date()): Promise<string> {
  const tokens = await store.load()
  if (!tokens) throw new Error('Provider not connected')
  if (tokens.expires_at - now.getTime() > EXPIRY_MARGIN_MS) return tokens.access_token
  try {
    const next = await refresh(tokens.refresh_token)
    await store.save(next)
    return next.access_token
  } catch (e) {
    await store.markNeedsReconnect()
    throw new TokenRefreshError(`Token refresh failed: ${(e as Error).message}`)
  }
}
