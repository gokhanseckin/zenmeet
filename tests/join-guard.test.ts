import { describe, it, expect, vi } from 'vitest'

// The join route module transitively imports `server-only` (via @/lib/auth and
// @/lib/supabase/admin), whose real entry throws under vitest's node env. We only
// exercise the pure exported guards here, so neutralize it.
vi.mock('server-only', () => ({}))

import { isAllowedJoinUrl, sessionEnded, ALLOWED_JOIN_HOSTS } from '@/app/api/join/[sessionId]/route'

describe('isAllowedJoinUrl (open-redirect allowlist)', () => {
  it('accepts a Google Meet link', () => {
    expect(isAllowedJoinUrl('https://meet.google.com/abc-defg-hij')).toBe(true)
  })
  it('accepts a Zoom join URL on a regional subdomain', () => {
    expect(isAllowedJoinUrl('https://us05web.zoom.us/j/123456789?pwd=xyz')).toBe(true)
  })
  it('accepts the bare zoom.us host', () => {
    expect(isAllowedJoinUrl('https://zoom.us/j/123')).toBe(true)
  })
  it('rejects a non-provider host', () => {
    expect(isAllowedJoinUrl('https://evil.com/phish')).toBe(false)
  })
  it('rejects a look-alike suffix host', () => {
    // not a subdomain of zoom.us — the registrable host is notzoom.us
    expect(isAllowedJoinUrl('https://evilzoom.us/j/1')).toBe(false)
    expect(isAllowedJoinUrl('https://meet.google.com.evil.com/x')).toBe(false)
  })
  it('rejects non-https schemes', () => {
    expect(isAllowedJoinUrl('http://zoom.us/j/1')).toBe(false)
    expect(isAllowedJoinUrl('javascript:alert(1)')).toBe(false)
  })
  it('rejects garbage / non-URLs', () => {
    expect(isAllowedJoinUrl('not a url')).toBe(false)
    expect(isAllowedJoinUrl('')).toBe(false)
  })
  it('exposes the exact allowlist', () => {
    expect([...ALLOWED_JOIN_HOSTS].sort()).toEqual(['meet.google.com', 'zoom.us'])
  })
})

describe('sessionEnded (stale-session rejection)', () => {
  const now = new Date('2026-06-15T12:00:00Z')

  it('treats a done session as ended', () => {
    expect(sessionEnded({ status: 'done', ends_at: '2026-06-15T13:00:00Z' }, now)).toBe(true)
  })
  it('treats a session whose ends_at is in the past as ended', () => {
    expect(sessionEnded({ status: 'scheduled', ends_at: '2026-06-15T11:59:59Z' }, now)).toBe(true)
  })
  it('treats ends_at exactly equal to now as ended', () => {
    expect(sessionEnded({ status: 'scheduled', ends_at: '2026-06-15T12:00:00Z' }, now)).toBe(true)
  })
  it('allows a live session whose end is still in the future', () => {
    expect(sessionEnded({ status: 'live', ends_at: '2026-06-15T13:00:00Z' }, now)).toBe(false)
  })
  it('allows an upcoming scheduled session', () => {
    expect(sessionEnded({ status: 'scheduled', ends_at: '2026-06-15T13:00:00Z' }, now)).toBe(false)
  })
})
