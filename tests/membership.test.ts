import { describe, it, expect, vi } from 'vitest'

// membership.ts (and its default-dep imports admin.ts / stripe.ts) `import
// 'server-only'`, whose real entry throws under vitest's node env. Neutralize
// it. All tests inject fakes, so the real Supabase/Stripe clients never run.
vi.mock('server-only', () => ({}))

import { getFreshMembership, type MembershipDeps } from '@/lib/membership'

type MembershipRow = {
  student_id: string
  classroom_id: string
  stripe_customer_id: string
  stripe_subscription_id: string | null
  stripe_subscription_created_at?: string | null
  status: string
  current_period_end: string | null
}

// Minimal Supabase-query-builder fake: every chained method returns `this`,
// the terminal awaitables resolve to the canned row / upsert capture.
function makeDb(existing: MembershipRow | null) {
  const upserts: MembershipRow[] = []
  let pending: 'select' | 'upsert' = 'select'
  let upsertPayload: MembershipRow | null = null

  const builder: any = {
    select() { return this },
    eq() { return this },
    maybeSingle() { return Promise.resolve({ data: existing }) },
    upsert(payload: MembershipRow) { pending = 'upsert'; upsertPayload = payload; return this },
    single() {
      if (pending === 'upsert' && upsertPayload) {
        upserts.push(upsertPayload)
        return Promise.resolve({ data: upsertPayload })
      }
      return Promise.resolve({ data: existing })
    },
  }
  const db: any = { from() { pending = 'select'; return builder } }
  return { db: () => db, upserts }
}

// Stripe fake: records which ids were retrieved; checkout session maps to a sub id,
// subscriptions map to a canned subscription object.
function makeStripe(opts: {
  checkoutSubId?: string | null
  subs?: Record<string, any>
}) {
  const retrievedSubs: string[] = []
  const retrievedSessions: string[] = []
  const stripeClient: any = {
    checkout: {
      sessions: {
        retrieve(id: string) {
          retrievedSessions.push(id)
          return Promise.resolve({ subscription: opts.checkoutSubId ?? null })
        },
      },
    },
    subscriptions: {
      retrieve(id: string) {
        retrievedSubs.push(id)
        return Promise.resolve(opts.subs?.[id])
      },
    },
  }
  return { stripe: () => stripeClient, retrievedSubs, retrievedSessions }
}

const onAccount = (accountId: string) => ({ stripeAccount: accountId }) as any

function makeSub(id: string, status: string, periodEndUnix = 1781568000): any {
  return {
    id,
    customer: 'cus_new',
    status,
    created: 1781481600,
    current_period_end: periodEndUnix,
    metadata: { student_id: 'stu-1', classroom_id: 'cls-1' },
  }
}

const baseArgs = {
  studentId: 'stu-1',
  classroomId: 'cls-1',
  stripeAccountId: 'acct_T1',
}

describe('getFreshMembership', () => {
  it('re-subscribe: resolves the NEW sub from the checkout session, not the stale stored sub', async () => {
    // Student previously canceled; stored sub is the OLD canceled one.
    const existing: MembershipRow = {
      student_id: 'stu-1', classroom_id: 'cls-1',
      stripe_customer_id: 'cus_old', stripe_subscription_id: 'sub_OLD',
      status: 'canceled', current_period_end: '2026-01-01T00:00:00.000Z',
    }
    const { db, upserts } = makeDb(existing)
    const sFake = makeStripe({
      checkoutSubId: 'sub_NEW',
      subs: {
        sub_NEW: makeSub('sub_NEW', 'active'),
        sub_OLD: makeSub('sub_OLD', 'canceled'),
      },
    })
    const deps: MembershipDeps = { db, stripe: sFake.stripe, onAccount }

    const result = await getFreshMembership({ ...baseArgs, checkoutSessionId: 'cs_123' }, deps)

    // The NEW sub was retrieved (not the stale stored one).
    expect(sFake.retrievedSessions).toEqual(['cs_123'])
    expect(sFake.retrievedSubs).toEqual(['sub_NEW'])
    expect(result?.status).toBe('active')
    expect(result?.stripe_subscription_id).toBe('sub_NEW')
    expect(upserts).toHaveLength(1)
    expect(upserts[0].status).toBe('active')
  })

  it('re-subscribe with trialing new sub writes trialing, not canceled', async () => {
    const existing: MembershipRow = {
      student_id: 'stu-1', classroom_id: 'cls-1',
      stripe_customer_id: 'cus_old', stripe_subscription_id: 'sub_OLD',
      status: 'canceled', current_period_end: '2026-01-01T00:00:00.000Z',
    }
    const { db, upserts } = makeDb(existing)
    const sFake = makeStripe({
      checkoutSubId: 'sub_NEW',
      subs: { sub_NEW: makeSub('sub_NEW', 'trialing') },
    })
    const deps: MembershipDeps = { db, stripe: sFake.stripe, onAccount }

    const result = await getFreshMembership({ ...baseArgs, checkoutSessionId: 'cs_123' }, deps)

    expect(sFake.retrievedSubs).toEqual(['sub_NEW'])
    expect(result?.status).toBe('trialing')
  })

  it('no checkout session: uses the existing stored sub and returns it without reconciling', async () => {
    // Active, not stale → no reconcile, no Stripe calls, returns stored row.
    const existing: MembershipRow = {
      student_id: 'stu-1', classroom_id: 'cls-1',
      stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_CURRENT',
      status: 'active', current_period_end: '2999-01-01T00:00:00.000Z',
    }
    const { db, upserts } = makeDb(existing)
    const sFake = makeStripe({ subs: { sub_CURRENT: makeSub('sub_CURRENT', 'active') } })
    const deps: MembershipDeps = { db, stripe: sFake.stripe, onAccount }

    const result = await getFreshMembership({ ...baseArgs }, deps)

    expect(sFake.retrievedSessions).toEqual([])
    expect(sFake.retrievedSubs).toEqual([])
    expect(result).toEqual(existing)
    expect(upserts).toHaveLength(0)
  })

  it('no checkout session but stale active row: reconciles using the stored sub', async () => {
    const existing: MembershipRow = {
      student_id: 'stu-1', classroom_id: 'cls-1',
      stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_CURRENT',
      status: 'active', current_period_end: '2026-01-01T00:00:00.000Z', // past → stale
    }
    const { db, upserts } = makeDb(existing)
    const sFake = makeStripe({ subs: { sub_CURRENT: makeSub('sub_CURRENT', 'active') } })
    const deps: MembershipDeps = { db, stripe: sFake.stripe, onAccount }

    const result = await getFreshMembership({ ...baseArgs }, deps)

    // No checkout session consulted; fell back to the stored sub.
    expect(sFake.retrievedSessions).toEqual([])
    expect(sFake.retrievedSubs).toEqual(['sub_CURRENT'])
    expect(result?.status).toBe('active')
    expect(upserts).toHaveLength(1)
  })

  it('no checkout session but expired active row: reconciles a missed cancellation from Stripe', async () => {
    const existing: MembershipRow = {
      student_id: 'stu-1', classroom_id: 'cls-1',
      stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_CURRENT',
      status: 'active', current_period_end: '2026-01-01T00:00:00.000Z',
    }
    const { db, upserts } = makeDb(existing)
    const sFake = makeStripe({ subs: { sub_CURRENT: makeSub('sub_CURRENT', 'canceled') } })
    const deps: MembershipDeps = { db, stripe: sFake.stripe, onAccount }

    const result = await getFreshMembership({ ...baseArgs }, deps)

    expect(sFake.retrievedSubs).toEqual(['sub_CURRENT'])
    expect(result?.status).toBe('canceled')
    expect(upserts).toHaveLength(1)
    expect(upserts[0].status).toBe('canceled')
  })

  it('metadata mismatch: checkout sub belongs to someone else — does not mint a membership', async () => {
    const existing: MembershipRow = {
      student_id: 'stu-1', classroom_id: 'cls-1',
      stripe_customer_id: 'cus_old', stripe_subscription_id: 'sub_OLD',
      status: 'canceled', current_period_end: '2026-01-01T00:00:00.000Z',
    }
    const { db, upserts } = makeDb(existing)
    const foreignSub = makeSub('sub_NEW', 'active')
    foreignSub.metadata = { student_id: 'someone-else', classroom_id: 'cls-1' }
    const sFake = makeStripe({
      checkoutSubId: 'sub_NEW',
      subs: { sub_NEW: foreignSub },
    })
    const deps: MembershipDeps = { db, stripe: sFake.stripe, onAccount }

    const result = await getFreshMembership({ ...baseArgs, checkoutSessionId: 'cs_123' }, deps)

    expect(sFake.retrievedSubs).toEqual(['sub_NEW'])
    expect(upserts).toHaveLength(0) // did not mint
    expect(result).toEqual(existing) // returned the stale existing row, unchanged
  })
})
