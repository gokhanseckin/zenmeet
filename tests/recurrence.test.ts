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
})
