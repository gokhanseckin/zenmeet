import { describe, it, expect, vi } from 'vitest'
import { safeNext } from '@/lib/redirects'

const O = 'http://localhost:3000'

describe('safeNext', () => {
  it('keeps relative paths with query', () => expect(safeNext('/my/aiko?cs=1', O)).toBe('/my/aiko?cs=1'))
  it('rejects protocol-relative', () => expect(safeNext('//evil.com/x', O)).toBe('/'))
  it('rejects backslash tricks', () => {
    expect(safeNext('/\\evil.com', O)).toBe('/')
    expect(safeNext('/\\/evil.com', O)).toBe('/')
  })
  it('rejects absolute external URLs', () => expect(safeNext('https://evil.com/x', O)).toBe('/'))
  it('falls back to / on garbage', () => expect(safeNext(undefined, O)).toBe('/'))
})

describe('/auth/confirm redirects', () => {
  it('uses APP_URL, not the request host, after a valid token and hostile next', async () => {
    vi.resetModules()
    vi.doMock('server-only', () => ({}))
    vi.doMock('@/lib/env', () => ({
      env: () => ({ APP_URL: 'https://app.example' }),
    }))
    vi.doMock('@/lib/supabase/server', () => ({
      supabaseServer: async () => ({
        auth: {
          verifyOtp: async () => ({ error: null }),
          exchangeCodeForSession: async () => ({ error: null }),
        },
      }),
    }))
    const { GET } = await import('@/app/auth/confirm/route')

    const res = await GET(new Request(
      'https://evil.example/auth/confirm?token_hash=tok&type=email&next=https://evil.example/pwn',
    ) as any)

    expect(res.headers.get('location')).toBe('https://app.example/')
  })
})
