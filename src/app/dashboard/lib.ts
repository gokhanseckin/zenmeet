import 'server-only'
import { redirect } from 'next/navigation'
import { requireUser, ensureTeacher } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function loadDashboard(selectedId?: string) {
  const user = await requireUser('/dashboard')
  const teacher = await ensureTeacher(user.id)
  const db = supabaseAdmin()
  const { data: classrooms } = await db.from('classrooms').select('*')
    .eq('teacher_id', user.id).order('created_at')
  if (!classrooms?.length) redirect('/onboarding')
  const classroom = classrooms.find(c => c.id === selectedId) ?? classrooms[0]
  return { user, teacher, classrooms, classroom, db }
}
