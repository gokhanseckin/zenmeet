import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  getValidAccessToken: vi.fn(async () => 'access-token'),
  teacherTokenStore: vi.fn(() => ({ store: true })),
  refreshGoogle: vi.fn(),
  refreshZoom: vi.fn(),
  googleCreate: vi.fn(),
  googleDelete: vi.fn(async () => {}),
  zoomCreate: vi.fn(),
  zoomDelete: vi.fn(async () => {}),
}))

vi.mock('@/lib/providers/store', () => ({
  teacherTokenStore: mocks.teacherTokenStore,
}))

vi.mock('@/lib/providers/tokens', () => ({
  getValidAccessToken: mocks.getValidAccessToken,
}))

vi.mock('@/lib/providers/google', () => ({
  refreshGoogle: mocks.refreshGoogle,
  googleProvider: {
    createMeeting: mocks.googleCreate,
    deleteMeeting: mocks.googleDelete,
  },
}))

vi.mock('@/lib/providers/zoom', () => ({
  refreshZoom: mocks.refreshZoom,
  zoomProvider: {
    createMeeting: mocks.zoomCreate,
    deleteMeeting: mocks.zoomDelete,
  },
}))

import { liveMeetingCreator } from '@/lib/cron/supabase-db'
import type { ProvisionTarget } from '@/lib/cron/tick'

const target: ProvisionTarget = {
  sessionKey: 'sess-1',
  classroomId: 'cls-1',
  teacherId: 'teacher-1',
  provider: 'meet',
  title: 'Class',
  startsAt: new Date('2026-06-15T10:00:00Z'),
  endsAt: new Date('2026-06-15T11:00:00Z'),
  timezone: 'UTC',
  attempts: 0,
}

describe('liveMeetingCreator', () => {
  it('wires loser meeting cleanup to the selected provider', async () => {
    await liveMeetingCreator().deleteMeeting?.('event-1', target)

    expect(mocks.teacherTokenStore).toHaveBeenCalledWith('teacher-1', 'google')
    expect(mocks.getValidAccessToken).toHaveBeenCalled()
    expect(mocks.googleDelete).toHaveBeenCalledWith({
      accessToken: 'access-token',
      providerMeetingId: 'event-1',
    })
  })
})
