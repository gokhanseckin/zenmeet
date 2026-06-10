import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { env } from '@/lib/env'
import { getUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/auth/sign-in?next=/onboarding', req.url))
  const state = randomBytes(16).toString('hex')
  const url = new URL('https://connect.stripe.com/oauth/authorize')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', env().STRIPE_CONNECT_CLIENT_ID)
  url.searchParams.set('scope', 'read_write')
  url.searchParams.set('redirect_uri', `${env().APP_URL}/api/oauth/stripe/callback`)
  url.searchParams.set('state', state)
  const res = NextResponse.redirect(url)
  res.cookies.set('oauth_state_stripe', state, { httpOnly: true, sameSite: 'lax', maxAge: 600, path: '/' })
  return res
}
