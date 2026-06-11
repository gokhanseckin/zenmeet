import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { handleStripeEvent, type WebhookDb } from '@/lib/stripe-webhook'

function supabaseWebhookDb(): WebhookDb {
  const db = supabaseAdmin()
  return {
    async recordEventOnce(id) {
      const { error } = await db.from('stripe_events').insert({ id })
      return !error // unique violation → already processed
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
