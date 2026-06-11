import { describe, it, expect, beforeEach } from 'vitest'
import { handleStripeEvent, type WebhookDb, type MembershipUpsert } from '@/lib/stripe-webhook'

function makeDb() {
  const seen = new Set<string>()
  const upserts: MembershipUpsert[] = []
  const cleared: string[] = []
  const db: WebhookDb = {
    async wasProcessed(id) { return seen.has(id) },
    async markProcessed(id) { seen.add(id) },
    async upsertMembership(m) { upserts.push(m) },
    async clearStripeAccount(accountId) { cleared.push(accountId) },
  }
  return { db, upserts, cleared }
}

const subEvent = (id: string, status: string, type = 'customer.subscription.updated') => ({
  id, type, account: 'acct_T1',
  data: { object: {
    id: 'sub_1', customer: 'cus_1', status,
    items: { data: [{ current_period_end: 1781568000 }] }, // 2026-06-16T00:00:00Z
    metadata: { classroom_id: 'cls-1', student_id: 'stu-1' },
  } },
}) as any

describe('handleStripeEvent', () => {
  let ctx: ReturnType<typeof makeDb>
  beforeEach(() => { ctx = makeDb() })

  it('upserts membership from subscription events with metadata', async () => {
    await handleStripeEvent(subEvent('evt_1', 'active'), ctx.db)
    expect(ctx.upserts).toEqual([{
      classroomId: 'cls-1', studentId: 'stu-1', stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1', status: 'active',
      currentPeriodEnd: new Date('2026-06-16T00:00:00.000Z'),
    }])
  })
  it('maps subscription.deleted to canceled', async () => {
    await handleStripeEvent(subEvent('evt_2', 'canceled', 'customer.subscription.deleted'), ctx.db)
    expect(ctx.upserts[0].status).toBe('canceled')
  })
  it('maps unknown stripe statuses conservatively', async () => {
    await handleStripeEvent(subEvent('evt_3', 'unpaid'), ctx.db)
    expect(ctx.upserts[0].status).toBe('canceled')
    await handleStripeEvent(subEvent('evt_4', 'incomplete'), ctx.db)
    expect(ctx.upserts[1].status).toBe('canceled')
  })
  it('is idempotent on event id', async () => {
    await handleStripeEvent(subEvent('evt_5', 'active'), ctx.db)
    await handleStripeEvent(subEvent('evt_5', 'active'), ctx.db)
    expect(ctx.upserts).toHaveLength(1)
  })
  it('ignores events without classroom metadata (not ours)', async () => {
    const e = subEvent('evt_6', 'active'); e.data.object.metadata = {}
    await handleStripeEvent(e, ctx.db)
    expect(ctx.upserts).toHaveLength(0)
  })
  it('clears the teacher stripe account on account.application.deauthorized', async () => {
    const e = { id: 'evt_da1', type: 'account.application.deauthorized', account: 'acct_T9', data: { object: { id: 'ca_app' } } } as any
    await handleStripeEvent(e, ctx.db)
    expect(ctx.cleared).toEqual(['acct_T9'])
    expect(ctx.upserts).toHaveLength(0) // existing student memberships left intact
  })
  it('is idempotent on deauthorized event id', async () => {
    const e = { id: 'evt_da2', type: 'account.application.deauthorized', account: 'acct_T9', data: { object: { id: 'ca_app' } } } as any
    await handleStripeEvent(e, ctx.db)
    await handleStripeEvent(e, ctx.db)
    expect(ctx.cleared).toEqual(['acct_T9'])
  })
  it('ignores a deauthorized event with no account', async () => {
    const e = { id: 'evt_da3', type: 'account.application.deauthorized', data: { object: { id: 'ca_app' } } } as any
    await handleStripeEvent(e, ctx.db)
    expect(ctx.cleared).toHaveLength(0)
  })
  it('a failed clear is retryable (id not recorded until success)', async () => {
    let calls = 0
    const seen = new Set<string>()
    const cleared: string[] = []
    const db: WebhookDb = {
      wasProcessed: async (id) => seen.has(id),
      markProcessed: async (id) => { seen.add(id) },
      upsertMembership: async () => {},
      clearStripeAccount: async (a) => { calls++; if (calls === 1) throw new Error('db down'); cleared.push(a) },
    }
    const e = { id: 'evt_da4', type: 'account.application.deauthorized', account: 'acct_T9', data: { object: { id: 'ca_app' } } } as any
    await expect(handleStripeEvent(e, db)).rejects.toThrow('db down')
    await handleStripeEvent(e, db) // Stripe retry
    expect(cleared).toEqual(['acct_T9'])
    await handleStripeEvent(e, db) // duplicate delivery
    expect(cleared).toHaveLength(1)
  })
  it('a failed upsert is retryable (id not recorded until success)', async () => {
    let calls = 0
    const seen = new Set<string>()
    const upserts: MembershipUpsert[] = []
    const db: WebhookDb = {
      wasProcessed: async (id) => seen.has(id),
      markProcessed: async (id) => { seen.add(id) },
      upsertMembership: async (m) => { calls++; if (calls === 1) throw new Error('db down'); upserts.push(m) },
      clearStripeAccount: async () => {},
    }
    await expect(handleStripeEvent(subEvent('evt_r', 'active'), db)).rejects.toThrow('db down')
    await handleStripeEvent(subEvent('evt_r', 'active'), db) // Stripe retry
    expect(upserts).toHaveLength(1)
    await handleStripeEvent(subEvent('evt_r', 'active'), db) // duplicate delivery
    expect(upserts).toHaveLength(1)
  })
})
