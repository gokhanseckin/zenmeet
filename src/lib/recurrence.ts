import { DateTime } from 'luxon'

export type ScheduleRule =
  | { kind: 'one_off'; startsAt: string; durationMinutes: number }
  | { kind: 'weekly'; weekday: number /* 0=Sun..6=Sat */; localTime: string /* HH:MM */
      durationMinutes: number; timezone: string; until: string | null /* YYYY-MM-DD */ }

export type Occurrence = { startsAt: Date; endsAt: Date }

/** All occurrences with fromUtc <= startsAt < fromUtc + days. Pure; DST-safe via luxon. */
export function materializeOccurrences(rule: ScheduleRule, fromUtc: Date, days: number): Occurrence[] {
  const windowStart = DateTime.fromJSDate(fromUtc, { zone: 'utc' })
  const windowEnd = windowStart.plus({ days })

  if (rule.kind === 'one_off') {
    const start = DateTime.fromISO(rule.startsAt, { zone: 'utc' })
    if (start < windowStart || start >= windowEnd) return []
    return [{ startsAt: start.toJSDate(), endsAt: start.plus({ minutes: rule.durationMinutes }).toJSDate() }]
  }

  const [hour, minute] = rule.localTime.split(':').map(Number)
  const luxonWeekday = rule.weekday === 0 ? 7 : rule.weekday // luxon: 1=Mon..7=Sun
  const out: Occurrence[] = []
  // Walk local calendar days across the window (pad a day each side for tz offsets).
  let day = windowStart.setZone(rule.timezone).minus({ days: 1 }).startOf('day')
  const lastDay = windowEnd.setZone(rule.timezone).plus({ days: 1 }).startOf('day')
  for (; day <= lastDay; day = day.plus({ days: 1 })) {
    if (day.weekday !== luxonWeekday) continue
    if (rule.until && day.toISODate()! > rule.until) break
    const start = day.set({ hour, minute }) // luxon resolves DST for this wall time
    if (start < windowStart || start >= windowEnd) continue
    out.push({ startsAt: start.toUTC().toJSDate(), endsAt: start.plus({ minutes: rule.durationMinutes }).toUTC().toJSDate() })
  }
  return out
}
