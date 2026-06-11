import { describe, it, expect } from 'vitest'
import { canJoin, unlocksAt, ACTIVE_STATUSES } from '@/lib/unlock'

const start = new Date('2026-06-15T11:00:00Z')

describe('unlock rule', () => {
  it('unlocks exactly 5 minutes before start', () => {
    expect(unlocksAt(start).toISOString()).toBe('2026-06-15T10:55:00.000Z')
  })
  it('denies before the window even for active members', () => {
    expect(canJoin({ membershipStatus: 'active', sessionStartsAt: start, now: new Date('2026-06-15T10:54:59Z') })).toBe(false)
  })
  it('allows trialing/active/past_due inside the window', () => {
    for (const s of ['trialing', 'active', 'past_due'] as const) {
      expect(canJoin({ membershipStatus: s, sessionStartsAt: start, now: new Date('2026-06-15T10:55:00Z') })).toBe(true)
    }
    expect([...ACTIVE_STATUSES].sort()).toEqual(['active', 'past_due', 'trialing'])
  })
  it('denies canceled and missing memberships always', () => {
    expect(canJoin({ membershipStatus: 'canceled', sessionStartsAt: start, now: new Date('2026-06-15T11:00:00Z') })).toBe(false)
    expect(canJoin({ membershipStatus: null, sessionStartsAt: start, now: new Date('2026-06-15T11:00:00Z') })).toBe(false)
  })
})
