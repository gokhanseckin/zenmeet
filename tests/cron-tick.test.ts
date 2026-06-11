import { describe, it, expect, beforeEach, vi } from 'vitest'
import { runTick, type CronDb, type ProvisionTarget } from '@/lib/cron/tick'

const now = new Date('2026-06-15T10:30:00Z') // Monday; 7:00am ET session = 11:00Z, 30 min away

function makeWorld() {
  const sessions = new Map<string, any>() // key: scheduleId|startsAt
  const db: CronDb = {
    async listActiveSchedules() {
      return [{
        scheduleId: 'sch-1', classroomId: 'cls-1', title: 'Morning Vinyasa', timezone: 'America/New_York',
        rule: { kind: 'weekly', weekday: 1, localTime: '07:00', durationMinutes: 60, timezone: 'America/New_York', until: null },
      }]
    },
    async insertSessionsIgnoreDupes(rows) {
      let inserted = 0
      for (const r of rows) {
        const key = `${r.scheduleId}|${r.startsAt.toISOString()}`
        if (!sessions.has(key)) { sessions.set(key, { ...r, joinUrl: null, attempts: 0, status: 'scheduled' }); inserted++ }
      }
      return inserted
    },
    async listSessionsNeedingLinks(withinMs, asOf) {
      return [...sessions.entries()]
        .filter(([, s]) => s.status === 'scheduled' && !s.joinUrl
          && s.startsAt.getTime() - asOf.getTime() <= withinMs && s.startsAt.getTime() > asOf.getTime() - 60_000)
        .map(([key, s]): ProvisionTarget => ({
          sessionKey: key, classroomId: s.classroomId, teacherId: 't-1', provider: 'meet',
          title: 'Morning Vinyasa', startsAt: s.startsAt, endsAt: s.endsAt, timezone: 'America/New_York', attempts: s.attempts,
        }))
    },
    async saveSessionLink(key, url, meetingId) { Object.assign(sessions.get(key), { joinUrl: url, meetingId }) },
    async bumpAttempts(key) { sessions.get(key).attempts++ },
    async markPastSessionsDone(asOf) {
      for (const s of sessions.values()) if (s.status === 'scheduled' && s.endsAt < asOf) s.status = 'done'
    },
  }
  return { db, sessions }
}

describe('runTick', () => {
  let world: ReturnType<typeof makeWorld>
  const okCreate = vi.fn(async () => ({ joinUrl: 'https://meet.google.com/abc', providerMeetingId: 'm1' }))
  beforeEach(() => { world = makeWorld(); okCreate.mockClear() })

  it('materializes 30 days of sessions, idempotently', async () => {
    const r1 = await runTick(world.db, { createMeeting: okCreate }, now)
    expect(r1.materialized).toBeGreaterThanOrEqual(4) // ≥4 Mondays in 30 days
    const r2 = await runTick(world.db, { createMeeting: okCreate }, now)
    expect(r2.materialized).toBe(0)
  })
  it('provisions links only for sessions starting within 60 min', async () => {
    await runTick(world.db, { createMeeting: okCreate }, now)
    expect(okCreate).toHaveBeenCalledTimes(1) // only today's 11:00Z session
    const s = [...world.sessions.values()].find(s => s.startsAt.toISOString() === '2026-06-15T11:00:00.000Z')
    expect(s.joinUrl).toBe('https://meet.google.com/abc')
  })
  it('bumps attempts and continues when provisioning fails', async () => {
    const fail = vi.fn(async () => { throw new Error('api down') })
    const r = await runTick(world.db, { createMeeting: fail }, now)
    expect(r.provisionErrors).toBe(1)
    const s = [...world.sessions.values()].find(s => s.startsAt.toISOString() === '2026-06-15T11:00:00.000Z')
    expect(s.attempts).toBe(1)
    expect(s.joinUrl).toBeNull()
    // next tick retries
    await runTick(world.db, { createMeeting: okCreate }, new Date(now.getTime() + 10 * 60_000))
    expect(s.joinUrl).toBe('https://meet.google.com/abc')
  })
  it('marks past sessions done', async () => {
    await runTick(world.db, { createMeeting: okCreate }, now)
    const later = new Date('2026-06-15T13:00:00Z')
    await runTick(world.db, { createMeeting: okCreate }, later)
    const s = [...world.sessions.values()].find(s => s.startsAt.toISOString() === '2026-06-15T11:00:00.000Z')
    expect(s.status).toBe('done')
  })
  it('isolates a bad schedule: valid schedules still materialize, scheduleErrors counted', async () => {
    const badDb: CronDb = {
      ...world.db,
      async listActiveSchedules() {
        return [
          {
            scheduleId: 'sch-bad', classroomId: 'cls-bad', title: 'Broken', timezone: 'Bad/Zone',
            rule: { kind: 'weekly', weekday: 1, localTime: '07:00', durationMinutes: 60, timezone: 'Bad/Zone', until: null },
          },
          {
            scheduleId: 'sch-1', classroomId: 'cls-1', title: 'Morning Vinyasa', timezone: 'America/New_York',
            rule: { kind: 'weekly', weekday: 1, localTime: '07:00', durationMinutes: 60, timezone: 'America/New_York', until: null },
          },
        ]
      },
    }
    const r = await runTick(badDb, { createMeeting: okCreate }, now)
    expect(r.scheduleErrors).toBe(1)
    expect(r.materialized).toBeGreaterThanOrEqual(4) // valid schedule unaffected
    expect([...world.sessions.keys()].every(k => k.startsWith('sch-1|'))).toBe(true)
  })
})
