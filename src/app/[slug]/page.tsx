import { cache } from 'react'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getUser } from '@/lib/auth'
import { canJoin, unlocksAt, ACTIVE_STATUSES } from '@/lib/unlock'
import { Countdown } from './countdown'
import { JoinCta } from './join-cta'

export const dynamic = 'force-dynamic'

/**
 * Lightweight, request-deduped fetch of the public-facing fields needed for
 * share metadata. Cached so generateMetadata and the page don't double-query.
 */
const getClassroomMeta = cache(async (slug: string) => {
  const { data } = await supabaseAdmin()
    .from('classrooms')
    .select('title, description, teachers!inner(display_name)')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  return data
})

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const classroom = await getClassroomMeta(slug)
  if (!classroom) {
    return { title: 'Class not found' }
  }

  const teacherName = (classroom as any).teachers?.display_name?.trim() || null
  const title = classroom.title
  const description =
    classroom.description?.trim() ||
    (teacherName
      ? `Join ${teacherName}'s live class on Zenmeet.`
      : 'Join this live class on Zenmeet.')

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      url: `/${slug}`,
      ...(teacherName ? { authors: [teacherName] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function ClassroomPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = supabaseAdmin()
  const { data: classroom } = await db
    .from('classrooms')
    .select('id, slug, title, description, provider, price_amount, currency, trial_days, status')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  if (!classroom) notFound()

  const { data: nextSession } = await db
    .from('sessions')
    .select('id, starts_at')
    .eq('classroom_id', classroom.id)
    .eq('status', 'scheduled')
    .gt('ends_at', new Date().toISOString())
    .order('starts_at')
    .limit(1)
    .maybeSingle()

  const { count: memberCount } = await db
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('classroom_id', classroom.id)
    .in('status', [...ACTIVE_STATUSES])

  const user = await getUser()
  let membershipStatus: string | null = null
  if (user) {
    const { data: m } = await db
      .from('memberships')
      .select('status')
      .eq('student_id', user.id)
      .eq('classroom_id', classroom.id)
      .maybeSingle()
    membershipStatus = m?.status ?? null
  }

  const isMember = membershipStatus !== null && ACTIVE_STATUSES.has(membershipStatus)
  const unlocked =
    nextSession &&
    canJoin({
      membershipStatus,
      sessionStartsAt: new Date(nextSession.starts_at),
      now: new Date(),
    })

  const price =
    classroom.price_amount != null
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: classroom.currency,
        }).format(classroom.price_amount / 100)
      : null

  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <p className="font-mono text-xs tracking-widest text-neutral-500 uppercase">
        Live class · {classroom.provider === 'meet' ? 'Google Meet' : 'Zoom'}
      </p>
      <h1 className="mt-3 text-4xl font-bold">{classroom.title}</h1>
      <p className="mt-2 text-neutral-600">{classroom.description}</p>
      <p className="mt-2 text-sm text-neutral-500">{memberCount ?? 0} members</p>

      {nextSession ? (
        <section className="mt-10">
          {unlocked ? (
            <p className="font-mono text-xs tracking-widest text-green-700 uppercase">● Doors open</p>
          ) : (
            <>
              <p className="font-mono text-xs tracking-widest text-neutral-500 uppercase">
                Next live class in
              </p>
              <div className="mt-4 flex justify-center">
                <Countdown targetIso={unlocksAt(new Date(nextSession.starts_at)).toISOString()} />
              </div>
            </>
          )}
          {unlocked ? (
            <a
              href={`/api/join/${nextSession.id}`}
              className="mt-6 inline-block rounded bg-orange-800 px-8 py-3 text-white font-semibold"
            >
              Join class now →
            </a>
          ) : (
            <div className="mt-6 inline-block rounded border border-dashed border-orange-800 bg-orange-50 px-6 py-3 text-orange-900 text-sm">
              Live link unlocks 5 min before — members only
            </div>
          )}
        </section>
      ) : (
        <p className="mt-10 text-neutral-500">No upcoming sessions scheduled.</p>
      )}

      {!isMember && price && (
        <section className="mt-10">
          <JoinCta slug={classroom.slug} label={`Join — ${price}/mo`} />
          {classroom.trial_days > 0 && (
            <p className="mt-2 text-sm text-neutral-500">
              First {classroom.trial_days} days free
            </p>
          )}
        </section>
      )}

      {isMember && (
        <p className="mt-8">
          <Link className="underline" href={`/my/${classroom.slug}`}>
            Go to your member home →
          </Link>
        </p>
      )}
    </main>
  )
}
