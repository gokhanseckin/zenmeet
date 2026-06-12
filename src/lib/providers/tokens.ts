import type { TokenStore, RefreshFn } from './types'

export class TokenRefreshError extends Error {}

/**
 * Thrown by a {@link RefreshFn} when the provider rejects the refresh token
 * itself (OAuth `invalid_grant`) — i.e. the token is permanently dead and the
 * teacher must reconnect. Distinct from transient errors (network, 5xx, rate
 * limit) which must NOT trigger a reconnect flag.
 */
export class InvalidGrantError extends Error {}

const EXPIRY_MARGIN_MS = 60_000

export async function getValidAccessToken(store: TokenStore, refresh: RefreshFn, now = new Date()): Promise<string> {
  const loaded = await store.load()
  if (!loaded) throw new Error('Provider not connected')
  if (loaded.tokens.expires_at - now.getTime() > EXPIRY_MARGIN_MS) return loaded.tokens.access_token

  let next
  try {
    next = await refresh(loaded.tokens.refresh_token)
  } catch (e) {
    // Only an invalid_grant means the stored token is genuinely dead. Confirm
    // the stored value is still the one we tried to refresh (CAS) before
    // flagging — a concurrent refresh may have already replaced it with a good
    // token, in which case retry with the fresh value.
    if (e instanceof InvalidGrantError) {
      const flagged = await store.markNeedsReconnect({ expectedCas: loaded.cas })
      if (!flagged) {
        const reloaded = await store.load()
        if (reloaded && reloaded.tokens.expires_at - now.getTime() > EXPIRY_MARGIN_MS) {
          return reloaded.tokens.access_token
        }
      }
      throw new TokenRefreshError(`Token refresh failed: ${(e as Error).message}`)
    }
    // Transient error (network/5xx): do not flag for reconnect.
    throw new TokenRefreshError(`Token refresh failed: ${(e as Error).message}`)
  }

  // Compare-and-set: only persist if the stored ciphertext is unchanged since
  // load. If a concurrent refresher already rotated the token, our save lands
  // on zero rows; re-load and use the winner's token (rotating refresh tokens
  // mean our `next` may already be invalidated).
  const wrote = await store.save(next, { expectedCas: loaded.cas })
  if (!wrote) {
    const reloaded = await store.load()
    if (reloaded && reloaded.tokens.expires_at - now.getTime() > EXPIRY_MARGIN_MS) {
      return reloaded.tokens.access_token
    }
  }
  return next.access_token
}
