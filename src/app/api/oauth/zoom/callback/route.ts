import { NextRequest, NextResponse } from 'next/server'
import { getUser, ensureTeacher } from '@/lib/auth'
import { exchangeZoomCode } from '@/lib/providers/zoom'
import { saveTeacherTokens } from '@/lib/providers/store'
import { verifyOAuthState } from '@/lib/oauth-state'

/** Single-use state nonce: clear the cookie on every exit path. */
function redirectClearingState(url: URL) {
  const res = NextResponse.redirect(url)
  res.cookies.delete('oauth_state_zoom')
  return res
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const cookieState = req.cookies.get('oauth_state_zoom')?.value
  const user = await getUser()
  if (
    !user ||
    !code ||
    !verifyOAuthState({ provider: 'zoom', state, cookieValue: cookieState, userId: user.id })
  ) {
    return redirectClearingState(new URL('/onboarding?step=provider&error=oauth', req.url))
  }
  try {
    const tokens = await exchangeZoomCode(code)
    await ensureTeacher(user.id)
    await saveTeacherTokens(user.id, 'zoom', tokens)
    return redirectClearingState(new URL('/onboarding?step=schedule', req.url))
  } catch {
    return redirectClearingState(new URL('/onboarding?step=provider&error=oauth', req.url))
  }
}
