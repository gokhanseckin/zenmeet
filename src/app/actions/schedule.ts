'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { teacherTokenStore } from '@/lib/providers/store'
import { getValidAccessToken } from '@/lib/providers/tokens'
import { zoomProvider, refreshZoom } from '@/lib/providers/zoom'
import { googleProvider, refreshGoogle } from '@/lib/providers/google'
import { materializeOccurrences, type ScheduleRule } from '@/lib/recurrence'
import { MATERIALIZE_DAYS } from '@/lib/cron/tick'

const scheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('one_off'), classroomId: z.string().uuid(),
    startsAt: z.iso.datetime(), durationMinutes: z.coerce.number().int().min(5).max(480) }),
  z.object({ kind: z.literal('weekly'), classroomId: z.string().uuid(),
    weekday: z.coerce.number().int().min(0).max(6), localTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMinutes: z.coerce.number().int().min(5).max(480), until: z.iso.date().nullable().default(null) }),
])

async function assertOwnsClassroom(userId: string, classroomId: string) {
  const { data } = await supabaseAdmin().from('classrooms').select('id, slug').eq('id', classroomId).eq('teacher_id', userId).single()
  return data
}

type SupabaseAdmin = ReturnType<typeof supabaseAdmin>

/**
 * Materialize and insert session rows for a freshly-created schedule, using the
 * same recurrence helper and ignore-dupes upsert (unique schedule_id,starts_at)
 * the cron uses, so synchronous creation and later cron ticks never double-insert.
 */
async function materializeScheduleSessions(
  db: SupabaseAdmin,
  scheduleId: string,
  data: z.infer<typeof scheduleSchema>,
) {
  let rule: ScheduleRule
  if (data.kind === 'one_off') {
    rule = { kind: 'one_off', startsAt: data.startsAt, durationMinutes: data.durationMinutes }
  } else {
    // Weekly rules need the teacher's timezone (same source the cron reads).
    const { data: cls, error } = await db.from('classrooms')
      .select('teachers!inner(timezone)').eq('id', data.classroomId).single()
    if (error || !cls) throw new Error(error?.message ?? 'classroom timezone not found')
    rule = {
      kind: 'weekly', weekday: data.weekday, localTime: data.localTime,
      durationMinutes: data.durationMinutes, timezone: (cls as any).teachers.timezone, until: data.until,
    }
  }

  const occ = materializeOccurrences(rule, new Date(), MATERIALIZE_DAYS)
  if (!occ.length) return
  const { error } = await db.from('sessions').upsert(
    occ.map(o => ({
      schedule_id: scheduleId,
      classroom_id: data.classroomId,
      starts_at: o.startsAt.toISOString(),
      ends_at: o.endsAt.toISOString(),
    })),
    { onConflict: 'schedule_id,starts_at', ignoreDuplicates: true },
  )
  if (error) throw new Error(error.message)
}

export async function createSchedule(input: z.infer<typeof scheduleSchema>) {
  const user = await requireUser('/dashboard')
  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const data = parsed.data
  const classroom = await assertOwnsClassroom(user.id, data.classroomId)
  if (!classroom) return { error: 'Not found' }
  const db = supabaseAdmin()
  const { data: created, error } = data.kind === 'one_off'
    ? await db.from('class_schedules').insert({ classroom_id: data.classroomId, kind: 'one_off', starts_at: data.startsAt, duration_minutes: data.durationMinutes }).select('id').single()
    : await db.from('class_schedules').insert({ classroom_id: data.classroomId, kind: 'weekly', weekday: data.weekday, local_time: data.localTime, duration_minutes: data.durationMinutes, until: data.until }).select('id').single()
  if (error || !created) return { error: error?.message ?? 'Failed to create schedule' }

  // Materialize occurrences synchronously so an ad-hoc class starting within one
  // cron period (10 min) gets a session row immediately. The 10-min pg_cron tick
  // windows forward from `now`, so a near-term occurrence can fall behind the
  // window before any tick lands and would never be materialized otherwise.
  // We follow the cron's exact ignore-dupes path (unique schedule_id,starts_at):
  // a later tick re-inserting the same occurrences is a no-op, keeping this
  // idempotent with the cron and never double-inserting.
  try {
    await materializeScheduleSessions(db, created.id, data)
  } catch (e) {
    // Non-fatal: the schedule rule is persisted; the next cron tick will
    // materialize sessions whose start is still ahead of its window.
    console.error('[schedule] synchronous materialization failed', created.id, e)
  }

  revalidatePath('/dashboard/schedule')
  return { ok: true }
}

export async function cancelSession(sessionId: string) {
  const user = await requireUser('/dashboard')
  const db = supabaseAdmin()
  const { data: sessionRow } = await db.from('sessions')
    .select('id, classroom_id, provider_meeting_id, classrooms!inner(teacher_id, provider)')
    .eq('id', sessionId).single()
  if (!sessionRow || (sessionRow as any).classrooms.teacher_id !== user.id) return { error: 'Not found' }
  const { error } = await db.from('sessions').update({ status: 'canceled' }).eq('id', sessionId).eq('status', 'scheduled')
  if (error) return { error: error.message }
  // Best-effort: delete the provider meeting so it doesn't linger
  if ((sessionRow as any).provider_meeting_id) {
    try {
      const provider = (sessionRow as any).classrooms.provider as string
      const teacherId = (sessionRow as any).classrooms.teacher_id as string
      const providerName = provider === 'zoom' ? 'zoom' : 'google'
      const store = teacherTokenStore(teacherId, providerName)
      const refresh = provider === 'zoom' ? refreshZoom : refreshGoogle
      const impl = provider === 'zoom' ? zoomProvider : googleProvider
      const accessToken = await getValidAccessToken(store, refresh)
      await impl.deleteMeeting({ accessToken, providerMeetingId: (sessionRow as any).provider_meeting_id })
    } catch (e) {
      console.error('[cancel] best-effort provider meeting delete failed', sessionId, e)
    }
  }
  revalidatePath('/dashboard/schedule')
  return { ok: true }
}

/** Stops a weekly schedule: ends future materialization and cancels its upcoming sessions. */
export async function stopSchedule(scheduleId: string) {
  const user = await requireUser('/dashboard')
  const db = supabaseAdmin()
  const { data: schedule } = await db.from('class_schedules')
    .select('id, kind, classroom_id, classrooms!inner(teacher_id)').eq('id', scheduleId).single()
  if (!schedule || (schedule as any).classrooms.teacher_id !== user.id) return { error: 'Not found' }
  // End materialization: until = yesterday (UTC date — materializer compares teacher-local dates, worst case one extra day which we cancel below)
  const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10)
  const { error } = await db.from('class_schedules').update({ until: yesterday }).eq('id', scheduleId)
  if (error) return { error: error.message }
  // Cancel its future scheduled sessions (provider-meeting cleanup skipped — bulk cancel; meetings expire unused)
  const { error: cancelError } = await db.from('sessions').update({ status: 'canceled' })
    .eq('schedule_id', scheduleId).eq('status', 'scheduled').gt('starts_at', new Date().toISOString())
  if (cancelError) return { error: cancelError.message }
  revalidatePath('/dashboard/schedule')
  return { ok: true }
}

/** Manual escape hatch when auto-provisioning fails. */
export async function setSessionLink(sessionId: string, joinUrl: string) {
  const user = await requireUser('/dashboard')
  const parsed = z.string().url().safeParse(joinUrl)
  if (!parsed.success) return { error: 'Enter a valid URL' }
  const db = supabaseAdmin()
  const { data: session } = await db.from('sessions').select('id, classrooms!inner(teacher_id)').eq('id', sessionId).single()
  if (!session || (session as any).classrooms.teacher_id !== user.id) return { error: 'Not found' }
  const { error } = await db.from('sessions').update({ join_url: parsed.data }).eq('id', sessionId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard/schedule')
  return { ok: true }
}
