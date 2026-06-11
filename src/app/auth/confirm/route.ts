import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { safeNext } from '@/lib/redirects'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token_hash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'), url.origin)
  // The default (free-tier) Supabase email sends a PKCE `?code=` link; a custom
  // token_hash template (Pro/custom SMTP) sends `?token_hash=&type=`. Handle both.
  if (code || (token_hash && type)) {
    try {
      const supabase = await supabaseServer()
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) return NextResponse.redirect(new URL(next, url.origin))
      } else if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({ type, token_hash })
        if (!error) return NextResponse.redirect(new URL(next, url.origin))
      }
    } catch {
      // fall through to the error redirect below
    }
  }
  return NextResponse.redirect(new URL('/auth/sign-in?error=link', url.origin))
}
