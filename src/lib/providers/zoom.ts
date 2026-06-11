import { env } from '@/lib/env'
import type { MeetingProvider, RefreshFn, StoredTokens } from './types'

const basicAuth = () => Buffer.from(`${env().ZOOM_CLIENT_ID}:${env().ZOOM_CLIENT_SECRET}`).toString('base64')

async function tokenRequest(params: Record<string, string>): Promise<StoredTokens> {
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basicAuth()}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  if (!res.ok) throw new Error(`zoom token: ${res.status} ${await res.text()}`)
  const j = await res.json()
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000 }
}

export const exchangeZoomCode = (code: string) =>
  tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: `${env().APP_URL}/api/oauth/zoom/callback` })

export const refreshZoom: RefreshFn = (refreshToken) =>
  tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })

export const zoomProvider: MeetingProvider = {
  async createMeeting({ accessToken, title, startsAt, endsAt, timezone }) {
    const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: title, type: 2,
        start_time: startsAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        duration: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
        timezone,
        settings: { waiting_room: false, join_before_host: true, approval_type: 2 },
      }),
    })
    if (!res.ok) throw new Error(`zoom create: ${res.status} ${await res.text()}`)
    const j = await res.json()
    return { joinUrl: j.join_url, providerMeetingId: String(j.id) }
  },
  async deleteMeeting({ accessToken, providerMeetingId }) {
    const res = await fetch(`https://api.zoom.us/v2/meetings/${providerMeetingId}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok && res.status !== 404) throw new Error(`zoom delete: ${res.status}`)
  },
}
