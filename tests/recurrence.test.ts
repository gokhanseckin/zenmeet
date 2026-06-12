import { describe, it, expect } from 'vitest'
import { materializeOccurrences, type ScheduleRule } from '@/lib/recurrence'

const weekly = (over: Partial<Extract<ScheduleRule, {kind:'weekly'}>> = {}): ScheduleRule => ({
  kind: 'weekly', weekday: 1, localTime: '07:00', durationMinutes: 60,
  timezone: 'America/New_York', until: null, ...over,
})

describe('one-off', () => {
  it('yields the single occurrence inside the window, none outside', () => {
    const rule: ScheduleRule = { kind: 'one_off', startsAt: '2026-06-15T11:00:00Z', durationMinutes: 90 }
    const occ = materializeOccurrences(rule, new Date('2026-06-10T00:00:00Z'), 30)
    expect(occ).toEqual([{ startsAt: new Date('2026-06-15T11:00:00Z'), endsAt: new Date('2026-06-15T12:30:00Z') }])
    expect(materializeOccurrences(rule, new Date('2026-07-01T00:00:00Z'), 30)).toEqual([])
  })
})

describe('ad-hoc / synchronous materialization', () => {
  // Mirrors createSchedule's synchronous materialization: an occurrence starting
  // within one cron period (10 min) from `now` must be materialized at creation
  // time, and re-materializing the same rule must not produce duplicate rows.
  it('materializes a one_off starting ~5 min from now', () => {
    const now = new Date('2026-06-15T10:30:00Z')
    const startsAt = new Date(now.getTime() + 5 * 60_000).toISOString()
    const occ = materializeOccurrences({ kind: 'one_off', startsAt, durationMinutes: 30 }, now, 30)
    expect(occ.map(o => o.startsAt.toISOString())).toEqual([new Date(startsAt).toISOString()])
  })

  it('is idempotent under an ignore-dupes (schedule_id,starts_at) insert', () => {
    const now = new Date('2026-06-15T10:30:00Z')
    const rule: ScheduleRule = { kind: 'one_off', startsAt: new Date(now.getTime() + 5 * 60_000).toISOString(), durationMinutes: 30 }
    // Simulate the unique (schedule_id, starts_at) constraint with a key set.
    const rows = new Set<string>()
    const insertIgnoreDupes = (occ: ReturnType<typeof materializeOccurrences>) => {
      let inserted = 0
      for (const o of occ) {
        const key = `sch-1|${o.startsAt.toISOString()}`
        if (!rows.has(key)) { rows.add(key); inserted++ }
      }
      return inserted
    }
    // Synchronous create materializes once...
    expect(insertIgnoreDupes(materializeOccurrences(rule, now, 30))).toBe(1)
    // ...a later cron tick re-materializing the same rule inserts nothing.
    expect(insertIgnoreDupes(materializeOccurrences(rule, new Date(now.getTime() + 60_000), 30))).toBe(0)
    expect(rows.size).toBe(1)
  })
})

describe('weekly', () => {
  it('yields every Monday 7:00am ET in the window', () => {
    const occ = materializeOccurrences(weekly(), new Date('2026-06-10T00:00:00Z'), 14)
    // Mondays Jun 15 and Jun 22; EDT = UTC-4 → 11:00Z
    expect(occ.map(o => o.startsAt.toISOString()))
      .toEqual(['2026-06-15T11:00:00.000Z', '2026-06-22T11:00:00.000Z'])
    expect(occ[0].endsAt.toISOString()).toBe('2026-06-15T12:00:00.000Z')
  })
  it('stays at 7:00 local across the November DST fall-back', () => {
    // DST ends Sun Nov 1 2026 in America/New_York: EDT(-4) → EST(-5)
    const occ = materializeOccurrences(weekly(), new Date('2026-10-25T00:00:00Z'), 10)
    expect(occ.map(o => o.startsAt.toISOString()))
      .toEqual(['2026-10-26T11:00:00.000Z', '2026-11-02T12:00:00.000Z'])
  })
  it('stays at 7:00 local across the March spring-forward', () => {
    // DST starts Sun Mar 8 2026: EST(-5) → EDT(-4)
    const occ = materializeOccurrences(weekly(), new Date('2026-03-02T00:00:00Z'), 10)
    expect(occ.map(o => o.startsAt.toISOString()))
      .toEqual(['2026-03-02T12:00:00.000Z', '2026-03-09T11:00:00.000Z'])
  })
  it('respects until (inclusive, in the teacher timezone)', () => {
    const occ = materializeOccurrences(weekly({ until: '2026-06-15' }), new Date('2026-06-10T00:00:00Z'), 30)
    expect(occ.map(o => o.startsAt.toISOString())).toEqual(['2026-06-15T11:00:00.000Z'])
  })
  it('does not yield occurrences before fromUtc', () => {
    const occ = materializeOccurrences(weekly(), new Date('2026-06-15T11:00:01Z'), 7)
    expect(occ.map(o => o.startsAt.toISOString())).toEqual(['2026-06-22T11:00:00.000Z'])
  })
  it('throws on out-of-range localTime instead of silently shifting days', () => {
    expect(() => materializeOccurrences(weekly({ localTime: '24:00' }), new Date('2026-06-10T00:00:00Z'), 14)).toThrow(/localTime/)
    expect(() => materializeOccurrences(weekly({ localTime: '25:99' }), new Date('2026-06-10T00:00:00Z'), 14)).toThrow(/localTime/)
  })
  it('throws on an invalid IANA timezone instead of silently yielding zero sessions', () => {
    expect(() => materializeOccurrences(weekly({ timezone: 'America/Not_A_Zone' }), new Date('2026-06-10T00:00:00Z'), 14)).toThrow(/timezone/)
  })
})
