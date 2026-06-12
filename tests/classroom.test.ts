import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks -----------------------------------------------------------------
// Auth: pretend a logged-in teacher.
vi.mock('@/lib/auth', () => ({
  requireUser: vi.fn(async () => ({ id: 'teacher_1' })),
  ensureTeacher: vi.fn(async () => ({ id: 'teacher_1' })),
}))
// Slug helpers: keep deterministic, no real validation side-effects.
vi.mock('@/lib/slugs', () => ({
  validateSlug: () => null,
  slugify: (s: string) => s.toLowerCase().replace(/\s+/g, '-'),
}))
// Stripe: never hit the network in these update paths.
vi.mock('@/lib/stripe', () => ({
  stripe: () => ({ prices: { create: vi.fn(), update: vi.fn() } }),
  onAccount: () => ({}),
}))

// Capture the row passed to .update(...) so we can assert on persisted fields.
const CLS_ID = 'e13f3335-be80-4b09-b775-d3cd2c160ca0'
let capturedUpdateRow: Record<string, unknown> | null = null
let capturedInsertRow: Record<string, unknown> | null = null
const existingRow = {
  id: CLS_ID, price_amount: 1900, currency: 'usd',
  stripe_product_id: null, stripe_price_id: null, status: 'draft',
}

// A chainable stub whose terminal .single() resolves to a preset result.
function chain(result: unknown) {
  const c: any = {
    select() { return c },
    eq() { return c },
    single() { return Promise.resolve(result) },
  }
  return c
}

function makeDb() {
  return {
    from(table: string) {
      if (table === 'classrooms') {
        return {
          // Read of the existing row (update path) OR final read after write.
          select() { return chain({ data: existingRow, error: null }) },
          eq() { return this },
          single() { return Promise.resolve({ data: existingRow, error: null }) },
          update(row: Record<string, unknown>) {
            capturedUpdateRow = row
            return chain({ data: { id: CLS_ID, ...row }, error: null })
          },
          insert(row: Record<string, unknown>) {
            capturedInsertRow = row
            return chain({ data: { id: 'cls_new', ...row }, error: null })
          },
        }
      }
      // Other tables (teachers, class_schedules) — generic chain.
      return chain({ data: null, error: null })
    },
  }
}

vi.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: () => makeDb(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { upsertClassroom } from '@/app/actions/classroom'

beforeEach(() => {
  capturedUpdateRow = null
  capturedInsertRow = null
})

describe('upsertClassroom — partial update', () => {
  it('title-only update does NOT touch price_amount / trial_days / currency', async () => {
    const r = await upsertClassroom({
      id: CLS_ID,
      title: 'New Title',
      slug: 'new-title',
      description: 'desc',
      provider: 'meet',
      // NOTE: no priceAmount, currency, or trialDays — ClassroomStep submits none.
    })
    if ('error' in r) throw new Error('upsert failed: ' + r.error)
    expect('error' in r).toBe(false)
    expect(capturedUpdateRow).not.toBeNull()
    expect(capturedUpdateRow!.title).toBe('New Title')
    // The clobber bug: these keys must be absent so the DB keeps existing values.
    expect('price_amount' in capturedUpdateRow!).toBe(false)
    expect('trial_days' in capturedUpdateRow!).toBe(false)
    expect('currency' in capturedUpdateRow!).toBe(false)
  })

  it('update WITH priceAmount persists the new price', async () => {
    await upsertClassroom({
      id: CLS_ID, title: 'T', slug: 't', description: '', provider: 'meet',
      priceAmount: 2500,
    })
    expect(capturedUpdateRow!.price_amount).toBe(2500)
  })

  it('insert (new classroom) keeps sensible defaults', async () => {
    await upsertClassroom({
      title: 'Brand New', slug: 'brand-new', description: '', provider: 'meet',
    })
    expect(capturedInsertRow).not.toBeNull()
    expect(capturedInsertRow!.price_amount).toBe(null)
    expect(capturedInsertRow!.currency).toBe('usd')
    expect(capturedInsertRow!.trial_days).toBe(7)
  })
})
