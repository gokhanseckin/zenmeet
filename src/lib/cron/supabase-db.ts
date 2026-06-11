import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PROVISION_GRACE_MS, MAX_ATTEMPTS, type CronDb, type MeetingCreator, type ProvisionTarget, type ActiveSchedule } from './tick'
import type { ScheduleRule } from '@/lib/recurrence'
import { teacherTokenStore } from '@/lib/providers/store'
import { getValidAccessToken } from '@/lib/providers/tokens'
import { zoomProvider, refreshZoom } from '@/lib/providers/zoom'
import { googleProvider, refreshGoogle } from '@/lib/providers/google'

export function supabaseCronDb(): CronDb {
  const db = supabaseAdmin()
  return {
    async listActiveSchedules() {
      const { data, error } = await db.from('class_schedules')
        .select('id, kind, starts_at, weekday, local_time, duration_minutes, until, classrooms!inner(id, title, status, teachers!inner(timezone))')
        .eq('classrooms.status', 'published')
      if (error) throw new Error(error.message)
      return (data ?? []).map((r: any): ActiveSchedule => ({
        scheduleId: r.id,
        classroomId: r.classrooms.id,
        title: r.classrooms.title,
        rule: r.kind === 'one_off'
          ? ({ kind: 'one_off', startsAt: r.starts_at, durationMinutes: r.duration_minutes } as ScheduleRule)
          : ({ kind: 'weekly', weekday: r.weekday, localTime: r.local_time, durationMinutes: r.duration_minutes,
              timezone: r.classrooms.teachers.timezone, until: r.until } as ScheduleRule),
      }))
    },

    async insertSessionsIgnoreDupes(rows) {
      if (!rows.length) return 0
      const { data, error } = await db.from('sessions').upsert(
        rows.map(r => ({
          schedule_id: r.scheduleId,
          classroom_id: r.classroomId,
          starts_at: r.startsAt.toISOString(),
          ends_at: r.endsAt.toISOString(),
        })),
        { onConflict: 'schedule_id,starts_at', ignoreDuplicates: true },
      ).select('id')
      if (error) throw new Error(error.message)
      return data?.length ?? 0
    },

    async listSessionsNeedingLinks(withinMs, asOf) {
      // Filter: asOf - PROVISION_GRACE_MS < starts_at <= asOf + withinMs
      // Include attempts <= MAX_ATTEMPTS so runTick can log the first-time abandonment
      const { data, error } = await db.from('sessions')
        .select('id, starts_at, ends_at, provision_attempts, classrooms!inner(id, title, provider, teacher_id, teachers!inner(id, timezone))')
        .eq('status', 'scheduled')
        .is('join_url', null)
        .lt('provision_attempts', MAX_ATTEMPTS + 1)
        .gt('starts_at', new Date(asOf.getTime() - PROVISION_GRACE_MS).toISOString())
        .lte('starts_at', new Date(asOf.getTime() + withinMs).toISOString())
      if (error) throw new Error(error.message)
      return (data ?? []).map((r: any): ProvisionTarget => ({
        sessionKey: r.id,
        classroomId: r.classrooms.id,
        teacherId: r.classrooms.teacher_id,
        provider: r.classrooms.provider,
        title: r.classrooms.title,
        startsAt: new Date(r.starts_at),
        endsAt: new Date(r.ends_at),
        timezone: r.classrooms.teachers.timezone,
        attempts: r.provision_attempts,
      }))
    },

    async saveSessionLink(id, joinUrl, providerMeetingId) {
      // Compare-and-set: only the first writer wins (WHERE join_url IS NULL)
      const { data, error } = await db.from('sessions')
        .update({ join_url: joinUrl, provider_meeting_id: providerMeetingId })
        .eq('id', id)
        .is('join_url', null)
        .select('id')
      if (error) throw new Error(error.message)
      return (data?.length ?? 0) > 0
    },

    async bumpAttempts(id) {
      const { data, error } = await db.from('sessions').select('provision_attempts').eq('id', id).single()
      if (error) throw new Error(error.message)
      const { error: updateError } = await db.from('sessions')
        .update({ provision_attempts: (data?.provision_attempts ?? 0) + 1 })
        .eq('id', id)
      if (updateError) throw new Error(updateError.message)
    },

    async markPastSessionsDone(asOf) {
      const { error } = await db.from('sessions').update({ status: 'done' })
        .eq('status', 'scheduled')
        .lt('ends_at', asOf.toISOString())
      if (error) throw new Error(error.message)
    },
  }
}

export function liveMeetingCreator(): MeetingCreator {
  return {
    async createMeeting(t) {
      const providerName: 'zoom' | 'google' = t.provider === 'zoom' ? 'zoom' : 'google'
      const store = teacherTokenStore(t.teacherId, providerName)
      const refresh = t.provider === 'zoom' ? refreshZoom : refreshGoogle
      const impl = t.provider === 'zoom' ? zoomProvider : googleProvider
      const accessToken = await getValidAccessToken(store, refresh)
      return impl.createMeeting({ accessToken, title: t.title, startsAt: t.startsAt, endsAt: t.endsAt, timezone: t.timezone })
    },
  }
}
