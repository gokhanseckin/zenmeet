import { describe, it, expect, vi, afterEach } from 'vitest'
import { zoomProvider, exchangeZoomCode, refreshZoom } from '@/lib/providers/zoom'
import { InvalidGrantError } from '@/lib/providers/tokens'

// zoom.ts calls env() only for the Basic-auth header on token requests.
vi.mock('@/lib/env', () => ({
  env: () => ({ ZOOM_CLIENT_ID: 'cid', ZOOM_CLIENT_SECRET: 'csecret', APP_URL: 'https://www.zenmeet.me' }),
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

const args = {
  accessToken: 'A',
  title: 'Lesson 1',
  startsAt: new Date('2026-06-15T10:00:00.000Z'),
  endsAt: new Date('2026-06-15T11:00:00.000Z'),
  timezone: 'Europe/Istanbul',
}

describe('zoomProvider.createMeeting', () => {
  it('posts a scheduled meeting and returns join url + stringified id', async () => {
    const fetchMock = stubFetch(201, { id: 99887766, join_url: 'https://zoom.us/j/99887766' })
    const out = await zoomProvider.createMeeting(args)
    expect(out).toEqual({ joinUrl: 'https://zoom.us/j/99887766', providerMeetingId: '99887766' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.zoom.us/v2/users/me/meetings')
    const sent = JSON.parse(init.body as string)
    expect(sent.type).toBe(2)
    expect(sent.duration).toBe(60)
    expect(sent.start_time).toBe('2026-06-15T10:00:00Z') // no milliseconds
    expect(init.headers).toMatchObject({ Authorization: 'Bearer A' })
  })

  it('rejects a sub-minute duration before calling fetch', async () => {
    const fetchMock = stubFetch(201, {})
    await expect(zoomProvider.createMeeting({ ...args, endsAt: args.startsAt }))
      .rejects.toThrow(/duration must be >= 1 minute/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws on a non-ok create response', async () => {
    stubFetch(400, { code: 300, message: 'bad' })
    await expect(zoomProvider.createMeeting(args)).rejects.toThrow(/zoom create: 400/)
  })
})

describe('zoomProvider.deleteMeeting', () => {
  it('treats 404 as success (idempotent)', async () => {
    stubFetch(404, {})
    await expect(zoomProvider.deleteMeeting({ accessToken: 'A', providerMeetingId: '1' }))
      .resolves.toBeUndefined()
  })
  it('throws on other non-ok delete responses', async () => {
    stubFetch(500, {})
    await expect(zoomProvider.deleteMeeting({ accessToken: 'A', providerMeetingId: '1' }))
      .rejects.toThrow(/zoom delete: 500/)
  })
})

describe('zoom token requests', () => {
  it('exchanges an auth code into stored tokens with computed expiry', async () => {
    const fetchMock = stubFetch(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 })
    const before = Date.now()
    const tokens = await exchangeZoomCode('the-code')
    expect(tokens.access_token).toBe('AT')
    expect(tokens.refresh_token).toBe('RT')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 3600 * 1000 - 50)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://zoom.us/oauth/token')
    // Basic auth = base64("cid:csecret")
    expect((init.headers as Record<string, string>).Authorization)
      .toBe(`Basic ${Buffer.from('cid:csecret').toString('base64')}`)
    expect(init.body!.toString()).toContain('grant_type=authorization_code')
    expect(init.body!.toString()).toContain('redirect_uri=https%3A%2F%2Fwww.zenmeet.me%2Fapi%2Foauth%2Fzoom%2Fcallback')
  })

  it('refreshes with grant_type=refresh_token', async () => {
    const fetchMock = stubFetch(200, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 })
    const tokens = await refreshZoom('old-refresh')
    expect(tokens.access_token).toBe('AT2')
    expect(fetchMock.mock.calls[0][1]!.body!.toString()).toContain('grant_type=refresh_token')
    expect(fetchMock.mock.calls[0][1]!.body!.toString()).toContain('refresh_token=old-refresh')
  })

  it('throws on a non-ok token response', async () => {
    stubFetch(401, { error: 'invalid_client' })
    await expect(exchangeZoomCode('x')).rejects.toThrow(/zoom token: 401/)
  })

  it('throws InvalidGrantError when the provider rejects the refresh token', async () => {
    stubFetch(400, { error: 'invalid_grant', reason: 'Invalid Token!' })
    await expect(refreshZoom('dead')).rejects.toThrow(InvalidGrantError)
  })

  it('rejects a malformed token response (missing expires_in)', async () => {
    stubFetch(200, { access_token: 'AT', refresh_token: 'RT' })
    await expect(exchangeZoomCode('x')).rejects.toThrow(/malformed response/)
  })

  it('rejects a malformed token response (undefined access_token)', async () => {
    stubFetch(200, { refresh_token: 'RT', expires_in: 3600 })
    await expect(exchangeZoomCode('x')).rejects.toThrow(/malformed response/)
  })

  it('rejects a malformed create response (missing join_url)', async () => {
    stubFetch(201, { id: 123 })
    await expect(zoomProvider.createMeeting(args)).rejects.toThrow(/malformed response/)
  })
})
