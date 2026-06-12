import type Stripe from 'stripe'

export type MembershipUpsert = {
  classroomId: string; studentId: string
  stripeCustomerId: string; stripeSubscriptionId: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  currentPeriodEnd: Date | null
  subscriptionCreated: Date | null
}

export interface WebhookDb {
  /** True if this event id has already been fully processed. */
  wasProcessed(eventId: string): Promise<boolean>
  /** Record successful processing (idempotent). */
  markProcessed(eventId: string): Promise<void>
  upsertMembership(m: MembershipUpsert): Promise<void>
  /** Clear stripe_account_id on any teacher holding this connected account id. */
  clearStripeAccount(accountId: string): Promise<void>
  /** The connected stripe_account_id of the teacher who owns this classroom, or null. */
  classroomOwnerAccount(classroomId: string): Promise<string | null>
  /** The stripe_subscription_id currently stored for (student, classroom), or null if no row. */
  membershipSubscriptionId(classroomId: string, studentId: string): Promise<string | null>
  /**
   * Optional richer authority for ordering different subscriptions for one
   * (student, classroom). Older adapters can omit it and keep the previous
   * subscription-id-only behavior.
   */
  currentMembershipAuthority?(classroomId: string, studentId: string): Promise<{
    stripeSubscriptionId: string | null
    subscriptionCreated: number | null
    status?: string | null
  } | null>
}

// Minimal local type for subscription item with current_period_end,
// since Stripe SDK v22 moved current_period_end to the subscription root but
// the plan's test fixture sets it on the item. We accept either location.
type SubItem = { current_period_end?: number }
type SubWithItems = Stripe.Subscription & { items?: { data: SubItem[] }; created?: number }
type MembershipStatus = MembershipUpsert['status']

/** Map a Stripe subscription status string to our membership status. */
export function subscriptionToStatus(s: string): MembershipStatus {
  if (s === 'trialing') return 'trialing'
  if (s === 'active') return 'active'
  if (s === 'past_due') return 'past_due'
  return 'canceled' // canceled, unpaid, incomplete, incomplete_expired, paused → no access — paused ≠ canceled in Stripe, but no pay = no access is intentional here
}

/**
 * current_period_end as a unix timestamp (seconds), or undefined.
 * Stripe SDK v22 moved current_period_end to the subscription root; older
 * fixtures set it on items.data[0]. We accept either location.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): number | undefined {
  const s = sub as SubWithItems & { current_period_end?: number }
  return s.current_period_end ?? s.items?.data?.[0]?.current_period_end
}

function subscriptionCreated(sub: Stripe.Subscription): number | null {
  const created = (sub as SubWithItems).created
  return typeof created === 'number' ? created : null
}

/**
 * Shared subscription→membership projection used by both the webhook handler
 * and the on-read reconciler, so status/period-end mapping can't drift.
 * `deleted` forces canceled regardless of the subscription's reported status.
 */
export function subscriptionToMembership(
  sub: Stripe.Subscription, opts: { deleted?: boolean } = {},
): {
  status: MembershipStatus
  currentPeriodEnd: Date | null
  stripeCustomerId: string
  subscriptionCreated: Date | null
} {
  const periodEnd = subscriptionPeriodEnd(sub)
  const created = subscriptionCreated(sub)
  return {
    status: opts.deleted ? 'canceled' : subscriptionToStatus(sub.status),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    subscriptionCreated: created ? new Date(created * 1000) : null,
  }
}

const SUB_EVENTS = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
])

export async function handleStripeEvent(event: Stripe.Event, db: WebhookDb): Promise<void> {
  // Teacher revoked our Connect access. Clear their stripe_account_id so checkout/
  // onboarding gates force a reconnect. We deliberately leave existing student
  // memberships intact — deauthorization is often accidental/temporary and cutting
  // off paying students immediately is punitive; clearing the id already blocks new checkouts.
  if (event.type === 'account.application.deauthorized') {
    const accountId = event.account
    if (!accountId) return
    if (await db.wasProcessed(event.id)) return
    await db.clearStripeAccount(accountId)
    await db.markProcessed(event.id)
    return
  }
  if (!SUB_EVENTS.has(event.type)) return
  const sub = event.data.object as SubWithItems
  const { classroom_id, student_id } = (sub.metadata ?? {}) as Record<string, string>
  if (!classroom_id || !student_id) return
  if (await db.wasProcessed(event.id)) return
  // Cross-tenant guard: the connected account that sent this event MUST own the
  // classroom named in the (attacker-controllable) metadata. Otherwise any teacher
  // could mint active memberships in another teacher's classroom by setting metadata
  // on a subscription in their own Connect account. This is a validly-signed event we
  // intentionally ignore, so mark it processed to stop Stripe from retrying.
  const ownerAccount = await db.classroomOwnerAccount(classroom_id)
  if (!event.account || event.account !== ownerAccount) {
    await db.markProcessed(event.id)
    return
  }

  // Out-of-order delivery guard (P2 #8): after a cancel→re-subscribe there are two
  // subscriptions for one (student, classroom). A late-retried `subscription.deleted`
  // for the OLD sub can arrive AFTER the NEW sub's active upsert. If we processed it
  // blindly we'd clobber the active row back to canceled with the stale sub id and lock
  // out a paying student. So: if the deleted event names a different subscription than
  // the one currently stored, it's for a superseded sub — skip the upsert. The event is
  // still valid (we marked it processed), just no longer authoritative for this row.
  const authority = await db.currentMembershipAuthority?.(classroom_id, student_id)
  const storedSubId = authority?.stripeSubscriptionId
    ?? await db.membershipSubscriptionId(classroom_id, student_id)

  if (storedSubId && storedSubId !== sub.id) {
    if (event.type === 'customer.subscription.deleted') {
      await db.markProcessed(event.id)
      return
    }
    const currentCreated = authority?.subscriptionCreated
    const incomingCreated = subscriptionCreated(sub)
    if (currentCreated != null && incomingCreated != null && incomingCreated < currentCreated) {
      await db.markProcessed(event.id)
      return
    }
    if (authority && currentCreated == null && authority.status !== 'canceled') {
      await db.markProcessed(event.id)
      return
    }
  }

  const projection = subscriptionToMembership(sub, {
    deleted: event.type === 'customer.subscription.deleted',
  })
  await db.upsertMembership({
    classroomId: classroom_id,
    studentId: student_id,
    stripeSubscriptionId: sub.id,
    ...projection,
  })
  await db.markProcessed(event.id)
}
