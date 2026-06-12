import type Stripe from 'stripe'

export type MembershipUpsert = {
  classroomId: string; studentId: string
  stripeCustomerId: string; stripeSubscriptionId: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  currentPeriodEnd: Date | null
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
}

function mapStatus(s: string): MembershipUpsert['status'] {
  if (s === 'trialing') return 'trialing'
  if (s === 'active') return 'active'
  if (s === 'past_due') return 'past_due'
  return 'canceled' // canceled, unpaid, incomplete, incomplete_expired, paused → no access — paused ≠ canceled in Stripe, but no pay = no access is intentional here
}

const SUB_EVENTS = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
])

// Minimal local type for subscription item with current_period_end,
// since Stripe SDK v22 moved current_period_end to the subscription root but
// the plan's test fixture sets it on the item. We accept either location.
type SubItem = { current_period_end?: number }

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
  const sub = event.data.object as Stripe.Subscription & { items?: { data: SubItem[] } }
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
  const periodEnd: number | undefined =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end
  // No timestamp ordering guard: out-of-order deliveries can overwrite (rare; revisit with event.created if it bites)
  await db.upsertMembership({
    classroomId: classroom_id,
    studentId: student_id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    status: event.type === 'customer.subscription.deleted' ? 'canceled' : mapStatus(sub.status),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  })
  await db.markProcessed(event.id)
}
