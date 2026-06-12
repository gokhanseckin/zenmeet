import { z } from 'zod'
import { env } from '@/lib/env'
import type { MeetingProvider, RefreshFn, StoredTokens } from './types'
import { InvalidGrantError } from './tokens'

const basicAuth = () => Buffer.from(`${env().ZOOM_CLIENT_ID}:${env().ZOOM_CLIENT_SECRET}`).toString('base64')

// Validate the OAuth token response at the boundary so a malformed body can't
// store NaN expiry or an undefined access token into the DB.
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
})

async function tokenRequest(params: Record<string, string>): Promise<StoredTokens> {
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[zoom] token request failed: ${res.status}`, body)
    if (body.includes('invalid_grant')) throw new InvalidGrantError(`zoom token: ${res.status} invalid_grant`)
    throw new Error(`zoom token: ${res.status}`)
  }
  const parsed = tokenResponseSchema.safeParse(await res.json())
  if (!parsed.success) throw new Error(`zoom token: malformed response: ${parsed.error.message}`)
  const j = parsed.data
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000 }
}

export const exchangeZoomCode = (code: string) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: `${env().APP_URL}/api/oauth/zoom/callback` })

export const refreshZoom: RefreshFn = (refreshToken) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })

// Validate the create-meeting response so a missing join_url/id surfaces here
// rather than persisting an undefined join link downstream.
const createMeetingSchema = z.object({
  id: z.union([z.number(), z.string()]),
  join_url: z.string().url(),
})

export const zoomProvider: MeetingProvider = {
  async createMeeting({ accessToken, title, startsAt, endsAt, timezone }) {
    const duration = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000)
    if (duration < 1) throw new Error('zoom create: duration must be >= 1 minute')
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: title, type: 2,
        start_time: startsAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        duration,
        timezone,
        settings: { waiting_room: false, join_before_host: true, approval_type: 2 },
      }),
    })
    if (!res.ok) {
      console.error(`[zoom] create meeting failed: ${res.status}`, await res.text())
      throw new Error(`zoom create: ${res.status}`)
    }
    const parsed = createMeetingSchema.safeParse(await res.json())
    if (!parsed.success) throw new Error(`zoom create: malformed response: ${parsed.error.message}`)
    return { joinUrl: parsed.data.join_url, providerMeetingId: String(parsed.data.id) }
  },
  async deleteMeeting({ accessToken, providerMeetingId }) {
    const res = await fetch(`https://api.zoom.us/v2/meetings/${providerMeetingId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok && res.status !== 404) throw new Error(`zoom delete: ${res.status}`)
  },
}
