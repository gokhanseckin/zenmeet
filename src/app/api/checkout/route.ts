import { NextRequest, NextResponse } from 'next/server'
import { getUser, ensureStudent } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe, onAccount } from '@/lib/stripe'
import { env } from '@/lib/env'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { slug } = body as { slug?: string }
  if (!slug || typeof slug !== 'string' || slug.trim() === '') {
    return NextResponse.json({ error: 'slug is required' }, { status: 400 })
  }

  const user = await getUser()
  if (!user) return NextResponse.json({ redirect: `/auth/sign-in?next=${encodeURIComponent(`/${slug}`)}` })
  await ensureStudent(user.id, user.email ?? '')

  const db = supabaseAdmin()
  const { data: classroom } = await db.from('classrooms')
    .select('*, teachers!inner(stripe_account_id)')
    .eq('slug', slug).eq('status', 'published').single()
  if (!classroom?.stripe_price_id) return NextResponse.json({ error: 'Class not available' }, { status: 404 })

  // Already an active member? Send to member home instead of double-subscribing.
  const { data: existing } = await db.from('memberships').select('status')
    .eq('student_id', user.id).eq('classroom_id', classroom.id).single()
  if (existing && existing.status !== 'canceled') return NextResponse.json({ redirect: `/my/${slug}` })

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: classroom.stripe_price_id, quantity: 1 }],
    subscription_data: {
      trial_period_days: classroom.trial_days > 0 ? classroom.trial_days : undefined,
      metadata: { classroom_id: classroom.id, student_id: user.id },
    },
    customer_email: user.email ?? undefined,
    success_url: `${env().APP_URL}/my/${slug}?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env().APP_URL}/${slug}`,
  }, onAccount((classroom as any).teachers.stripe_account_id))

  return NextResponse.json({ redirect: session.url })
}
