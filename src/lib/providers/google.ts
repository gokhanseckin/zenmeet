import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { MeetingProvider, RefreshFn, StoredTokens } from './types'
import { InvalidGrantError } from './tokens'

// Google omits refresh_token on refresh grants and on repeat consent, so it is
// optional here — but we never persist an undefined one (see below).
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive(),
})

async function tokenRequest(params: Record<string, string>): Promise<StoredTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env().GOOGLE_CLIENT_ID, client_secret: env().GOOGLE_CLIENT_SECRET, ...params }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[google] token request failed: ${res.status}`, body)
    if (body.includes('invalid_grant')) throw new InvalidGrantError(`google token: ${res.status} invalid_grant`)
    throw new Error(`google token: ${res.status}`)
  }
  const parsed = tokenResponseSchema.safeParse(await res.json())
  if (!parsed.success) throw new Error(`google token: malformed response: ${parsed.error.message}`)
  const j = parsed.data
  // Resolve the refresh token without ever persisting undefined:
  //  - refresh grants omit refresh_token  -> reuse the one we sent
  //  - initial code exchange may omit it on repeat consent -> no fallback
  //    exists, so surface a clear reconnect-with-consent error instead of
  //    overwriting a stored token with undefined.
  const refresh_token = j.refresh_token ?? params.refresh_token
  if (!refresh_token) {
    throw new Error(
      'google token: no refresh_token returned — reconnect Google with consent (prompt=consent&access_type=offline)',
    )
  }
  return { access_token: j.access_token, refresh_token, expires_at: Date.now() + j.expires_in * 1000 }
}

export const exchangeGoogleCode = (code: string) => tokenRequest({
  grant_type: 'authorization_code', code, redirect_uri: `${env().APP_URL}/api/oauth/google/callback`,
})
export const refreshGoogle: RefreshFn = (refreshToken) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })

// Validate the create-event response so a missing meet link / id surfaces here.
const createEventSchema = z.object({
  id: z.string().min(1),
  hangoutLink: z.string().url().optional(),
  conferenceData: z
    .object({
      entryPoints: z
        .array(z.object({ entryPointType: z.string(), uri: z.string() }))
        .optional(),
    })
    .optional(),
})

export const googleProvider: MeetingProvider = {
  async createMeeting({ accessToken, title, startsAt, endsAt, timezone }) {
    const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: startsAt.toISOString(), timeZone: timezone },
        end: { dateTime: endsAt.toISOString(), timeZone: timezone },
        conferenceData: { createRequest: { requestId: randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      }),
    })
    if (!res.ok) {
      console.error(`[google] create event failed: ${res.status}`, await res.text())
      throw new Error(`google create: ${res.status}`)
    }
    const parsed = createEventSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error(`google create: malformed response: ${parsed.error.message}`)
    const j = parsed.data
    const joinUrl = j.hangoutLink
      ?? j.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri
    if (!joinUrl) throw new Error('google create: no meet link on event')
    return { joinUrl, providerMeetingId: j.id }
  },
  async deleteMeeting({ accessToken, providerMeetingId }) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${providerMeetingId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`google delete: ${res.status}`)
  },
}
