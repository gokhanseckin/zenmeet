import { DateTime } from 'luxon'
import { loadDashboard } from '../lib'
import { createSchedule, cancelSession, setSessionLink } from '@/app/actions/schedule'
import { NewScheduleForm } from './forms'

export const dynamic = 'force-dynamic'

export default async function ScheduleTab({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const { teacher, classroom, db } = await loadDashboard(c)
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
    if (kind === 'weekly') {
      await createSchedule({ kind: 'weekly', classroomId: classroom.id,
        weekday: Number(fd.get('weekday')), localTime: String(fd.get('localTime')),
        durationMinutes: Number(fd.get('duration')), until: fd.get('until') ? String(fd.get('until')) : null })
    } else {
      const startsAt = DateTime.fromISO(String(fd.get('startsAtLocal')), { zone: teacher.timezone }).toUTC().toISO()!
      await createSchedule({ kind: 'one_off', classroomId: classroom.id, startsAt, durationMinutes: Number(fd.get('duration')) })
    }
  }
  async function cancel(fd: FormData) { 'use server'; await cancelSession(String(fd.get('id'))) }
  async function manualLink(fd: FormData) { 'use server'; await setSessionLink(String(fd.get('id')), String(fd.get('url'))) }

  const fmt = (iso: string) => DateTime.fromISO(iso).setZone(teacher.timezone).toFormat('EEE MMM d · h:mma')
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Schedule</h1>
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
