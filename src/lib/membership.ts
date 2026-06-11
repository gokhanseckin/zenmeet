import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe, onAccount } from '@/lib/stripe'

/**
 * Returns the membership for (student, classroom), reconciling with Stripe when:
 * (a) checkoutSessionId is present (just returned from Checkout, webhook may not have landed), or
 * (b) the stored status looks active but current_period_end has passed.
 */
export async function getFreshMembership(args: {
  studentId: string; classroomId: string; stripeAccountId: string; checkoutSessionId?: string
}) {
  const db = supabaseAdmin()
  const { data: existing } = await db.from('memberships').select('*')
    .eq('student_id', args.studentId).eq('classroom_id', args.classroomId).maybeSingle()

  const stale = existing && ['active', 'trialing'].includes(existing.status)
    && existing.current_period_end && new Date(existing.current_period_end) < new Date()
  const needsReconcile = ((!existing || existing.status === 'canceled' || stale) && !!args.checkoutSessionId)
    || !!stale

  let subId = existing?.stripe_subscription_id as string | null
  if (args.checkoutSessionId && !subId) {
    const cs = await stripe().checkout.sessions.retrieve(args.checkoutSessionId, {}, onAccount(args.stripeAccountId))
    subId = typeof cs.subscription === 'string' ? cs.subscription : cs.subscription?.id ?? null
  }
  if (!needsReconcile && existing) return existing
  if (!subId) return existing ?? null

  const sub = await stripe().subscriptions.retrieve(subId, {}, onAccount(args.stripeAccountId))
  const status = sub.status === 'trialing' ? 'trialing' : sub.status === 'active' ? 'active'
    : sub.status === 'past_due' ? 'past_due' : 'canceled'

  // Stripe SDK v22 moved current_period_end to subscription root; fall back to items.data[0] for older fixtures.
  const periodEnd: number | undefined =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end

  const { data } = await db.from('memberships').upsert({
    student_id: args.studentId, classroom_id: args.classroomId,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id, status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
  }, { onConflict: 'student_id,classroom_id' }).select().single()
  return data
}
