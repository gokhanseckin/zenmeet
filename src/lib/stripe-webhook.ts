import type Stripe from 'stripe'

export type MembershipUpsert = {
  classroomId: string; studentId: string
  stripeCustomerId: string; stripeSubscriptionId: string
  status: 'trialing' | 'active' | 'past_due' | 'canceled'
  currentPeriodEnd: Date | null
}

export interface WebhookDb {
  /** Returns false if this event id was already processed. */
  recordEventOnce(eventId: string): Promise<boolean>
  upsertMembership(m: MembershipUpsert): Promise<void>
}

function mapStatus(s: string): MembershipUpsert['status'] {
  if (s === 'trialing') return 'trialing'
  if (s === 'active') return 'active'
  if (s === 'past_due') return 'past_due'
  return 'canceled' // canceled, unpaid, incomplete, incomplete_expired, paused → no access
}

const SUB_EVENTS = new Set([
  'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
])

// Minimal local type for subscription item with current_period_end,
// since Stripe SDK v22 moved current_period_end to the subscription root but
// the plan's test fixture sets it on the item. We accept either location.
type SubItem = { current_period_end?: number }

export async function handleStripeEvent(event: Stripe.Event, db: WebhookDb): Promise<void> {
  if (!(await db.recordEventOnce(event.id))) return
  if (!SUB_EVENTS.has(event.type)) return
  const sub = event.data.object as Stripe.Subscription & { items?: { data: SubItem[] } }
  const { classroom_id, student_id } = (sub.metadata ?? {}) as Record<string, string>
  if (!classroom_id || !student_id) return
  const periodEnd: number | undefined =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items?.data?.[0]?.current_period_end
  await db.upsertMembership({
    classroomId: classroom_id,
    studentId: student_id,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripeSubscriptionId: sub.id,
    status: event.type === 'customer.subscription.deleted' ? 'canceled' : mapStatus(sub.status),
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
  })
}
