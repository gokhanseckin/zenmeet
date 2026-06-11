'use server'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { requireUser, ensureTeacher } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

// Keep in sync with ORDER in src/app/onboarding/page.tsx.
// (Not exported: 'use server' modules may only export async functions.)
const STEPS = ['account', 'classroom', 'stripe', 'provider', 'schedule', 'done'] as const

const accountSchema = z.object({
  displayName: z.string().min(1).max(80),
  timezone: z.string().min(1),
})

export async function saveTeacherAccount(formData: FormData) {
  const user = await requireUser('/onboarding')
  await ensureTeacher(user.id)
  const parsed = accountSchema.safeParse({
    displayName: formData.get('displayName'),
    timezone: formData.get('timezone'),
  })
  if (!parsed.success) redirect('/onboarding?step=account&error=1')
  if (!Intl.supportedValuesOf('timeZone').includes(parsed.data.timezone)) {
    redirect('/onboarding?step=account&error=1')
  }
  const { error } = await supabaseAdmin()
    .from('teachers')
    .update({
      display_name: parsed.data.displayName,
      timezone: parsed.data.timezone,
      onboarding_step: 'classroom',
    })
    .eq('id', user.id)
  if (error) redirect('/onboarding?step=account&error=1')
  redirect('/onboarding?step=classroom')
}

export async function setOnboardingStep(step: string) {
  const user = await requireUser('/onboarding')
  await ensureTeacher(user.id)
  if (!(STEPS as readonly string[]).includes(step)) return
  await supabaseAdmin().from('teachers').update({ onboarding_step: step }).eq('id', user.id)
}
