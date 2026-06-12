import { beforeEach, describe, it, expect, vi } from 'vitest'

// The join route module transitively imports `server-only` (via @/lib/auth and
// @/lib/supabase/admin), whose real entry throws under vitest's node env. We only
// exercise the pure exported guards here, so neutralize it.
vi.mock('server-only', () => ({}))

const routeMocks = vi.hoisted(() => ({
  user: { id: 'stu-1' } as { id: string } | null,
  session: null as any,
  membership: null as any,
  selectCalls: [] as Array<{ table: string; columns: string }>,
  getUser: vi.fn(),
  getFreshMembership: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUser: routeMocks.getUser,
}))

vi.mock('@/lib/membership', () => ({
  getFreshMembership: routeMocks.getFreshMembership,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({
    from(table: string) {
      const builder = {
        select(columns: string) {
          routeMocks.selectCalls.push({ table, columns })
          return this
        },
        eq() { return this },
        single() {
          return Promise.resolve({ data: table === 'sessions' ? routeMocks.session : null })
        },
        maybeSingle() {
          return Promise.resolve({ data: table === 'memberships' ? routeMocks.membership : null })
        },
      }
      return builder
    },
  }),
}))

import {
  isAllowedJoinUrl,
  sessionEnded,
  ALLOWED_JOIN_HOSTS,
  GET,
} from '@/app/api/join/[sessionId]/route'
import { PAST_DUE_GRACE_DAYS } from '@/lib/unlock'

const sessionId = '11111111-1111-4111-8111-111111111111'

function makeSession(stripeAccountId: string | null) {
  return {
    id: sessionId,
    starts_at: '2000-01-01T00:00:00.000Z',
    ends_at: '2999-01-01T00:00:00.000Z',
    status: 'scheduled',
    join_url: 'https://meet.google.com/abc-defg-hij',
    classroom_id: 'cls-1',
    classrooms: {
      slug: 'class-1',
      teacher_id: 'teacher-1',
      teachers: { stripe_account_id: stripeAccountId },
    },
  }
}

async function join() {
  return GET(new Request(`https://zenmeet.test/api/join/${sessionId}`) as any, {
    params: Promise.resolve({ sessionId }),
  })
}

beforeEach(() => {
  routeMocks.user = { id: 'stu-1' }
  routeMocks.session = makeSession('acct_T1')
  routeMocks.membership = null
  routeMocks.selectCalls = []
  routeMocks.getUser.mockReset()
  routeMocks.getUser.mockImplementation(() => Promise.resolve(routeMocks.user))
  routeMocks.getFreshMembership.mockReset()
})

describe('isAllowedJoinUrl (open-redirect allowlist)', () => {
  it('accepts a Google Meet link', () => {
    expect(isAllowedJoinUrl('https://meet.google.com/abc-defg-hij')).toBe(true)
  })
  it('accepts a Zoom join URL on a regional subdomain', () => {
    expect(isAllowedJoinUrl('https://us05web.zoom.us/j/123456789?pwd=xyz')).toBe(true)
  })
  it('accepts the bare zoom.us host', () => {
    expect(isAllowedJoinUrl('https://zoom.us/j/123')).toBe(true)
  })
  it('rejects a non-provider host', () => {
    expect(isAllowedJoinUrl('https://evil.com/phish')).toBe(false)
  })
  it('rejects a look-alike suffix host', () => {
    // not a subdomain of zoom.us — the registrable host is notzoom.us
    expect(isAllowedJoinUrl('https://evilzoom.us/j/1')).toBe(false)
    expect(isAllowedJoinUrl('https://meet.google.com.evil.com/x')).toBe(false)
  })
  it('rejects non-https schemes', () => {
    expect(isAllowedJoinUrl('http://zoom.us/j/1')).toBe(false)
    expect(isAllowedJoinUrl('javascript:alert(1)')).toBe(false)
  })
  it('rejects garbage / non-URLs', () => {
    expect(isAllowedJoinUrl('not a url')).toBe(false)
    expect(isAllowedJoinUrl('')).toBe(false)
  })
  it('exposes the exact allowlist', () => {
    expect([...ALLOWED_JOIN_HOSTS].sort()).toEqual(['meet.google.com', 'zoom.us'])
  })
})

describe('sessionEnded (stale-session rejection)', () => {
  const now = new Date('2026-06-15T12:00:00Z')

  it('treats a done session as ended', () => {
    expect(sessionEnded({ status: 'done', ends_at: '2026-06-15T13:00:00Z' }, now)).toBe(true)
  })
  it('treats a session whose ends_at is in the past as ended', () => {
    expect(sessionEnded({ status: 'scheduled', ends_at: '2026-06-15T11:59:59Z' }, now)).toBe(true)
  })
  it('treats ends_at exactly equal to now as ended', () => {
    expect(sessionEnded({ status: 'scheduled', ends_at: '2026-06-15T12:00:00Z' }, now)).toBe(true)
  })
  it('allows a live session whose end is still in the future', () => {
    expect(sessionEnded({ status: 'live', ends_at: '2026-06-15T13:00:00Z' }, now)).toBe(false)
  })
  it('allows an upcoming scheduled session', () => {
    expect(sessionEnded({ status: 'scheduled', ends_at: '2026-06-15T13:00:00Z' }, now)).toBe(false)
  })
})

describe('GET join membership authority', () => {
  it('selects teacher Stripe authority and reconciles through Stripe before allowing a connected-account member', async () => {
    routeMocks.getFreshMembership.mockResolvedValue({
      status: 'active',
      current_period_end: '2999-01-01T00:00:00.000Z',
      stripe_subscription_id: 'sub_NEW',
    })

    const res = await join()

    expect(routeMocks.selectCalls.find((c) => c.table === 'sessions')?.columns)
      .toContain('teachers!inner(stripe_account_id)')
    expect(routeMocks.getFreshMembership).toHaveBeenCalledWith({
      studentId: 'stu-1',
      classroomId: 'cls-1',
      stripeAccountId: 'acct_T1',
      checkoutSessionId: undefined,
    })
    expect(res.headers.get('location')).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('locks a connected-account member when reconciliation returns an expired active row', async () => {
    routeMocks.getFreshMembership.mockResolvedValue({
      status: 'active',
      current_period_end: '2000-01-01T00:00:00.000Z',
      stripe_subscription_id: 'sub_OLD',
    })

    const res = await join()

    expect(res.headers.get('location')).toBe('https://zenmeet.test/my/class-1?locked=1')
  })

  it('uses local status plus bounded grace when the teacher has no connected Stripe account', async () => {
    routeMocks.session = makeSession(null)
    routeMocks.membership = {
      status: 'past_due',
      current_period_end: new Date(Date.now() - 60_000).toISOString(),
      stripe_subscription_id: 'sub_LOCAL',
    }

    const res = await join()

    expect(routeMocks.getFreshMembership).not.toHaveBeenCalled()
    expect(routeMocks.selectCalls.find((c) => c.table === 'memberships')?.columns)
      .toContain('current_period_end')
    expect(routeMocks.selectCalls.find((c) => c.table === 'memberships')?.columns)
      .toContain('stripe_subscription_id')
    expect(res.headers.get('location')).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('locks a local past_due membership after the bounded grace window when Connect is gone', async () => {
    routeMocks.session = makeSession(null)
    routeMocks.membership = {
      status: 'past_due',
      current_period_end: new Date(
        Date.now() - (PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000) - 1,
      ).toISOString(),
      stripe_subscription_id: 'sub_LOCAL',
    }

    const res = await join()

    expect(routeMocks.getFreshMembership).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('https://zenmeet.test/my/class-1?locked=1')
  })
})
