'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

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

export async function createSchedule(input: z.infer<typeof scheduleSchema>) {
  const user = await requireUser('/dashboard')
  const parsed = scheduleSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  const data = parsed.data
  const classroom = await assertOwnsClassroom(user.id, data.classroomId)
  if (!classroom) return { error: 'Not found' }
  const db = supabaseAdmin()
  const { error } = data.kind === 'one_off'
    ? await db.from('class_schedules').insert({ classroom_id: data.classroomId, kind: 'one_off', starts_at: data.startsAt, duration_minutes: data.durationMinutes })
    : await db.from('class_schedules').insert({ classroom_id: data.classroomId, kind: 'weekly', weekday: data.weekday, local_time: data.localTime, duration_minutes: data.durationMinutes, until: data.until })
  if (error) return { error: error.message }
  revalidatePath('/dashboard/schedule')
  return { ok: true }
}

export async function cancelSession(sessionId: string) {
  const user = await requireUser('/dashboard')
  const db = supabaseAdmin()
  const { data: session } = await db.from('sessions').select('id, classroom_id, classrooms!inner(teacher_id)').eq('id', sessionId).single()
  if (!session || (session as any).classrooms.teacher_id !== user.id) return { error: 'Not found' }
  const { error } = await db.from('sessions').update({ status: 'canceled' }).eq('id', sessionId).eq('status', 'scheduled')
  if (error) return { error: error.message }
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
