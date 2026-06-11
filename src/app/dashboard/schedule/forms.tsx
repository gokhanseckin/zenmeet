'use client'
import { useState } from 'react'

export function NewScheduleForm({ classroomId, timezone, action }: {
  classroomId: string; timezone: string
  action: (fd: FormData) => Promise<void>
}) {
  const [kind, setKind] = useState<'weekly' | 'one_off'>('weekly')
  const [weekday, setWeekday] = useState(1)
  const [time, setTime] = useState('07:00')
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  // live preview: next 4 occurrences as local wall-time text (server is source of truth)
  const preview = kind === 'weekly'
    ? Array.from({ length: 4 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() + ((weekday - d.getDay() + 7) % 7 || 7) + i * 7)
        return `${days[weekday].slice(0, 3)} ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time} (${timezone})`
      })
    : []
  return (
    <form action={action} className="rounded border p-4 space-y-3">
      <input type="hidden" name="classroomId" value={classroomId} />
      <div className="flex gap-2 text-sm">
        {(['one_off', 'weekly'] as const).map(k => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`rounded px-3 py-1 border ${kind === k ? 'bg-neutral-900 text-white' : ''}`}>
            {k === 'one_off' ? 'One-off' : 'Recurring'}</button>
        ))}
        <input type="hidden" name="kind" value={kind} />
      </div>
      {kind === 'weekly' ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          Weekly on
          <select name="weekday" value={weekday} onChange={e => setWeekday(Number(e.target.value))} className="rounded border px-2 py-1">
            {days.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          at <input name="localTime" type="time" value={time} onChange={e => setTime(e.target.value)} className="rounded border px-2 py-1" />
          for <input name="duration" type="number" defaultValue={60} className="w-20 rounded border px-2 py-1" /> min
          <label className="text-neutral-500">until <input name="until" type="date" className="rounded border px-2 py-1" /> (optional)</label>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm">
          <input name="startsAtLocal" type="datetime-local" required className="rounded border px-2 py-1" />
          for <input name="duration" type="number" defaultValue={60} className="w-20 rounded border px-2 py-1" /> min
        </div>
      )}
      {preview.length > 0 && (
        <div className="rounded bg-neutral-50 p-3">
          <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Scheduled sessions</p>
          <ul className="mt-1 text-sm">{preview.map(p => <li key={p}>{p} &middot; link auto</li>)}</ul>
        </div>
      )}
      <p className="text-xs text-orange-800">Fresh private link per session &middot; revealed 5 min before</p>
      <button className="rounded bg-orange-800 px-5 py-2 text-white">Save</button>
    </form>
  )
}
