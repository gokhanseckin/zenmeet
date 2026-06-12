import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { getUser } from '@/lib/auth'
import { createOAuthState } from '@/lib/oauth-state'

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/sign-in?next=/onboarding', req.url))
  const { state, cookieValue } = createOAuthState('zoom', user.id)
  const url = new URL('https://zoom.us/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', env().ZOOM_CLIENT_ID)
  url.searchParams.set('redirect_uri', `${env().APP_URL}/api/oauth/zoom/callback`)
  url.searchParams.set('state', state)
  const res = NextResponse.redirect(url)
  res.cookies.set('oauth_state_zoom', cookieValue, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return res
}
