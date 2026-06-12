import { describe, it, expect, vi } from 'vitest'
import { getValidAccessToken, TokenRefreshError, InvalidGrantError } from '@/lib/providers/tokens'
import type { StoredTokens, TokenStore } from '@/lib/providers/types'

// A CAS-aware in-memory store. `cas` is a monotonically rising stamp standing
// in for the stored ciphertext; saves/flags with a stale expectedCas no-op.
function makeStore(initial: StoredTokens | null) {
  let current = initial
  let cas = initial ? 'cas0' : ''
  let counter = 0
  let saved: StoredTokens | null = null
  let reconnect = false
  const store: TokenStore = {
    load: async () => (current ? { tokens: current, cas } : null),
    save: async (t, opts) => {
      if (opts?.expectedCas !== undefined && opts.expectedCas !== cas) return false
      current = t
      cas = `cas${++counter}`
      saved = t
      return true
    },
    markNeedsReconnect: async (opts) => {
      if (opts?.expectedCas !== undefined && opts.expectedCas !== cas) return false
      reconnect = true
      return true
    },
  }
  return {
    store,
    get saved() { return saved },
    get reconnect() { return reconnect },
    // Simulate a concurrent writer landing a new token (rotates the CAS).
    concurrentSave(t: StoredTokens) { current = t; cas = `cas${++counter}` },
  }
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
  it('marks needs_reconnect and throws on invalid_grant', async () => {
    const ctx = makeStore(expired)
    const refresh = vi.fn(async () => { throw new InvalidGrantError('invalid_grant') })
    await expect(getValidAccessToken(ctx.store, refresh, now)).rejects.toThrow(TokenRefreshError)
    expect(ctx.reconnect).toBe(true)
  })
  it('does NOT mark needs_reconnect on a transient (non invalid_grant) error', async () => {
    const ctx = makeStore(expired)
    const refresh = vi.fn(async () => { throw new Error('network ETIMEDOUT') })
    await expect(getValidAccessToken(ctx.store, refresh, now)).rejects.toThrow(TokenRefreshError)
    expect(ctx.reconnect).toBe(false)
  })
  it('throws NotConnected when there are no tokens', async () => {
    const ctx = makeStore(null)
    await expect(getValidAccessToken(ctx.store, vi.fn() as any, now)).rejects.toThrow(/not connected/i)
  })

  it('on a lost CAS save race, re-loads and returns the concurrent winner token', async () => {
    const ctx = makeStore(expired)
    const winner: StoredTokens = { access_token: 'WINNER', refresh_token: 'RW', expires_at: now.getTime() + 3600_000 }
    const refresh = vi.fn(async () => {
      // A concurrent refresher commits first, rotating the CAS.
      ctx.concurrentSave(winner)
      return { access_token: 'LOSER', refresh_token: 'RL', expires_at: now.getTime() + 3600_000 }
    })
    expect(await getValidAccessToken(ctx.store, refresh, now)).toBe('WINNER')
  })

  it('on invalid_grant after a concurrent refresh, does not flag and uses the fresh token', async () => {
    const ctx = makeStore(expired)
    const winner: StoredTokens = { access_token: 'WINNER', refresh_token: 'RW', expires_at: now.getTime() + 3600_000 }
    const refresh = vi.fn(async () => {
      // Our refresh token was already rotated by a concurrent winner; the
      // provider rejects ours with invalid_grant, but the stored token is fine.
      ctx.concurrentSave(winner)
      throw new InvalidGrantError('invalid_grant')
    })
    expect(await getValidAccessToken(ctx.store, refresh, now)).toBe('WINNER')
    expect(ctx.reconnect).toBe(false)
  })
})
