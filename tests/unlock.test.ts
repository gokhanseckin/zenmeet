import { describe, it, expect } from 'vitest'
import {
  canJoin,
  unlocksAt,
  ACTIVE_STATUSES,
  PAST_DUE_GRACE_DAYS,
  hasMembershipAccess,
} from '@/lib/unlock'

const start = new Date('2026-06-15T11:00:00Z')

describe('unlock rule', () => {
  it('unlocks exactly 5 minutes before start', () => {
    expect(unlocksAt(start).toISOString()).toBe('2026-06-15T10:55:00.000Z')
  })
  it('denies before the window even for active members', () => {
    expect(canJoin({ membershipStatus: 'active', sessionStartsAt: start, now: new Date('2026-06-15T10:54:59Z') })).toBe(false)
  })
  it('allows trialing/active inside the window when the period is current', () => {
    for (const s of ['trialing', 'active'] as const) {
      expect(canJoin({
        membershipStatus: s,
        currentPeriodEnd: new Date('2026-06-16T00:00:00Z'),
        sessionStartsAt: start,
        now: new Date('2026-06-15T10:55:00Z'),
      })).toBe(true)
    }
    expect([...ACTIVE_STATUSES].sort()).toEqual(['active', 'past_due', 'trialing'])
  })
  it('denies active and trialing memberships whose known period has expired', () => {
    for (const s of ['trialing', 'active'] as const) {
      expect(hasMembershipAccess({
        status: s,
        currentPeriodEnd: new Date('2026-06-14T00:00:00Z'),
        now: new Date('2026-06-15T10:55:00Z'),
      })).toBe(false)
      expect(canJoin({
        membershipStatus: s,
        currentPeriodEnd: new Date('2026-06-14T00:00:00Z'),
        sessionStartsAt: start,
        now: new Date('2026-06-15T10:55:00Z'),
      })).toBe(false)
    }
  })
  it('denies active and trialing memberships without a known period end', () => {
    for (const s of ['trialing', 'active'] as const) {
      expect(hasMembershipAccess({
        status: s,
        currentPeriodEnd: null,
        now: new Date('2026-06-15T10:55:00Z'),
      })).toBe(false)
    }
  })
  it('allows past_due only through the bounded grace window after period end', () => {
    const periodEnd = new Date('2026-06-14T10:55:00Z')
    expect(PAST_DUE_GRACE_DAYS).toBeGreaterThan(0)
    expect(hasMembershipAccess({
      status: 'past_due',
      currentPeriodEnd: periodEnd,
      now: new Date(periodEnd.getTime() - 1),
    })).toBe(false)
    expect(hasMembershipAccess({
      status: 'past_due',
      currentPeriodEnd: periodEnd,
      now: new Date(periodEnd.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000),
    })).toBe(true)
    expect(canJoin({
      membershipStatus: 'past_due',
      currentPeriodEnd: periodEnd,
      sessionStartsAt: start,
      now: new Date('2026-06-15T10:55:00Z'),
    })).toBe(true)
    expect(hasMembershipAccess({
      status: 'past_due',
      currentPeriodEnd: periodEnd,
      now: new Date(periodEnd.getTime() + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000 + 1),
    })).toBe(false)
    expect(hasMembershipAccess({
      status: 'past_due',
      currentPeriodEnd: null,
      now: new Date('2026-06-15T10:55:00Z'),
    })).toBe(false)
  })
  it('denies canceled and missing memberships always', () => {
    expect(canJoin({ membershipStatus: 'canceled', sessionStartsAt: start, now: new Date('2026-06-15T11:00:00Z') })).toBe(false)
    expect(canJoin({ membershipStatus: null, sessionStartsAt: start, now: new Date('2026-06-15T11:00:00Z') })).toBe(false)
  })
})
