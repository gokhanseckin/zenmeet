import { describe, it, expect, vi, beforeEach } from 'vitest'

// schedule.ts and the join route it imports transitively pull in `server-only`
// via @/lib/auth and @/lib/supabase/admin. Neutralize it; all deps are faked.
vi.mock('server-only', () => ({}))

vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'teacher_1' })),
}))

const SESSION_ID = 'e13f3335-be80-4b09-b775-d3cd2c160ca0'
let capturedUpdateRow: Record<string, unknown> | null = null

// Session row owned by teacher_1.
const sessionRow = { id: SESSION_ID, classrooms: { teacher_id: 'teacher_1' } }

function makeDb() {
  return {
    from(table: string) {
      if (table === 'sessions') {
        const c: any = {
          select() { return c },
          eq() { return c },
          single() { return Promise.resolve({ data: sessionRow, error: null }) },
          update(row: Record<string, unknown>) {
            capturedUpdateRow = row
            return { eq() { return Promise.resolve({ error: null }) } }
          },
        }
        return c
      }
      const c: any = { select() { return c }, eq() { return c }, single() { return Promise.resolve({ data: null, error: null }) } }
      return c
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({ supabaseAdmin: () => makeDb() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { setSessionLink } from '@/app/actions/schedule'

beforeEach(() => { capturedUpdateRow = null })

describe('setSessionLink — join_url host allowlist', () => {
  it('rejects a non-provider host without writing', async () => {
    const r = await setSessionLink(SESSION_ID, 'https://evil.com/phish')
    expect('error' in r).toBe(true)
    expect(capturedUpdateRow).toBeNull()
  })

  it('rejects a look-alike host (evilzoom.us)', async () => {
    const r = await setSessionLink(SESSION_ID, 'https://evilzoom.us/j/1')
    expect('error' in r).toBe(true)
    expect(capturedUpdateRow).toBeNull()
  })

  it('rejects an http (non-https) zoom URL', async () => {
    const r = await setSessionLink(SESSION_ID, 'http://zoom.us/j/1')
    expect('error' in r).toBe(true)
    expect(capturedUpdateRow).toBeNull()
  })

  it('accepts a Zoom URL and persists it', async () => {
    const url = 'https://us05web.zoom.us/j/123456789?pwd=abc'
    const r = await setSessionLink(SESSION_ID, url)
    expect('error' in r).toBe(false)
    expect(capturedUpdateRow).toEqual({ join_url: url })
  })

  it('accepts a Google Meet URL and persists it', async () => {
    const url = 'https://meet.google.com/abc-defg-hij'
    const r = await setSessionLink(SESSION_ID, url)
    expect('error' in r).toBe(false)
    expect(capturedUpdateRow).toEqual({ join_url: url })
  })
})
