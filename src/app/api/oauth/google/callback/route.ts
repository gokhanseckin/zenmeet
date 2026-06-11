import { NextRequest, NextResponse } from 'next/server'
import { getUser, ensureTeacher } from '@/lib/auth'
import { exchangeGoogleCode } from '@/lib/providers/google'
import { saveTeacherTokens } from '@/lib/providers/store'

/** Single-use state nonce: clear the cookie on every exit path. */
function redirectClearingState(url: URL) {
  const res = NextResponse.redirect(url)
  res.cookies.delete('oauth_state_google')
  return res
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('oauth_state_google')?.value
  const user = await getUser()
  if (!user || !code || !state || !cookieState || state !== cookieState) {
    return redirectClearingState(new URL('/onboarding?step=provider&error=oauth', req.url))
  }
  try {
    const tokens = await exchangeGoogleCode(code)
    await ensureTeacher(user.id)
    await saveTeacherTokens(user.id, 'google', tokens)
    return redirectClearingState(new URL('/onboarding?step=schedule', req.url))
  } catch {
    return redirectClearingState(new URL('/onboarding?step=provider&error=oauth', req.url))
  }
}
