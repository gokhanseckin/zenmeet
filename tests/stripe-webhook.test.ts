import { describe, it, expect, beforeEach } from 'vitest'
import { handleStripeEvent, type WebhookDb, type MembershipUpsert } from '@/lib/stripe-webhook'

function makeDb() {
  const seen = new Set<string>()
  const upserts: MembershipUpsert[] = []
  const db: WebhookDb = {
    async recordEventOnce(id) { if (seen.has(id)) return false; seen.add(id); return true },
    async upsertMembership(m) { upserts.push(m) },
  }
  return { db, upserts }
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
})
