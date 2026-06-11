import { materializeOccurrences, type ScheduleRule } from '@/lib/recurrence'

export type ActiveSchedule = {
  scheduleId: string; classroomId: string; title: string; timezone: string; rule: ScheduleRule
}
export type NewSessionRow = {
  scheduleId: string; classroomId: string; startsAt: Date; endsAt: Date
}
export type ProvisionTarget = {
  sessionKey: string; classroomId: string; teacherId: string; provider: 'zoom' | 'meet'
  title: string; startsAt: Date; endsAt: Date; timezone: string; attempts: number
}

export interface CronDb {
  listActiveSchedules(): Promise<ActiveSchedule[]>
  /** Insert, ignoring (scheduleId, startsAt) duplicates. Returns count inserted. */
  insertSessionsIgnoreDupes(rows: NewSessionRow[]): Promise<number>
  listSessionsNeedingLinks(withinMs: number, asOf: Date): Promise<ProvisionTarget[]>
  saveSessionLink(sessionKey: string, joinUrl: string, providerMeetingId: string): Promise<void>
  bumpAttempts(sessionKey: string): Promise<void>
  markPastSessionsDone(asOf: Date): Promise<void>
}

export interface MeetingCreator {
  /** Resolves provider + token for the teacher and creates the meeting. */
  createMeeting(target: ProvisionTarget): Promise<{ joinUrl: string; providerMeetingId: string }>
}

export const MATERIALIZE_DAYS = 30
export const PROVISION_WINDOW_MS = 60 * 60_000
export const MAX_ATTEMPTS = 10

export async function runTick(db: CronDb, creator: MeetingCreator, now = new Date()) {
  // 1. Materialize (each schedule isolated; one bad rule must not block the rest)
  const schedules = await db.listActiveSchedules()
  let scheduleErrors = 0
  const rows: NewSessionRow[] = []
  for (const s of schedules) {
    try {
      rows.push(...materializeOccurrences(s.rule, now, MATERIALIZE_DAYS).map(o => ({
        scheduleId: s.scheduleId, classroomId: s.classroomId, startsAt: o.startsAt, endsAt: o.endsAt,
      })))
    } catch (e) {
      scheduleErrors++
      console.error('[cron] materialization failed for schedule', s.scheduleId, e)
    }
  }
  const materialized = rows.length ? await db.insertSessionsIgnoreDupes(rows) : 0

  // 2. Provision links (each failure isolated; retried next tick)
  let provisioned = 0, provisionErrors = 0
  for (const target of await db.listSessionsNeedingLinks(PROVISION_WINDOW_MS, now)) {
    if (target.attempts >= MAX_ATTEMPTS) continue
    try {
      const m = await creator.createMeeting(target)
      await db.saveSessionLink(target.sessionKey, m.joinUrl, m.providerMeetingId)
      provisioned++
    } catch (e) {
      console.error('[cron] provisioning failed', target.sessionKey, e)
      await db.bumpAttempts(target.sessionKey)
      provisionErrors++
    }
  }

  // 3. Sweep
  await db.markPastSessionsDone(now)
  return { materialized, provisioned, provisionErrors, scheduleErrors }
}
