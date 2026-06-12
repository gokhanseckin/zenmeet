import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getUser, ensureStudent } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { stripe, onAccount } from '@/lib/stripe'
import { env } from '@/lib/env'
import { shouldGrantTrial } from '@/lib/trial'

type PendingCheckoutSession = {
  student_id: string
  classroom_id: string
  stripe_checkout_session_id: string | null
  url: string | null
  expires_at: string | null
  idempotency_key: string
  created_at?: string
}

const PENDING_CHECKOUT_WAIT_ATTEMPTS = 10
const PENDING_CHECKOUT_WAIT_MS = 100
const UNFINISHED_CHECKOUT_LOCK_TTL_MS = 5 * 60 * 1000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function reusablePending(row: PendingCheckoutSession | null) {
  if (!row?.url || !row.expires_at) return null
  if (new Date(row.expires_at).getTime() <= Date.now()) return null
  return row
}

function unfinishedLockExpired(row: PendingCheckoutSession) {
  if (row.url || row.expires_at) return false
  const createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now()
  return createdAt + UNFINISHED_CHECKOUT_LOCK_TTL_MS <= Date.now()
}

async function pendingCheckout(
  db: ReturnType<typeof supabaseAdmin>,
  studentId: string,
  classroomId: string,
) {
  const { data } = await db.from('pending_checkout_sessions')
    .select('*')
    .eq('student_id', studentId)
    .eq('classroom_id', classroomId)
    .maybeSingle()

  return data as PendingCheckoutSession | null
}

async function claimPendingCheckout(
  db: ReturnType<typeof supabaseAdmin>,
  studentId: string,
  classroomId: string,
) {
  const existing = await pendingCheckout(db, studentId, classroomId)
  const reusable = reusablePending(existing)
  if (reusable) return { claimed: false, row: reusable }

  if (existing && unfinishedLockExpired(existing)) {
    return { claimed: true, row: existing }
  }

  if (existing?.expires_at && new Date(existing.expires_at).getTime() <= Date.now()) {
    await db.from('pending_checkout_sessions')
      .delete()
      .eq('student_id', studentId)
      .eq('classroom_id', classroomId)
  } else if (existing) {
    return { claimed: false, row: existing }
  }

  const row: PendingCheckoutSession = {
    student_id: studentId,
    classroom_id: classroomId,
    stripe_checkout_session_id: null,
    url: null,
    expires_at: null,
    idempotency_key: randomUUID(),
  }
  const { error } = await db.from('pending_checkout_sessions').insert(row)
  if (!error) return { claimed: true, row }

  return { claimed: false, row: await pendingCheckout(db, studentId, classroomId) }
}

async function waitForReusablePendingCheckout(
  db: ReturnType<typeof supabaseAdmin>,
  studentId: string,
  classroomId: string,
) {
  for (let i = 0; i < PENDING_CHECKOUT_WAIT_ATTEMPTS; i++) {
    const reusable = reusablePending(await pendingCheckout(db, studentId, classroomId))
    if (reusable) return reusable
    await sleep(PENDING_CHECKOUT_WAIT_MS)
  }
  return null
}

async function clearPendingCheckout(
  db: ReturnType<typeof supabaseAdmin>,
  studentId: string,
  classroomId: string,
) {
  await db.from('pending_checkout_sessions')
    .delete()
    .eq('student_id', studentId)
    .eq('classroom_id', classroomId)
}

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
  // Teacher may have deauthorized our Stripe Connect access (account.application.deauthorized
  // clears stripe_account_id) while the classroom stays published. Without a connected account
  // we cannot create a Checkout session — return a graceful "unavailable" instead of 500ing on onAccount(null).
  const stripeAccountId = (classroom as { teachers?: { stripe_account_id?: string | null } })
    .teachers?.stripe_account_id ?? null
  if (!stripeAccountId) return NextResponse.json({ error: 'Class not available' }, { status: 404 })

  // Already an active member? Send to member home instead of double-subscribing.
  const { data: existing } = await db.from('memberships').select('status')
    .eq('student_id', user.id).eq('classroom_id', classroom.id).maybeSingle()
  if (existing && existing.status !== 'canceled') return NextResponse.json({ redirect: `/my/${slug}` })
  if (existing?.status === 'canceled') {
    await clearPendingCheckout(db, user.id, classroom.id)
  }

  const pending = await claimPendingCheckout(db, user.id, classroom.id)
  if (!pending.claimed) {
    const reusable = reusablePending(pending.row) ??
      await waitForReusablePendingCheckout(db, user.id, classroom.id)
    if (reusable?.url) return NextResponse.json({ redirect: reusable.url })
    return NextResponse.json({ error: 'Checkout already in progress' }, { status: 409 })
  }
  if (!pending.row) {
    return NextResponse.json({ error: 'Checkout already in progress' }, { status: 409 })
  }

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: classroom.stripe_price_id, quantity: 1 }],
    subscription_data: {
      // trial only on first-ever subscribe — cancel/re-subscribe doesn't restart it
      trial_period_days: shouldGrantTrial(classroom.trial_days, !!existing) ? classroom.trial_days : undefined,
      metadata: { classroom_id: classroom.id, student_id: user.id },
    },
    customer_email: user.email ?? undefined,
    success_url: `${env().APP_URL}/my/${slug}?cs={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env().APP_URL}/${slug}`,
  }, { ...onAccount(stripeAccountId), idempotencyKey: pending.row.idempotency_key })

  await db.from('pending_checkout_sessions')
    .update({
      stripe_checkout_session_id: session.id,
      url: session.url,
      expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', user.id)
    .eq('classroom_id', classroom.id)

  return NextResponse.json({ redirect: session.url })
}
