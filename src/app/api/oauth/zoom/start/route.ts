import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { env } from '@/lib/env'
import { getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/sign-in?next=/onboarding', req.url))
  // Bind the state nonce to the authenticated user so a stolen/forged state
  // from another session can't link a provider account to this teacher row.
  const state = `${randomBytes(16).toString('hex')}.${user.id}`
  const url = new URL('https://zoom.us/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', env().ZOOM_CLIENT_ID)
  url.searchParams.set('redirect_uri', `${env().APP_URL}/api/oauth/zoom/callback`)
  url.searchParams.set('state', state)
  const res = NextResponse.redirect(url)
  res.cookies.set('oauth_state_zoom', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return res
}
