import { describe, it, expect, vi } from 'vitest'
import { getValidAccessToken, TokenRefreshError } from '@/lib/providers/tokens'
import type { StoredTokens, TokenStore } from '@/lib/providers/types'

function makeStore(initial: StoredTokens | null) {
  let saved: StoredTokens | null = null
  let reconnect = false
  const store: TokenStore = {
    load: async () => initial,
    save: async (t) => { saved = t },
    markNeedsReconnect: async () => { reconnect = true },
  }
  return { store, get saved() { return saved }, get reconnect() { return reconnect } }
}

const now = new Date('2026-06-15T10:00:00Z')
const fresh: StoredTokens = { access_token: 'A', refresh_token: 'R', expires_at: now.getTime() + 3600_000 }
const expired: StoredTokens = { access_token: 'old', refresh_token: 'R', expires_at: now.getTime() - 1000 }

describe('getValidAccessToken', () => {
  it('returns the stored token when not near expiry, without refreshing', async () => {
    const ctx = makeStore(fresh)
    const refresh = vi.fn()
    expect(await getValidAccessToken(ctx.store, refresh as any, now)).toBe('A')
    expect(refresh).not.toHaveBeenCalled()
  })
  it('refreshes and saves when expired (or within 60s of expiry)', async () => {
    const ctx = makeStore(expired)
    const refresh = vi.fn(async () => ({ access_token: 'NEW', refresh_token: 'R2', expires_at: now.getTime() + 3600_000 }))
    expect(await getValidAccessToken(ctx.store, refresh, now)).toBe('NEW')
    expect(ctx.saved?.access_token).toBe('NEW')
  })
  it('marks needs_reconnect and throws when refresh fails', async () => {
    const ctx = makeStore(expired)
    const refresh = vi.fn(async () => { throw new Error('invalid_grant') })
    await expect(getValidAccessToken(ctx.store, refresh, now)).rejects.toThrow(TokenRefreshError)
    expect(ctx.reconnect).toBe(true)
  })
  it('throws NotConnected when there are no tokens', async () => {
    const ctx = makeStore(null)
    await expect(getValidAccessToken(ctx.store, vi.fn() as any, now)).rejects.toThrow(/not connected/i)
  })
})
