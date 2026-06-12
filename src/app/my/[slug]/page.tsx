import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canJoin, hasMembershipAccess, unlocksAt } from '@/lib/unlock'
import { getFreshMembership } from '@/lib/membership'
import { Countdown } from '@/app/[slug]/countdown'
import { PortalButton } from './portal-button'

export const dynamic = 'force-dynamic'

type MembershipLike = {
  status: string | null
  current_period_end?: string | null
} | null

function hasCurrentMembership(membership: MembershipLike, now = new Date()) {
  return hasMembershipAccess({
    status: membership?.status ?? null,
    currentPeriodEnd: membership?.current_period_end ?? null,
    now,
  })
}

export default async function MemberHome({ params, searchParams }: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ cs?: string; locked?: string; pending?: string }>
}) {
  const { slug } = await params
  const { cs, pending } = await searchParams
  const user = await requireUser(`/my/${slug}`)
  const db = supabaseAdmin()

  const { data: classroom } = await db.from('classrooms')
    .select('id, slug, status, teacher_id, teachers!inner(stripe_account_id, timezone)')
    .eq('slug', slug).single()
  if (!classroom) notFound()

  const teacher = (classroom as any).teachers
  const stripeAccountId: string | null = teacher.stripe_account_id ?? null
  const isOwner = classroom.teacher_id === user.id

  // Guard: if teacher has no Stripe account, skip getFreshMembership and read DB directly
  let membership: Awaited<ReturnType<typeof getFreshMembership>> | null = null
  if (!isOwner && stripeAccountId) {
    membership = await getFreshMembership({
      studentId: user.id,
      classroomId: classroom.id,
      stripeAccountId,
      checkoutSessionId: cs,
    })
  } else {
    const { data } = await db.from('memberships')
      .select('*')
      .eq('student_id', user.id)
      .eq('classroom_id', classroom.id)
      .maybeSingle()
    membership = data
  }

  const active = hasCurrentMembership(membership)
  const canViewPrivateDetails = isOwner || active

  if (!canViewPrivateDetails && classroom.status !== 'published') notFound()

  const { data: displayClassroom } = await db.from('classrooms')
    .select('id, slug, title, provider')
    .eq('id', classroom.id).single()
  if (!displayClassroom) notFound()

  let rawSessions: { id: string; starts_at: string; ends_at: string; join_url: string | null }[] = []
  if (canViewPrivateDetails) {
    // Select join_url to compute linkReady flag, but immediately map to strip the raw URL
    const { data } = await db.from('sessions')
      .select('id, starts_at, ends_at, join_url')
      .eq('classroom_id', classroom.id)
      .eq('status', 'scheduled')
      .gt('ends_at', new Date().toISOString())
      .order('starts_at')
      .limit(5)
    rawSessions = data ?? []
  }

  // Map immediately — raw join_url never touches JSX or client components
  const upcoming = rawSessions.map(s => ({
    id: s.id,
    startsAt: s.starts_at,
    endsAt: s.ends_at,
    linkReady: !!s.join_url,
  }))

  const next = upcoming[0]
  const unlocked = next && active && canJoin({
    membershipStatus: membership!.status,
    currentPeriodEnd: membership!.current_period_end ?? null,
    sessionStartsAt: new Date(next.startsAt),
    now: new Date(),
  })

  // Render in the teacher's timezone and append the zone abbreviation (e.g.
  // "PST") so students in other zones aren't misled by an unlabeled time.
  const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: teacher.timezone,
    timeZoneName: 'short',
  })

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      {active
        ? <span className="rounded-full border px-3 py-1 text-xs text-green-800">● Active member</span>
        : <span className="rounded-full border px-3 py-1 text-xs text-red-800">Membership inactive — <a className="underline" href={`/${slug}`}>rejoin</a></span>}
      <h1 className="mt-4 text-3xl font-bold">{displayClassroom.title}</h1>
      {next && (
        <p className="mt-1 text-neutral-600">
          Next: {fmt(next.startsAt)} · {displayClassroom.provider === 'meet' ? 'Google Meet' : 'Zoom'}
        </p>
      )}

      {active && next && (
        <section className="mt-6 rounded-lg border-2 border-orange-800 p-6 text-center">
          {unlocked ? (
            <>
              <p className="font-mono text-xs tracking-widest text-green-700 uppercase">● Doors open</p>
              <a href={`/api/join/${next.id}`} className="mt-3 block rounded bg-orange-800 px-6 py-3 text-white font-semibold">
                Join class now →
              </a>
              <p className="mt-2 text-xs text-neutral-500">
                {next.linkReady
                  ? `Opens ${displayClassroom.provider === 'meet' ? 'Google Meet' : 'Zoom'}`
                  : 'Link is on its way — refresh shortly'}
              </p>
              {pending && (
                <p className="mt-1 text-xs text-orange-800">The link is being prepared — try again in a minute.</p>
              )}
            </>
          ) : (
            <>
              <p className="font-mono text-xs tracking-widest text-neutral-500 uppercase">Doors open in</p>
              <div className="mt-3 flex justify-center">
                <Countdown targetIso={unlocksAt(new Date(next.startsAt)).toISOString()} />
              </div>
            </>
          )}
        </section>
      )}

      <nav className="mt-8 divide-y border-t border-b">
        {active && (
          <>
            <PortalButton slug={slug} label="Manage membership" />
            <PortalButton slug={slug} label="Billing & receipts" />
          </>
        )}
        {canViewPrivateDetails && (
          <details className="py-3">
            <summary className="cursor-pointer">Class schedule</summary>
            <ul className="mt-2 space-y-1 text-sm text-neutral-600">
              {upcoming.map(s => <li key={s.id}>{fmt(s.startsAt)}</li>)}
            </ul>
          </details>
        )}
      </nav>
    </main>
  )
}
