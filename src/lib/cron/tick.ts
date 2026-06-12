import { materializeOccurrences, type ScheduleRule } from '@/lib/recurrence'

export type ActiveSchedule = {
  scheduleId: string; classroomId: string; title: string; rule: ScheduleRule
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
  /**
   * Sessions with status 'scheduled', join_url NULL, and
   * asOf - PROVISION_GRACE_MS < startsAt <= asOf + withinMs.
   * Filtering attempts < MAX_ATTEMPTS is optional (runTick re-checks).
   */
  listSessionsNeedingLinks(withinMs: number, asOf: Date): Promise<ProvisionTarget[]>
  /**
   * Compare-and-set: adapter must implement `UPDATE ... WHERE join_url IS NULL`.
   * Returns true if this call set the link, false if it was already set.
   */
  saveSessionLink(sessionKey: string, joinUrl: string, providerMeetingId: string): Promise<boolean>
  bumpAttempts(sessionKey: string): Promise<void>
  markPastSessionsDone(asOf: Date): Promise<void>
}

export interface MeetingCreator {
  /** Resolves provider + token for the teacher and creates the meeting. */
  createMeeting(target: ProvisionTarget): Promise<{ joinUrl: string; providerMeetingId: string }>
}

export const MATERIALIZE_DAYS = 30
export const PROVISION_WINDOW_MS = 60 * 60_000
/** The pg_cron tick fires every 10 min. */
export const TICK_PERIOD_MS = 10 * 60_000
/**
 * How long after a session's start it remains eligible for link provisioning.
 *
 * This MUST be >= the tick period: a session whose start falls between two ticks
 * (or whose first provisioning attempt failed) must survive in
 * listSessionsNeedingLinks long enough for the next tick to (re)provision it,
 * otherwise it silently falls out of the window and never gets a join_url.
 *
 * Ideally a session stays provisionable for its full duration (until ends_at),
 * since members can still join an in-progress class. We express that the simple
 * way here — a flat grace of TWO tick periods — rather than switching the DB
 * query's lower bound from starts_at to ends_at: keeping the bound on starts_at
 * preserves the documented (starts_at-based) CronDb contract and the existing
 * idempotent CAS provisioning path, while 2x the tick period comfortably spans
 * any single inter-tick gap plus one retry for the common short-class case.
 */
export const PROVISION_GRACE_MS = 2 * TICK_PERIOD_MS
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
  let provisioned = 0, provisionErrors = 0, abandoned = 0
  for (const target of await db.listSessionsNeedingLinks(PROVISION_WINDOW_MS, now)) {
    if (target.attempts >= MAX_ATTEMPTS) {
      abandoned++
      if (target.attempts === MAX_ATTEMPTS) console.error('[cron] giving up on session', target.sessionKey)
      continue
    }
    let meeting: { joinUrl: string; providerMeetingId: string } | null = null
    try {
      meeting = await creator.createMeeting(target)
    } catch (e) {
      console.error('[cron] createMeeting failed', target.sessionKey, e)
      await db.bumpAttempts(target.sessionKey)
      provisionErrors++
      continue
    }
    try {
      const won = await db.saveSessionLink(target.sessionKey, meeting.joinUrl, meeting.providerMeetingId)
      if (won) provisioned++
      else console.error('[cron] session already provisioned by a concurrent tick; orphaned meeting', target.sessionKey, meeting.providerMeetingId)
    } catch (e) {
      console.error('[cron] saveSessionLink failed (meeting created but not saved)', target.sessionKey, meeting.providerMeetingId, e)
      provisionErrors++
      // bump to cap duplicate-create chain; failure is logged with the orphaned meeting id
      await db.bumpAttempts(target.sessionKey)
    }
  }

  // 3. Sweep
  await db.markPastSessionsDone(now)
  return { materialized, provisioned, provisionErrors, scheduleErrors, abandoned }
}
