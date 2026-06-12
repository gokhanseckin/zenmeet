import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const ids = {
  userA: '11111111-1111-4111-8111-111111111111',
  userB: '22222222-2222-4222-8222-222222222222',
}

const mocks = vi.hoisted(() => ({
  currentUser: null as null | { id: string },
  exchangeGoogleCode: vi.fn(async () => ({ access_token: 'ga', refresh_token: 'gr', expires_at: 1 })),
  exchangeZoomCode: vi.fn(async () => ({ access_token: 'za', refresh_token: 'zr', expires_at: 1 })),
  saveTeacherTokens: vi.fn(async () => undefined),
  ensureTeacher: vi.fn(async () => undefined),
  stripeToken: vi.fn(async () => ({ stripe_user_id: 'acct_123' })),
  teacherUpdate: vi.fn(() => ({ eq: mocks.teacherEq })),
  teacherEq: vi.fn(async () => ({ error: null })),
}))

vi.mock('@/lib/auth', () => ({
  getUser: async () => mocks.currentUser,
  ensureTeacher: mocks.ensureTeacher,
}))

vi.mock('@/lib/env', () => ({
  env: () => ({
    APP_URL: 'https://app.example.test',
    GOOGLE_CLIENT_ID: 'google-client',
    ZOOM_CLIENT_ID: 'zoom-client',
    STRIPE_CONNECT_CLIENT_ID: 'stripe-client',
  }),
  tokenEnv: () => ({
    TOKEN_ENC_KEY: Buffer.from('oauth-state-test-secret-32-bytes!').toString('base64'),
  }),
}))

vi.mock('@/lib/providers/google', () => ({
  exchangeGoogleCode: mocks.exchangeGoogleCode,
}))

vi.mock('@/lib/providers/zoom', () => ({
  exchangeZoomCode: mocks.exchangeZoomCode,
}))

vi.mock('@/lib/providers/store', () => ({
  saveTeacherTokens: mocks.saveTeacherTokens,
}))

vi.mock('@/lib/stripe', () => ({
  stripe: () => ({ oauth: { token: mocks.stripeToken } }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({
    from: () => ({ update: mocks.teacherUpdate }),
  }),
}))

type ProviderCase = {
  name: 'google' | 'zoom' | 'stripe'
  startPath: string
  callbackPath: string
  cookieName: string
  authHost: string
  expectedSuccessPath: string
  expectedFailurePath: string
  start: (req: NextRequest) => Promise<Response>
  callback: (req: NextRequest) => Promise<Response>
  exchangeMock: ReturnType<typeof vi.fn>
}

function req(path: string, cookie?: string) {
  return new NextRequest(`https://app.example.test${path}`, {
    headers: cookie ? { cookie } : undefined,
  })
}

function redirectLocation(res: Response) {
  const location = res.headers.get('location')
  if (!location) throw new Error('missing redirect location')
  return new URL(location)
}

function cookieFrom(res: Response, cookieName: string) {
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`))
  if (!match) throw new Error(`missing ${cookieName} cookie`)
  return `${cookieName}=${match[1]}`
}

function expectClearedCookie(res: Response, cookieName: string) {
  const setCookie = res.headers.get('set-cookie') ?? ''
  expect(setCookie).toContain(`${cookieName}=`)
  expect(setCookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT/)
}

const googleStart = await import('@/app/api/oauth/google/start/route')
const googleCallback = await import('@/app/api/oauth/google/callback/route')
const zoomStart = await import('@/app/api/oauth/zoom/start/route')
const zoomCallback = await import('@/app/api/oauth/zoom/callback/route')
const stripeStart = await import('@/app/api/oauth/stripe/start/route')
const stripeCallback = await import('@/app/api/oauth/stripe/callback/route')

describe('OAuth state binding', () => {
  const providers: ProviderCase[] = [
    {
      name: 'google',
      startPath: '/api/oauth/google/start',
      callbackPath: '/api/oauth/google/callback',
      cookieName: 'oauth_state_google',
      authHost: 'accounts.google.com',
      expectedSuccessPath: '/onboarding?step=schedule',
      expectedFailurePath: '/onboarding?step=provider&error=oauth',
      start: googleStart.GET,
      callback: googleCallback.GET,
      exchangeMock: mocks.exchangeGoogleCode,
    },
    {
      name: 'zoom',
      startPath: '/api/oauth/zoom/start',
      callbackPath: '/api/oauth/zoom/callback',
      cookieName: 'oauth_state_zoom',
      authHost: 'zoom.us',
      expectedSuccessPath: '/onboarding?step=schedule',
      expectedFailurePath: '/onboarding?step=provider&error=oauth',
      start: zoomStart.GET,
      callback: zoomCallback.GET,
      exchangeMock: mocks.exchangeZoomCode,
    },
    {
      name: 'stripe',
      startPath: '/api/oauth/stripe/start',
      callbackPath: '/api/oauth/stripe/callback',
      cookieName: 'oauth_state_stripe',
      authHost: 'connect.stripe.com',
      expectedSuccessPath: '/onboarding?step=provider',
      expectedFailurePath: '/onboarding?step=stripe&error=oauth',
      start: stripeStart.GET,
      callback: stripeCallback.GET,
      exchangeMock: mocks.stripeToken,
    },
  ]

  beforeEach(() => {
    mocks.currentUser = { id: ids.userA }
    vi.clearAllMocks()
  })

  for (const provider of providers) {
    it(`${provider.name} start sends an opaque provider state without the user id`, async () => {
      const res = await provider.start(req(provider.startPath))
      const authUrl = redirectLocation(res)
      const state = authUrl.searchParams.get('state')

      expect(authUrl.host).toBe(provider.authHost)
      expect(state).toBeTruthy()
      expect(state).not.toContain(ids.userA)
      expect(state).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
      expect(cookieFrom(res, provider.cookieName)).toContain(`${provider.cookieName}=`)
    })

    it(`${provider.name} callback rejects a state started by a different user`, async () => {
      const startRes = await provider.start(req(provider.startPath))
      const authUrl = redirectLocation(startRes)
      const cookie = cookieFrom(startRes, provider.cookieName)

      mocks.currentUser = { id: ids.userB }
      const res = await provider.callback(req(
        `${provider.callbackPath}?code=code-123&state=${authUrl.searchParams.get('state')}`,
        cookie,
      ))

      expect(redirectLocation(res).pathname + redirectLocation(res).search)
        .toBe(provider.expectedFailurePath)
      expect(provider.exchangeMock).not.toHaveBeenCalled()
      expectClearedCookie(res, provider.cookieName)
    })

    it(`${provider.name} callback accepts the matching user and clears single-use state`, async () => {
      const startRes = await provider.start(req(provider.startPath))
      const authUrl = redirectLocation(startRes)
      const cookie = cookieFrom(startRes, provider.cookieName)

      const res = await provider.callback(req(
        `${provider.callbackPath}?code=code-123&state=${authUrl.searchParams.get('state')}`,
        cookie,
      ))

      expect(redirectLocation(res).pathname + redirectLocation(res).search)
        .toBe(provider.expectedSuccessPath)
      expect(provider.exchangeMock).toHaveBeenCalledTimes(1)
      expectClearedCookie(res, provider.cookieName)
    })
  }
})
