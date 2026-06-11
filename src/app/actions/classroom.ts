'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser, ensureTeacher } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { validateSlug, slugify } from '@/lib/slugs'
import { canPublish } from '@/lib/publish'
import { stripe, onAccount } from '@/lib/stripe'

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(120),
  slug: z.string().optional(),
  description: z.string().max(2000).default(''),
  provider: z.enum(['zoom', 'meet']),
  priceAmount: z.coerce.number().int().positive().optional(), // minor units
  currency: z.string().length(3).default('usd'),
  trialDays: z.coerce.number().int().min(0).max(90).default(7),
})

export async function upsertClassroom(input: z.infer<typeof upsertSchema>) {
  const user = await requireUser('/onboarding')
  await ensureTeacher(user.id)
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const data = parsed.data
  const slug = data.slug?.trim() || slugify(data.title)
  const slugError = validateSlug(slug)
  if (slugError) return { error: slugError }

  const db = supabaseAdmin()
  const row: Record<string, unknown> = {
    teacher_id: user.id, title: data.title, slug, description: data.description,
    provider: data.provider, price_amount: data.priceAmount ?? null,
    currency: data.currency, trial_days: data.trialDays,
  }

  if (data.id) {
    // If the price/currency changed on a classroom that already has a live Stripe price,
    // mint a replacement price on the connected account and deactivate the old one,
    // so existing checkout links never charge a stale amount.
    const { data: existing } = await db.from('classrooms')
      .select('id, price_amount, currency, stripe_product_id, stripe_price_id, status')
      .eq('id', data.id).eq('teacher_id', user.id).single()
    if (!existing) return { error: 'Not found' }
    const priceChanged = data.priceAmount != null &&
      (data.priceAmount !== existing.price_amount || data.currency !== existing.currency)
    if (existing.stripe_price_id && priceChanged) {
      const { data: teacher } = await db.from('teachers').select('stripe_account_id').eq('id', user.id).single()
      const acct = onAccount(teacher!.stripe_account_id!)
      const s = stripe()
      const newPrice = await s.prices.create(
        { product: existing.stripe_product_id!, currency: data.currency, unit_amount: data.priceAmount!, recurring: { interval: 'month' } },
        { ...acct, idempotencyKey: `price_${existing.id}_${data.priceAmount}_${data.currency}` },
      )
      await s.prices.update(existing.stripe_price_id, { active: false }, acct)
      row.stripe_price_id = newPrice.id
    }
  }

  const query = data.id
    ? db.from('classrooms').update(row).eq('id', data.id).eq('teacher_id', user.id).select().single()
    : db.from('classrooms').insert(row).select().single()
  const { data: classroom, error } = await query
  if (error) return { error: error.code === '23505' ? 'That URL is taken — pick another slug.' : error.message }
  revalidatePath('/dashboard')
  return { classroom }
}

export async function publishClassroom(classroomId: string) {
  const user = await requireUser('/dashboard')
  const db = supabaseAdmin()
  const { data: classroom } = await db.from('classrooms').select('*').eq('id', classroomId).eq('teacher_id', user.id).single()
  const { data: teacher } = await db.from('teachers').select('*').eq('id', user.id).single()
  const { count } = await db.from('class_schedules').select('*', { count: 'exact', head: true }).eq('classroom_id', classroomId)
  if (!classroom || !teacher) return { error: 'Not found' }

  const check = canPublish({ teacher, classroom, scheduleCount: count ?? 0 })
  if (!check.ok) return { error: `Missing before publish: ${check.missing.join(', ')}`, missing: check.missing }

  // Create Stripe product + price on the TEACHER's connected account (idempotent-ish: reuse if set).
  const s = stripe()
  const acct = onAccount(teacher.stripe_account_id!)
  let productId = classroom.stripe_product_id
  if (!productId) {
    const product = await s.products.create(
      { name: classroom.title, metadata: { classroom_id: classroom.id } },
      { ...acct, idempotencyKey: `product_${classroom.id}` },
    )
    productId = product.id
    // Persist immediately so a failure creating the price doesn't orphan the product.
    await db.from('classrooms').update({ stripe_product_id: productId }).eq('id', classroom.id)
  }
  let priceId = classroom.stripe_price_id
  if (!priceId) {
    const price = await s.prices.create(
      {
        product: productId, currency: classroom.currency,
        unit_amount: classroom.price_amount!, recurring: { interval: 'month' },
      },
      { ...acct, idempotencyKey: `price_${classroom.id}_${classroom.price_amount}_${classroom.currency}` },
    )
    priceId = price.id
  }
  const { error } = await db.from('classrooms')
    .update({ stripe_product_id: productId, stripe_price_id: priceId, status: 'published' })
    .eq('id', classroom.id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard'); revalidatePath(`/${classroom.slug}`)
  return { ok: true }
}
