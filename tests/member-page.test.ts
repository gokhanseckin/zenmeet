import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const requireUser = vi.fn(async (_next?: string) => ({ id: 'student_1' }))
const getFreshMembership = vi.fn()
let classroom: Record<string, any> | null
let sessionQueries: number

vi.mock('@/lib/auth', () => ({
  requireUser: (next?: string) => requireUser(next),
}))

vi.mock('@/lib/membership', () => ({
  getFreshMembership: (args: unknown) => getFreshMembership(args),
}))

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND')
  },
}))

function tableBuilder(table: string) {
  const builder: any = {
    select() { return builder },
    eq() { return builder },
    gt() { return builder },
    order() { return builder },
    limit() { return builder },
    single() {
      if (table === 'classrooms') return Promise.resolve({ data: classroom })
      return Promise.resolve({ data: null })
    },
    maybeSingle() { return Promise.resolve({ data: null }) },
    then(resolve: any) {
      if (table === 'sessions') {
        sessionQueries += 1
        return Promise.resolve({ data: [{
          id: 'sess_1',
          starts_at: '2026-06-20T10:00:00.000Z',
          ends_at: '2026-06-20T11:00:00.000Z',
          join_url: 'https://meet.google.com/abc-defg-hij',
        }] }).then(resolve)
      }
      return Promise.resolve({ data: null }).then(resolve)
    },
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => tableBuilder(table),
  }),
}))

import MemberHome from '@/app/my/[slug]/page'

function renderMemberHome() {
  return MemberHome({
    params: Promise.resolve({ slug: 'private-class' }),
    searchParams: Promise.resolve({}),
  })
}

beforeEach(() => {
  requireUser.mockClear()
  getFreshMembership.mockReset()
  sessionQueries = 0
  classroom = {
    id: 'cls_1',
    slug: 'private-class',
    title: 'Private Strategy Session',
    provider: 'zoom',
    status: 'draft',
    teacher_id: 'teacher_1',
    teachers: { stripe_account_id: 'acct_1', timezone: 'UTC' },
  }
})

describe('/my/[slug] private metadata gating', () => {
  it('does not read sessions for an authenticated non-member of a draft class', async () => {
    getFreshMembership.mockResolvedValue(null)

    await expect(renderMemberHome()).rejects.toThrow('NEXT_NOT_FOUND')

    expect(sessionQueries).toBe(0)
  })

  it('does not read upcoming sessions for a published non-member', async () => {
    classroom = { ...classroom!, status: 'published' }
    getFreshMembership.mockResolvedValue(null)

    await renderMemberHome()

    expect(sessionQueries).toBe(0)
  })
})
