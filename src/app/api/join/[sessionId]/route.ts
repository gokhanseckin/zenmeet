import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canJoin } from '@/lib/unlock'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    .select('id, starts_at, status, join_url, classroom_id, classrooms!inner(slug, teacher_id)')
    .eq('id', sessionId)
    .single()

  if (!session || session.status === 'canceled') {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const isTeacher = (session as any).classrooms.teacher_id === user.id
  if (!isTeacher) {
    const { data: membership } = await db
      .from('memberships')
      .select('status')
      .eq('student_id', user.id)
      .eq('classroom_id', session.classroom_id)
      .maybeSingle()

    const ok = canJoin({
      membershipStatus: membership?.status ?? null,
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

  return NextResponse.redirect(session.join_url)
}
