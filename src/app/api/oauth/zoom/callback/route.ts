import { NextRequest, NextResponse } from 'next/server'
import { getUser, ensureTeacher } from '@/lib/auth'
import { exchangeZoomCode } from '@/lib/providers/zoom'
import { saveTeacherTokens } from '@/lib/providers/store'

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
  // CSRF: nonce double-submit (state === cookieState) AND the user-id bound
  // into the state at /start must match the current session's user.
  const boundUserId = state?.split('.')[1]
  if (
    !user ||
    !code ||
    !state ||
    !cookieState ||
    state !== cookieState ||
    boundUserId !== user.id
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
