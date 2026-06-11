import { NextResponse, NextRequest } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', req.url), 303)
}
