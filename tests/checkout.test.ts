import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  ensureStudentMock: vi.fn(),
  supabaseAdminMock: vi.fn(),
  createSessionMock: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  getUser: mocks.getUserMock,
  ensureStudent: mocks.ensureStudentMock,
}))

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: mocks.supabaseAdminMock,
}))

vi.mock('@/lib/stripe', () => ({
  stripe: () => ({
    checkout: { sessions: { create: mocks.createSessionMock } },
  }),
  onAccount: (accountId: string) => ({ stripeAccount: accountId }),
}))

vi.mock('@/lib/env', () => ({
  env: () => ({ APP_URL: 'https://zenmeet.test' }),
}))

import { POST } from '@/app/api/checkout/route'

type Membership = { status: string } | null
type PendingCheckout = {
  student_id: string
  classroom_id: string
  stripe_checkout_session_id: string | null
  url: string | null
  expires_at: string | null
  idempotency_key: string
  created_at?: string
}

const classroom = {
  id: 'cls-1',
  slug: 'yoga',
  status: 'published',
  stripe_price_id: 'price_123',
  trial_days: 7,
  teachers: { stripe_account_id: 'acct_T1' },
}

function checkoutRequest(slug = 'yoga') {
  return new Request('https://zenmeet.test/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ slug }),
    headers: { 'content-type': 'application/json' },
  }) as NextRequest
}

function makeDb(opts: {
  membership?: Membership
  insertDelayMs?: number
  pending?: PendingCheckout
} = {}) {
  const pending = new Map<string, PendingCheckout>()
  const inserts: PendingCheckout[] = []
  const updates: Partial<PendingCheckout>[] = []
  const deletes: string[] = []
  const key = (studentId: string, classroomId: string) => `${studentId}/${classroomId}`
  if (opts.pending) pending.set(key(opts.pending.student_id, opts.pending.classroom_id), opts.pending)

  class Builder {
    private filters = new Map<string, unknown>()
    private pendingInsert: PendingCheckout | null = null
    private pendingUpdate: Partial<PendingCheckout> | null = null

    constructor(private table: string) {}

    select() { return this }
    eq(column: string, value: unknown) { this.filters.set(column, value); return this }
    lt() { return this }
    gt() { return this }

    async single() {
      if (this.table === 'classrooms') return { data: classroom, error: null }
      return { data: null, error: null }
    }

    async maybeSingle() {
      if (this.table === 'memberships') return { data: opts.membership ?? null, error: null }
      if (this.table === 'pending_checkout_sessions') {
        const row = pending.get(key(
          this.filters.get('student_id') as string,
          this.filters.get('classroom_id') as string,
        ))
        return { data: row ?? null, error: null }
      }
      return { data: null, error: null }
    }

    async insert(payload: PendingCheckout) {
      if (opts.insertDelayMs) await new Promise((resolve) => setTimeout(resolve, opts.insertDelayMs))
      const mapKey = key(payload.student_id, payload.classroom_id)
      if (pending.has(mapKey)) return { error: { code: '23505' } }
      pending.set(mapKey, payload)
      inserts.push(payload)
      return { error: null }
    }

    update(payload: Partial<PendingCheckout>) {
      this.pendingUpdate = payload
      return this
    }

    delete() {
      this.pendingUpdate = {}
      return this
    }

    async then(resolve: (value: { error: null }) => void) {
      if (this.table === 'pending_checkout_sessions' && this.pendingUpdate) {
        const mapKey = key(
          this.filters.get('student_id') as string,
          this.filters.get('classroom_id') as string,
        )
        if (Object.keys(this.pendingUpdate).length === 0) {
          pending.delete(mapKey)
          deletes.push(mapKey)
        } else {
          pending.set(mapKey, { ...pending.get(mapKey)!, ...this.pendingUpdate })
          updates.push(this.pendingUpdate)
        }
      }
      resolve({ error: null })
    }
  }

  return {
    db: { from: (table: string) => new Builder(table) },
    pending,
    inserts,
    updates,
    deletes,
  }
}

describe('checkout route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getUserMock.mockResolvedValue({ id: 'stu-1', email: 's@example.com' })
    mocks.ensureStudentMock.mockResolvedValue({})
    mocks.createSessionMock.mockResolvedValue({
      id: 'cs_123',
      url: 'https://checkout.stripe.test/cs_123',
      expires_at: 1781568000,
    })
  })

  it('redirects unauthenticated users to sign in', async () => {
    mocks.getUserMock.mockResolvedValue(null)
    mocks.supabaseAdminMock.mockReturnValue(makeDb().db)

    const res = await POST(checkoutRequest())

    expect(await res.json()).toEqual({ redirect: '/auth/sign-in?next=%2Fyoga' })
    expect(mocks.createSessionMock).not.toHaveBeenCalled()
  })

  it('redirects existing non-canceled members to their classroom home', async () => {
    mocks.supabaseAdminMock.mockReturnValue(makeDb({ membership: { status: 'active' } }).db)

    const res = await POST(checkoutRequest())

    expect(await res.json()).toEqual({ redirect: '/my/yoga' })
    expect(mocks.createSessionMock).not.toHaveBeenCalled()
  })

  it('lets canceled prior members re-checkout without a new trial', async () => {
    mocks.supabaseAdminMock.mockReturnValue(makeDb({ membership: { status: 'canceled' } }).db)

    const res = await POST(checkoutRequest())

    expect(await res.json()).toEqual({ redirect: 'https://checkout.stripe.test/cs_123' })
    expect(mocks.createSessionMock).toHaveBeenCalledWith(expect.objectContaining({
      subscription_data: {
        trial_period_days: undefined,
        metadata: { classroom_id: 'cls-1', student_id: 'stu-1' },
      },
    }), expect.objectContaining({ stripeAccount: 'acct_T1', idempotencyKey: expect.any(String) }))
  })

  it('does not reuse an old pending checkout URL after the membership was canceled', async () => {
    const ctx = makeDb({
      membership: { status: 'canceled' },
      pending: {
        student_id: 'stu-1',
        classroom_id: 'cls-1',
        stripe_checkout_session_id: 'cs_old',
        url: 'https://checkout.stripe.test/cs_old',
        expires_at: '2026-06-16T00:00:00.000Z',
        idempotency_key: 'old-key',
      },
    })
    mocks.supabaseAdminMock.mockReturnValue(ctx.db)

    const res = await POST(checkoutRequest())

    expect(await res.json()).toEqual({ redirect: 'https://checkout.stripe.test/cs_123' })
    expect(mocks.createSessionMock).toHaveBeenCalledTimes(1)
    expect(ctx.deletes).toEqual(['stu-1/cls-1'])
  })

  it('reuses an open pending checkout session for repeated posts before the webhook arrives', async () => {
    const ctx = makeDb()
    mocks.supabaseAdminMock.mockReturnValue(ctx.db)

    const first = await POST(checkoutRequest())
    const second = await POST(checkoutRequest())

    expect(await first.json()).toEqual({ redirect: 'https://checkout.stripe.test/cs_123' })
    expect(await second.json()).toEqual({ redirect: 'https://checkout.stripe.test/cs_123' })
    expect(mocks.createSessionMock).toHaveBeenCalledTimes(1)
    expect(ctx.inserts).toHaveLength(1)
  })

  it('serializes concurrent posts for the same student and classroom into one checkout session', async () => {
    const ctx = makeDb()
    mocks.supabaseAdminMock.mockReturnValue(ctx.db)
    mocks.createSessionMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
      return {
        id: 'cs_123',
        url: 'https://checkout.stripe.test/cs_123',
        expires_at: 1781568000,
      }
    })

    const [first, second] = await Promise.all([
      POST(checkoutRequest()),
      POST(checkoutRequest()),
    ])

    expect(await first.json()).toEqual({ redirect: 'https://checkout.stripe.test/cs_123' })
    expect(await second.json()).toEqual({ redirect: 'https://checkout.stripe.test/cs_123' })
    expect(mocks.createSessionMock).toHaveBeenCalledTimes(1)
    expect(ctx.inserts).toHaveLength(1)
  })

  it('re-drives a stale unfinished pending checkout lock with its original idempotency key', async () => {
    const ctx = makeDb({
      pending: {
        student_id: 'stu-1',
        classroom_id: 'cls-1',
        stripe_checkout_session_id: null,
        url: null,
        expires_at: null,
        idempotency_key: 'old-key',
        created_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      },
    })
    mocks.supabaseAdminMock.mockReturnValue(ctx.db)

    const res = await POST(checkoutRequest())

    expect(await res.json()).toEqual({ redirect: 'https://checkout.stripe.test/cs_123' })
    expect(mocks.createSessionMock).toHaveBeenCalledTimes(1)
    expect(mocks.createSessionMock).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      idempotencyKey: 'old-key',
    }))
    expect(ctx.deletes).toEqual([])
    expect(ctx.inserts).toHaveLength(0)
  })
})
