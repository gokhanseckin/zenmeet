import { DateTime } from 'luxon'
import { redirect } from 'next/navigation'
import { loadDashboard } from '../lib'
import { createSchedule, cancelSession, setSessionLink, stopSchedule } from '@/app/actions/schedule'
import { NewScheduleForm } from './forms'
import { ClassroomSwitcher } from '../switcher'

export const dynamic = 'force-dynamic'

const SCHEDULE_ERRORS: Record<string, string> = {
  create: "Couldn't save that schedule — check the time and duration.",
  cancel: "Couldn't cancel that session.",
  link: 'That link was rejected — enter a valid URL.',
  stop: "Couldn't stop that recurring rule.",
}

export default async function ScheduleTab({ searchParams }: { searchParams: Promise<{ c?: string; error?: string }> }) {
  const { c, error } = await searchParams
  const { teacher, classroom, classrooms, db } = await loadDashboard(c)
  // Preserve the active classroom (?c=) when redirecting an action error back here.
  const back = (code: string) => `/dashboard/schedule?${c ? `c=${c}&` : ''}error=${code}`
  // Load active schedules (filter out ended ones: until < today)
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawSchedules } = await db.from('class_schedules')
    .select('id, kind, weekday, local_time, duration_minutes, until')
    .eq('classroom_id', classroom.id)
    .or(`until.is.null,until.gte.${today}`)
    .order('created_at')

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const activeSchedules = (rawSchedules ?? []).map(s => ({
    id: s.id as string,
    kind: s.kind as string,
    weekday: s.weekday as number | null,
    localTime: s.local_time as string | null,
    durationMinutes: s.duration_minutes as number,
  }))

  const { data: rawSessions } = await db.from('sessions')
    .select('id, starts_at, ends_at, status, join_url, provision_attempts')
    .eq('classroom_id', classroom.id).eq('status', 'scheduled')
    .gt('ends_at', new Date().toISOString()).order('starts_at').limit(20)

  // Map to safe shape — never pass raw join_url into JSX
  const sessions = (rawSessions ?? []).map(s => ({
    id: s.id as string,
    startsAt: s.starts_at as string,
    linkReady: !!(s.join_url),
    attempts: (s.provision_attempts as number) ?? 0,
  }))

  async function submit(fd: FormData) {
    'use server'
    const kind = String(fd.get('kind'))
    let r
    if (kind === 'weekly') {
      r = await createSchedule({ kind: 'weekly', classroomId: classroom.id,
        weekday: Number(fd.get('weekday')), localTime: String(fd.get('localTime')),
        durationMinutes: Number(fd.get('duration')), until: fd.get('until') ? String(fd.get('until')) : null })
    } else {
      const startsAt = DateTime.fromISO(String(fd.get('startsAtLocal')), { zone: teacher.timezone }).toUTC().toISO()!
      r = await createSchedule({ kind: 'one_off', classroomId: classroom.id, startsAt, durationMinutes: Number(fd.get('duration')) })
    }
    if ('error' in r && r.error) redirect(back('create'))
  }
  async function cancel(fd: FormData) { 'use server'; const r = await cancelSession(String(fd.get('id'))); if (r && 'error' in r && r.error) redirect(back('cancel')) }
  async function manualLink(fd: FormData) { 'use server'; const r = await setSessionLink(String(fd.get('id')), String(fd.get('url'))); if (r && 'error' in r && r.error) redirect(back('link')) }
  async function stop(fd: FormData) { 'use server'; const r = await stopSchedule(String(fd.get('scheduleId'))); if (r && 'error' in r && r.error) redirect(back('stop')) }

  const fmt = (iso: string) => DateTime.fromISO(iso).setZone(teacher.timezone).toFormat('EEE MMM d · h:mma')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Schedule</h1>
      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">
          {SCHEDULE_ERRORS[error] ?? "That didn't work — please try again."}
        </div>
      )}
      <ClassroomSwitcher classrooms={classrooms} currentId={classroom.id} basePath="/dashboard/schedule" />
      {activeSchedules.length > 0 && (
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-500">Recurring rules</p>
          <ul className="divide-y rounded border">
            {activeSchedules.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  {s.kind === 'weekly' && s.weekday != null
                    ? `Weekly on ${DAYS[s.weekday]} · ${s.localTime} · ${s.durationMinutes} min`
                    : `One-off · ${s.durationMinutes} min`}
                </span>
                <form action={stop}>
                  <input type="hidden" name="scheduleId" value={s.id} />
                  <button className="text-xs text-red-700 underline">stop</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
      <NewScheduleForm classroomId={classroom.id} timezone={teacher.timezone} action={submit} />
      <ul className="divide-y rounded border">
        {sessions.map(s => (
          <li key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
            <span>{fmt(s.startsAt)} {s.linkReady ? '· link ready' : s.attempts > 0 ? '· ⚠ link failed, retrying' : '· link auto'}</span>
            <span className="flex gap-2">
              {!s.linkReady && (
                <form action={manualLink} className="flex gap-1">
                  <input type="hidden" name="id" value={s.id} />
                  <input name="url" placeholder="paste link manually" className="rounded border px-2 py-1 text-xs" />
                  <button className="text-xs underline">set</button>
                </form>
              )}
              <form action={cancel}><input type="hidden" name="id" value={s.id} /><button className="text-xs text-red-700 underline">cancel</button></form>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
