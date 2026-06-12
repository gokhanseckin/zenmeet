import { describe, it, expect, beforeEach } from 'vitest'
import {
  handleStripeEvent, subscriptionToStatus, subscriptionPeriodEnd, subscriptionToMembership,
  type WebhookDb, type MembershipUpsert,
} from '@/lib/stripe-webhook'

function makeDb(
  owners: Record<string, string | null> = { 'cls-1': 'acct_T1' },
  storedSubs: Record<string, string | null> = {},
  authorities: Record<string, {
    stripeSubscriptionId: string
    subscriptionCreated: number | null
    status?: string | null
  }> = {},
) {
  const seen = new Set<string>()
  const upserts: MembershipUpsert[] = []
  const cleared: string[] = []
  const db: WebhookDb = {
    async wasProcessed(id) { return seen.has(id) },
    async markProcessed(id) { seen.add(id) },
    async upsertMembership(m) { upserts.push(m) },
    async clearStripeAccount(accountId) { cleared.push(accountId) },
    async classroomOwnerAccount(classroomId) { return owners[classroomId] ?? null },
    async membershipSubscriptionId(classroomId, studentId) {
      return storedSubs[`${classroomId}/${studentId}`] ?? null
    },
    async currentMembershipAuthority(classroomId, studentId) {
      return authorities[`${classroomId}/${studentId}`] ?? null
    },
  }
  return { db, upserts, cleared, seen }
}

const subEvent = (
  id: string, status: string, type = 'customer.subscription.updated', subId = 'sub_1', created = 1781481600,
) => ({
  id, type, account: 'acct_T1',
  data: { object: {
    id: subId, customer: 'cus_1', status, created,
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
      subscriptionCreated: new Date('2026-06-15T00:00:00.000Z'),
    }])
  })
  it('maps subscription.deleted to canceled', async () => {
    await handleStripeEvent(subEvent('evt_2', 'canceled', 'customer.subscription.deleted'), ctx.db)
    expect(ctx.upserts[0].status).toBe('canceled')
  })
  it('deleted event for the SAME stored sub still cancels (no superseding sub)', async () => {
    // stored sub matches the event's sub → legitimate cancel, must write canceled.
    const c = makeDb({ 'cls-1': 'acct_T1' }, { 'cls-1/stu-1': 'sub_1' })
    await handleStripeEvent(
      subEvent('evt_del_same', 'canceled', 'customer.subscription.deleted', 'sub_1'), c.db)
    expect(c.upserts).toHaveLength(1)
    expect(c.upserts[0].status).toBe('canceled')
  })
  it('out-of-order: deleted event for an OLD superseded sub does NOT clobber the active new membership', async () => {
    // After cancel→re-subscribe the stored row points at sub_NEW (active). A late-retried
    // deleted event for sub_OLD arrives — it must be skipped, not overwrite the row.
    const c = makeDb({ 'cls-1': 'acct_T1' }, { 'cls-1/stu-1': 'sub_NEW' })
    await handleStripeEvent(
      subEvent('evt_del_old', 'canceled', 'customer.subscription.deleted', 'sub_OLD'), c.db)
    expect(c.upserts).toHaveLength(0) // active membership untouched
    expect(c.seen.has('evt_del_old')).toBe(true) // marked processed; Stripe stops retrying
  })
  it('deleted event with no stored membership yet still upserts canceled', async () => {
    // No stored sub id → nothing to supersede → process normally.
    const c = makeDb({ 'cls-1': 'acct_T1' }, {})
    await handleStripeEvent(
      subEvent('evt_del_none', 'canceled', 'customer.subscription.deleted', 'sub_1'), c.db)
    expect(c.upserts).toHaveLength(1)
    expect(c.upserts[0].status).toBe('canceled')
  })
  it('newer non-deleted updated event for a different sub still upserts', async () => {
    const c = makeDb(
      { 'cls-1': 'acct_T1' },
      { 'cls-1/stu-1': 'sub_OLD' },
      { 'cls-1/stu-1': { stripeSubscriptionId: 'sub_OLD', subscriptionCreated: 1781395200 } },
    )
    await handleStripeEvent(
      subEvent('evt_upd_new', 'active', 'customer.subscription.updated', 'sub_NEW', 1781481600), c.db)
    expect(c.upserts).toHaveLength(1)
    expect(c.upserts[0].stripeSubscriptionId).toBe('sub_NEW')
    expect(c.upserts[0].status).toBe('active')
  })
  it('out-of-order: old updated event for a superseded sub does NOT clobber the active newer membership', async () => {
    const c = makeDb(
      { 'cls-1': 'acct_T1' },
      { 'cls-1/stu-1': 'sub_NEW' },
      { 'cls-1/stu-1': { stripeSubscriptionId: 'sub_NEW', subscriptionCreated: 1781481600 } },
    )
    await handleStripeEvent(
      subEvent('evt_upd_old', 'active', 'customer.subscription.updated', 'sub_OLD', 1781395200), c.db)
    expect(c.upserts).toHaveLength(0)
    expect(c.seen.has('evt_upd_old')).toBe(true)
  })
  it('out-of-order: old created event for a superseded sub does NOT clobber the active newer membership', async () => {
    const c = makeDb(
      { 'cls-1': 'acct_T1' },
      { 'cls-1/stu-1': 'sub_NEW' },
      { 'cls-1/stu-1': { stripeSubscriptionId: 'sub_NEW', subscriptionCreated: 1781481600 } },
    )
    await handleStripeEvent(
      subEvent('evt_created_old', 'trialing', 'customer.subscription.created', 'sub_OLD', 1781395200), c.db)
    expect(c.upserts).toHaveLength(0)
    expect(c.seen.has('evt_created_old')).toBe(true)
  })
  it('legacy authority: different-sub updated event without stored creation time does not clobber active row', async () => {
    const c = makeDb(
      { 'cls-1': 'acct_T1' },
      { 'cls-1/stu-1': 'sub_NEW' },
      { 'cls-1/stu-1': { stripeSubscriptionId: 'sub_NEW', subscriptionCreated: null, status: 'active' } },
    )
    await handleStripeEvent(
      subEvent('evt_legacy_old', 'active', 'customer.subscription.updated', 'sub_OLD', 1781395200), c.db)
    expect(c.upserts).toHaveLength(0)
    expect(c.seen.has('evt_legacy_old')).toBe(true)
  })
  it('legacy authority: different-sub created event can revive a canceled row', async () => {
    const c = makeDb(
      { 'cls-1': 'acct_T1' },
      { 'cls-1/stu-1': 'sub_OLD' },
      { 'cls-1/stu-1': { stripeSubscriptionId: 'sub_OLD', subscriptionCreated: null, status: 'canceled' } },
    )
    await handleStripeEvent(
      subEvent('evt_legacy_new', 'active', 'customer.subscription.created', 'sub_NEW', 1781481600), c.db)
    expect(c.upserts).toHaveLength(1)
    expect(c.upserts[0].stripeSubscriptionId).toBe('sub_NEW')
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
  it('upserts when the event account owns the classroom in metadata', async () => {
    // subEvent uses account 'acct_T1'; default owner of 'cls-1' is 'acct_T1'
    await handleStripeEvent(subEvent('evt_own', 'active'), ctx.db)
    expect(ctx.upserts).toHaveLength(1)
    expect(ctx.upserts[0].classroomId).toBe('cls-1')
  })
  it('refuses to upsert when the event account does not own the classroom (cross-tenant attack)', async () => {
    // Attacker sends a validly-signed sub event from their own connected account
    // (acct_ATTACKER) with metadata pointing at a victim classroom owned by acct_T1.
    const attacker = makeDb({ 'cls-1': 'acct_T1' })
    const e = subEvent('evt_attack', 'active')
    e.account = 'acct_ATTACKER'
    await handleStripeEvent(e, attacker.db)
    expect(attacker.upserts).toHaveLength(0)
    // Marked processed so Stripe stops retrying the intentionally-ignored event.
    expect(attacker.seen.has('evt_attack')).toBe(true)
  })
  it('refuses to upsert when the event has no account', async () => {
    const e = subEvent('evt_noacct', 'active')
    delete e.account
    await handleStripeEvent(e, ctx.db)
    expect(ctx.upserts).toHaveLength(0)
    expect(ctx.seen.has('evt_noacct')).toBe(true)
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
      classroomOwnerAccount: async () => null,
      membershipSubscriptionId: async () => null,
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
      classroomOwnerAccount: async () => 'acct_T1',
      membershipSubscriptionId: async () => null,
    }
    await expect(handleStripeEvent(subEvent('evt_r', 'active'), db)).rejects.toThrow('db down')
    await handleStripeEvent(subEvent('evt_r', 'active'), db) // Stripe retry
    expect(upserts).toHaveLength(1)
    await handleStripeEvent(subEvent('evt_r', 'active'), db) // duplicate delivery
    expect(upserts).toHaveLength(1)
  })
})

describe('shared subscription→membership projection', () => {
  const mkSub = (status: string, extra: Record<string, unknown> = {}): any => ({
    id: 'sub_x', customer: 'cus_x', status,
    metadata: { student_id: 'stu-1', classroom_id: 'cls-1' }, ...extra,
  })

  it('subscriptionToStatus maps active/trialing/past_due verbatim, everything else to canceled', () => {
    expect(subscriptionToStatus('active')).toBe('active')
    expect(subscriptionToStatus('trialing')).toBe('trialing')
    expect(subscriptionToStatus('past_due')).toBe('past_due')
    for (const s of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused']) {
      expect(subscriptionToStatus(s)).toBe('canceled')
    }
  })

  it('subscriptionPeriodEnd reads the subscription root, falling back to items.data[0]', () => {
    expect(subscriptionPeriodEnd(mkSub('active', { current_period_end: 111 }))).toBe(111)
    expect(subscriptionPeriodEnd(mkSub('active', { items: { data: [{ current_period_end: 222 }] } }))).toBe(222)
    expect(subscriptionPeriodEnd(mkSub('active'))).toBeUndefined()
  })

  it('subscriptionToMembership forces canceled when deleted, regardless of reported status', () => {
    const active = subscriptionToMembership(mkSub('active', { current_period_end: 1781568000 }))
    expect(active.status).toBe('active')
    expect(active.stripeCustomerId).toBe('cus_x')
    expect(active.currentPeriodEnd).toEqual(new Date('2026-06-16T00:00:00.000Z'))
    expect(active.subscriptionCreated).toBeNull()

    const deleted = subscriptionToMembership(mkSub('active'), { deleted: true })
    expect(deleted.status).toBe('canceled')
  })

  it('parity: the projection drives the same output the webhook upsert writes', async () => {
    // The handler path and the direct projection must agree for the same subscription.
    const { db, upserts } = makeDb()
    await handleStripeEvent(subEvent('evt_parity', 'active'), db)
    const direct = subscriptionToMembership(
      subEvent('evt_parity', 'active').data.object as any)
    expect(upserts[0].status).toBe(direct.status)
    expect(upserts[0].currentPeriodEnd).toEqual(direct.currentPeriodEnd)
    expect(upserts[0].stripeCustomerId).toBe(direct.stripeCustomerId)
  })
})
