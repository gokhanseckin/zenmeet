import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))

const getUser = vi.fn()
const portalCreate = vi.fn()
let classroom: Record<string, any> | null
let membership: Record<string, any> | null

vi.mock('@/lib/auth', () => ({
  getUser: (...args: any[]) => getUser(...args),
}))

function makeBuilder(table: string) {
  const builder: any = {
    select() { return builder },
    eq() { return builder },
    single() {
      if (table === 'classrooms') return Promise.resolve({ data: classroom })
      return Promise.resolve({ data: null })
    },
    maybeSingle() {
      if (table === 'memberships') return Promise.resolve({ data: membership })
      return Promise.resolve({ data: null })
    },
  }
  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => makeBuilder(table),
  }),
}))

vi.mock('@/lib/stripe', () => ({
  stripe: () => ({ billingPortal: { sessions: { create: portalCreate } } }),
  onAccount: (stripeAccount: string) => ({ stripeAccount }),
}))

vi.mock('@/lib/env', () => ({
  env: () => ({ APP_URL: 'https://app.example' }),
}))

import { POST } from '@/app/api/portal/route'

function portalRequest(slug = 'yoga') {
  return new NextRequest('https://app.example/api/portal', {
    method: 'POST',
    body: JSON.stringify({ slug }),
  })
}

beforeEach(() => {
  getUser.mockReset()
  portalCreate.mockReset()
  classroom = {
    id: 'cls_1',
    teachers: { stripe_account_id: 'acct_1' },
  }
  membership = { stripe_customer_id: 'cus_1' }
})

describe('POST /api/portal', () => {
  it('preserves unauthorized behavior', async () => {
    getUser.mockResolvedValue(null)

    const res = await POST(portalRequest())

    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'unauthorized' })
  })

  it('preserves not-found behavior when the classroom is missing', async () => {
    getUser.mockResolvedValue({ id: 'student_1' })
    classroom = null

    const res = await POST(portalRequest())

    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not found' })
  })

  it('normalizes Stripe billing portal setup failures to typed 409 JSON', async () => {
    getUser.mockResolvedValue({ id: 'student_1' })
    portalCreate.mockRejectedValue(new Error('No configuration provided'))

    const res = await POST(portalRequest())

    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'portal_not_configured' })
  })
})
