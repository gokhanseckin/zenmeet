import { redirect } from 'next/navigation'
import { requireUser, ensureTeacher } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  AccountStep,
  ClassroomStep,
  StripeStep,
  ProviderStep,
  ScheduleStep,
  DoneStep,
} from './steps'

const ORDER = ['account', 'classroom', 'stripe', 'provider', 'schedule', 'done'] as const
export type Step = typeof ORDER[number]

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string; need?: string }>
}) {
  const { step: qs, error, need } = await searchParams
  const user = await requireUser('/onboarding')
  const teacher = await ensureTeacher(user.id)
  const db = supabaseAdmin()
  const { data: classroom } = await db
    .from('classrooms')
    .select('*')
    .eq('teacher_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle()
  const { count: scheduleCount } = classroom
    ? await db
        .from('class_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('classroom_id', classroom.id)
    : { count: 0 }

  const step = (ORDER.includes(qs as Step) ? qs : teacher.onboarding_step) as Step
  if (teacher.onboarding_step === 'done' && !qs) redirect('/dashboard')

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <ol className="mb-8 flex gap-2 font-mono text-xs uppercase tracking-widest text-neutral-400">
        {ORDER.slice(0, 5).map((s, i) => (
          <li key={s} className={s === step ? 'text-orange-800 font-bold' : ''}>
            {i + 1}&middot;{s}
          </li>
        ))}
      </ol>
      {error && error !== 'missing' && (
        <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800">
          That didn&apos;t work &mdash; check the fields and try again.
        </p>
      )}
      {step === 'account' && <AccountStep teacher={teacher} />}
      {step === 'classroom' && <ClassroomStep classroom={classroom} />}
      {step === 'stripe' && <StripeStep connected={!!teacher.stripe_account_id} />}
      {step === 'provider' && (
        <ProviderStep teacher={teacher} provider={classroom?.provider ?? 'meet'} />
      )}
      {step === 'schedule' && (
        <ScheduleStep classroom={classroom} scheduleCount={scheduleCount ?? 0} error={error} need={need} />
      )}
      {step === 'done' && <DoneStep slug={classroom?.slug} />}
    </main>
  )
}
