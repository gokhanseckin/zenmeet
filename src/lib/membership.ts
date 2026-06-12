import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe, onAccount } from '@/lib/stripe'
import { subscriptionToMembership } from '@/lib/stripe-webhook'
import { hasMembershipAccess } from '@/lib/unlock'

/**
 * Injected dependencies. Defaults are the real Stripe + Supabase clients;
 * tests pass fakes. The shape mirrors how the call site uses each client, so
 * fakes only need to implement the handful of methods exercised below.
 */
export type MembershipDeps = {
  db: () => ReturnType<typeof supabaseAdmin>
  stripe: () => ReturnType<typeof stripe>
  onAccount: typeof onAccount
}

const defaultDeps: MembershipDeps = { db: supabaseAdmin, stripe, onAccount }
const ACTIVE_RECONCILE_STATUSES = new Set(['active', 'trialing', 'past_due'])

/**
 * Returns the membership for (student, classroom), reconciling with Stripe when:
 * (a) checkoutSessionId is present (just returned from Checkout, webhook may not have landed), or
 * (b) the stored status looks active but current_period_end has passed.
 */
export async function getFreshMembership(args: {
  studentId: string; classroomId: string; stripeAccountId: string; checkoutSessionId?: string
}, deps: MembershipDeps = defaultDeps) {
  const db = deps.db()
  const { data: existing } = await db.from('memberships').select('*')
    .eq('student_id', args.studentId).eq('classroom_id', args.classroomId).maybeSingle()

  const now = new Date()
  const localHasAccess = existing ? hasMembershipAccess({
    status: existing.status,
    currentPeriodEnd: existing.current_period_end,
    now,
  }) : false
  const stalePayingStatus = existing && ACTIVE_RECONCILE_STATUSES.has(existing.status) && !localHasAccess
  const needsReconcile = ((!existing || existing.status === 'canceled' || stalePayingStatus) && !!args.checkoutSessionId)
    || !!stalePayingStatus

  // Resolve the subscription to reconcile against. When we have a checkout session
  // (student just returned from Checkout), the session is authoritative — on a
  // cancel→re-subscribe flow existing.stripe_subscription_id is the OLD (canceled)
  // sub, so trusting it would lock the just-paid student out until the webhook lands.
  // Consult the checkout session FIRST; fall back to the stored sub only when there's
  // no session or it carries no subscription yet.
  let subId: string | null = null
  if (args.checkoutSessionId) {
    const cs = await deps.stripe().checkout.sessions.retrieve(
      args.checkoutSessionId, {}, deps.onAccount(args.stripeAccountId))
    subId = typeof cs.subscription === 'string' ? cs.subscription : cs.subscription?.id ?? null
  }
  if (!subId) subId = (existing?.stripe_subscription_id as string | null) ?? null

  if (!needsReconcile && existing) return existing
  if (!subId) return existing ?? null

  const sub = await deps.stripe().subscriptions.retrieve(subId, {}, deps.onAccount(args.stripeAccountId))
  const meta = (sub.metadata ?? {}) as Record<string, string>
  if (meta.student_id !== args.studentId || meta.classroom_id !== args.classroomId) {
    return existing ?? null // cs/subscription belongs to someone else — do not mint a membership
  }
  // Shared projection with the webhook handler so status/period-end mapping can't drift.
  const { status, currentPeriodEnd, stripeCustomerId, subscriptionCreated } = subscriptionToMembership(sub)

  const { data } = await db.from('memberships').upsert({
    student_id: args.studentId, classroom_id: args.classroomId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: sub.id, status,
    current_period_end: currentPeriodEnd ? currentPeriodEnd.toISOString() : null,
    stripe_subscription_created_at: subscriptionCreated ? subscriptionCreated.toISOString() : null,
  }, { onConflict: 'student_id,classroom_id' }).select().single()
  return data
}
