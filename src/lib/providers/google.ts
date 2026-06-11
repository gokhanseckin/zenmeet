import { randomUUID } from 'node:crypto'
import { env } from '@/lib/env'
import type { MeetingProvider, RefreshFn, StoredTokens } from './types'

async function tokenRequest(params: Record<string, string>): Promise<StoredTokens> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env().GOOGLE_CLIENT_ID, client_secret: env().GOOGLE_CLIENT_SECRET, ...params }),
  })
  if (!res.ok) throw new Error(`google token: ${res.status} ${await res.text()}`)
  const j = await res.json()
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? params.refresh_token!, // refresh responses omit it
    expires_at: Date.now() + j.expires_in * 1000,
  }
}

export const exchangeGoogleCode = (code: string) => tokenRequest({
  grant_type: 'authorization_code', code, redirect_uri: `${env().APP_URL}/api/oauth/google/callback`,
})
export const refreshGoogle: RefreshFn = (refreshToken) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })

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
    if (!res.ok) throw new Error(`google create: ${res.status} ${await res.text()}`)
    const j = await res.json()
    const joinUrl = j.hangoutLink
      ?? j.conferenceData?.entryPoints?.find((e: any) => e.entryPointType === 'video')?.uri
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
