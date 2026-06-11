import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { env } from '@/lib/env'
import { getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/sign-in?next=/onboarding', req.url))
  const state = randomBytes(16).toString('hex')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', env().GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', `${env().APP_URL}/api/oauth/google/callback`)
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')
  url.searchParams.set('state', state)
  const res = NextResponse.redirect(url)
  res.cookies.set('oauth_state_google', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  })
  return res
}
