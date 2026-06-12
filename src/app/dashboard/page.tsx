import { redirect } from 'next/navigation'
import { loadDashboard } from './lib'
import { publishClassroom } from '@/app/actions/classroom'
import { canPublish } from '@/lib/publish'
import { ClassroomSwitcher } from './switcher'

export const dynamic = 'force-dynamic'

export default async function ClassroomTab({ searchParams }: { searchParams: Promise<{ c?: string; error?: string }> }) {
  const { c, error } = await searchParams
  const { teacher, classroom, classrooms, db } = await loadDashboard(c)
  const { count: scheduleCount } = await db.from('class_schedules').select('*', { count: 'exact', head: true }).eq('classroom_id', classroom.id)
  const check = canPublish({ teacher, classroom, scheduleCount: scheduleCount ?? 0 })
  const needsReconnect = classroom.provider === 'zoom' ? teacher.zoom_needs_reconnect : teacher.google_needs_reconnect

  async function publish() {
    'use server'
    const r = await publishClassroom(classroom.id)
    if ('error' in r && r.error) redirect(`/dashboard?${c ? `c=${c}&` : ''}error=publish`)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Classroom</h1>
      {error === 'publish' && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-800">
          Couldn&apos;t publish &mdash; please complete the steps above and try again.
        </div>
      )}
      <ClassroomSwitcher classrooms={classrooms} currentId={classroom.id} basePath="/dashboard" />
      {needsReconnect && (
        <div className="rounded bg-red-50 p-4 text-red-900">
          We can&apos;t create class links &mdash; please{' '}
          <a className="underline font-semibold" href={`/api/oauth/${classroom.provider === 'zoom' ? 'zoom' : 'google'}/start`}>
            reconnect {classroom.provider === 'zoom' ? 'Zoom' : 'Google'}</a>.
        </div>
      )}
      {classroom.status === 'draft' && (
        <div className="rounded bg-orange-50 p-4 text-orange-900">
          <p className="font-semibold">Not published yet.</p>
          {check.ok
            ? <form action={publish}><button className="mt-2 rounded bg-orange-800 px-4 py-2 text-white">Publish now</button></form>
            : <ul className="mt-1 list-disc pl-5 text-sm">{check.missing.map(m => <li key={m}>{
                ({ title: 'Add a title', price: 'Set a price', stripe: 'Connect Stripe',
                   meeting_provider: 'Connect your meeting provider', schedule: 'Add a class schedule' } as Record<string, string>)[m]
              }</li>)}</ul>}
        </div>
      )}
      <div className="rounded border p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Share link</p>
        <a className="text-lg underline" href={`/${classroom.slug}`}>zenmeet.me/{classroom.slug}</a>
        <p className="mt-2 text-sm text-neutral-600">{classroom.title} &middot; {classroom.status}</p>
      </div>
    </div>
  )
}
