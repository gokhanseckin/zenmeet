import { describe, it, expect, vi, afterEach } from 'vitest'
import { exchangeGoogleCode, refreshGoogle, googleProvider } from '@/lib/providers/google'
import { InvalidGrantError } from '@/lib/providers/tokens'

vi.mock('@/lib/env', () => ({
  env: () => ({
    GOOGLE_CLIENT_ID: 'gid',
    GOOGLE_CLIENT_SECRET: 'gsecret',
    APP_URL: 'https://www.zenmeet.me',
  }),
}))

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

describe('google token requests', () => {
  it('exchanges an auth code into stored tokens', async () => {
    stubFetch(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 })
    const tokens = await exchangeGoogleCode('the-code')
    expect(tokens.access_token).toBe('AT')
    expect(tokens.refresh_token).toBe('RT')
  })

  it('reuses the sent refresh token when a refresh response omits it', async () => {
    stubFetch(200, { access_token: 'AT2', expires_in: 3600 })
    const tokens = await refreshGoogle('keep-me')
    expect(tokens.access_token).toBe('AT2')
    expect(tokens.refresh_token).toBe('keep-me')
  })

  it('surfaces a reconnect-with-consent error when initial exchange omits refresh_token', async () => {
    // Repeat consent: Google returns no refresh_token and there is no prior one
    // to fall back to. Must NOT persist undefined.
    stubFetch(200, { access_token: 'AT', expires_in: 3600 })
    await expect(exchangeGoogleCode('code')).rejects.toThrow(/reconnect Google with consent/)
  })

  it('throws InvalidGrantError when the refresh token is rejected', async () => {
    stubFetch(400, { error: 'invalid_grant' })
    await expect(refreshGoogle('dead')).rejects.toThrow(InvalidGrantError)
  })

  it('rejects a malformed token response', async () => {
    stubFetch(200, { refresh_token: 'RT', expires_in: 3600 })
    await expect(exchangeGoogleCode('x')).rejects.toThrow(/malformed response/)
  })
})

const args = {
  accessToken: 'A',
  title: 'Lesson',
  startsAt: new Date('2026-06-15T10:00:00.000Z'),
  endsAt: new Date('2026-06-15T11:00:00.000Z'),
  timezone: 'Europe/Istanbul',
}

describe('googleProvider.createMeeting', () => {
  it('returns the hangout link and event id', async () => {
    stubFetch(200, { id: 'evt_1', hangoutLink: 'https://meet.google.com/abc-defg-hij' })
    const out = await googleProvider.createMeeting(args)
    expect(out).toEqual({ joinUrl: 'https://meet.google.com/abc-defg-hij', providerMeetingId: 'evt_1' })
  })

  it('falls back to a conferenceData video entry point', async () => {
    stubFetch(200, {
      id: 'evt_2',
      conferenceData: { entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/xyz' }] },
    })
    const out = await googleProvider.createMeeting(args)
    expect(out.joinUrl).toBe('https://meet.google.com/xyz')
  })

  it('rejects a malformed create response (missing id)', async () => {
    stubFetch(200, { hangoutLink: 'https://meet.google.com/abc' })
    await expect(googleProvider.createMeeting(args)).rejects.toThrow(/malformed response/)
  })
})
