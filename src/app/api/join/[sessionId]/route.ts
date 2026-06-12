import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canJoin } from '@/lib/unlock'
import { getFreshMembership } from '@/lib/membership'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Hosts we will redirect a joining student to. The join_url is teacher-supplied
 * (auto-provisioned by a provider, or set manually via setSessionLink), so an
 * unrestricted URL is an authenticated open-redirect: a teacher could redirect
 * their enrolled students to an arbitrary site. We only ever trust the meeting
 * hosts our providers emit:
 *   - Zoom join URLs are subdomains of zoom.us (e.g. us05web.zoom.us/j/...)
 *   - Google Meet links are meet.google.com/...
 * Shared with setSessionLink (src/app/actions/schedule.ts) so the action's
 * validation and this redirect's defense-in-depth check use one list.
 */
export const ALLOWED_JOIN_HOSTS = ['zoom.us', 'meet.google.com'] as const

/** True if `url` is an https URL whose host is (or is a subdomain of) an allowed meeting host. */
export function isAllowedJoinUrl(url: string): boolean {
  let host: string
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    host = u.hostname.toLowerCase()
  } catch {
    return false
  }
  return ALLOWED_JOIN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

/** A session is no longer joinable once it is marked done or its end time has passed. */
export function sessionEnded(
  session: { status: string; ends_at: string | null },
  now: Date,
): boolean {
  if (session.status === 'done') return true
  if (session.ends_at && new Date(session.ends_at).getTime() <= now.getTime()) return true
  return false
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params

  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const user = await getUser()
  if (!user) {
    return NextResponse.redirect(
      new URL(`/auth/sign-in?next=${encodeURIComponent(`/api/join/${sessionId}`)}`, req.url),
    )
  }

  const db = supabaseAdmin()
  const { data: session } = await db
    .from('sessions')
    .select('id, starts_at, ends_at, status, join_url, classroom_id, classrooms!inner(slug, teacher_id, teachers!inner(stripe_account_id))')
    .eq('id', sessionId)
    .single()

  if (!session || session.status === 'canceled') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  // Reject sessions that have already ended (status `done`, or `ends_at` in the
  // past) so a member with a stale session id isn't redirected into a dead
  // meeting indefinitely. Send them to the class page with an "ended" notice,
  // matching how locked/pending cases redirect there.
  if (sessionEnded(session, new Date())) {
    return NextResponse.redirect(
      new URL(`/my/${(session as any).classrooms.slug}?ended=1`, req.url),
    )
  }

  const isTeacher = (session as any).classrooms.teacher_id === user.id
  if (!isTeacher) {
    const stripeAccountId = (session as any).classrooms.teachers?.stripe_account_id as string | null
    let membership: { status: string; current_period_end?: string | null } | null = null
    if (stripeAccountId) {
      membership = await getFreshMembership({
        studentId: user.id,
        classroomId: session.classroom_id,
        stripeAccountId,
        checkoutSessionId: new URL(req.url).searchParams.get('cs') ?? undefined,
      })
    } else {
      const { data } = await db
        .from('memberships')
        .select('status, current_period_end, stripe_subscription_id')
        .eq('student_id', user.id)
        .eq('classroom_id', session.classroom_id)
        .maybeSingle()
      membership = data
    }

    const ok = canJoin({
      membershipStatus: membership?.status ?? null,
      currentPeriodEnd: membership?.current_period_end ?? null,
      sessionStartsAt: new Date(session.starts_at),
      now: new Date(),
    })
    if (!ok) {
      return NextResponse.redirect(
        new URL(`/my/${(session as any).classrooms.slug}?locked=1`, req.url),
      )
    }
  }

  if (!session.join_url) {
    return NextResponse.redirect(
      new URL(`/my/${(session as any).classrooms.slug}?pending=1`, req.url),
    )
  }

  // Defense-in-depth: even though setSessionLink validates the host on write,
  // re-check here before redirecting so a row written before this guard existed
  // (or by any other path) can't be used as an open redirect.
  if (!isAllowedJoinUrl(session.join_url)) {
    return NextResponse.redirect(
      new URL(`/my/${(session as any).classrooms.slug}?pending=1`, req.url),
    )
  }

  return NextResponse.redirect(session.join_url)
}
