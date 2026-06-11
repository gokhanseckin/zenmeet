import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handleStripeEvent, type WebhookDb } from '@/lib/stripe-webhook'

function supabaseWebhookDb(): WebhookDb {
  const db = supabaseAdmin()
  return {
    async wasProcessed(id) {
      const { data, error } = await db.from('stripe_events').select('id').eq('id', id).maybeSingle()
      if (error) throw new Error(error.message)
      return !!data
    },
    async markProcessed(id) {
      const { error } = await db.from('stripe_events').insert({ id })
      if (error && error.code !== '23505') throw new Error(error.message) // unique violation = already marked
    },
    async upsertMembership(m) {
      const { error } = await db.from('memberships').upsert({
        classroom_id: m.classroomId, student_id: m.studentId,
        stripe_customer_id: m.stripeCustomerId, stripe_subscription_id: m.stripeSubscriptionId,
        status: m.status, current_period_end: m.currentPeriodEnd?.toISOString() ?? null,
      }, { onConflict: 'student_id,classroom_id' })
      if (error) throw new Error(error.message)
    },
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 })
  let event
  try {
    event = stripe().webhooks.constructEvent(body, sig, env().STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'bad signature' }, { status: 400 })
  }
  try {
    await handleStripeEvent(event, supabaseWebhookDb())
  } catch {
    return NextResponse.json({ error: 'handler failed' }, { status: 500 }) // Stripe retries
  }
  return NextResponse.json({ received: true })
}
