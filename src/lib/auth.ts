import 'server-only'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function getUser() {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function requireUser(nextPath: string) {
  const user = await getUser()
  if (!user) redirect(`/auth/sign-in?next=${encodeURIComponent(nextPath)}`)
  return user
}

/** Idempotently ensure a role row exists; returns it. */
export async function ensureTeacher(userId: string) {
  const db = supabaseAdmin()
  await db.from('teachers').upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })
  const { data, error } = await db.from('teachers').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}

export async function ensureStudent(userId: string, email: string) {
  const db = supabaseAdmin()
  await db.from('students').upsert({ id: userId, email }, { onConflict: 'id', ignoreDuplicates: true })
  const { data, error } = await db.from('students').select('*').eq('id', userId).single()
  if (error) throw error
  return data
}
