import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
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
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const db = supabaseAdmin()
  const { data: classroom } = await db.from('classrooms')
    .select('id, teachers!inner(stripe_account_id)').eq('slug', slug).single()
  if (!classroom) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data: membership } = await db.from('memberships').select('stripe_customer_id')
    .eq('student_id', user.id).eq('classroom_id', classroom.id).single()
  if (!membership?.stripe_customer_id) return NextResponse.json({ error: 'no membership' }, { status: 404 })
  const portal = await stripe().billingPortal.sessions.create({
    customer: membership.stripe_customer_id,
    return_url: `${env().APP_URL}/my/${slug}`,
  }, onAccount((classroom as any).teachers.stripe_account_id))
  return NextResponse.json({ redirect: portal.url })
}
