import { describe, it, expect } from 'vitest'
import { canPublish } from '@/lib/publish'

const ready = {
  teacher: { stripe_account_id: 'acct_1', zoom_tokens_enc: null, google_tokens_enc: 'enc' },
  classroom: { title: 'Morning Vinyasa', slug: 'aiko-vinyasa', provider: 'meet' as const, price_amount: 1900 },
  scheduleCount: 1,
}

describe('canPublish', () => {
  it('passes when stripe + matching provider + price + schedule are present', () => {
    expect(canPublish(ready)).toEqual({ ok: true, missing: [] })
  })
  it('lists every missing requirement', () => {
    const r = canPublish({
      teacher: { stripe_account_id: null, zoom_tokens_enc: null, google_tokens_enc: null },
      classroom: { title: '', slug: 'x', provider: 'zoom', price_amount: null },
      scheduleCount: 0,
    })
    expect(r.ok).toBe(false)
    expect(r.missing).toEqual(['title', 'price', 'stripe', 'meeting_provider', 'schedule'])
  })
  it('requires the CONNECTED provider to match the classroom provider', () => {
    expect(canPublish({ ...ready, classroom: { ...ready.classroom, provider: 'zoom' } }).missing).toEqual(['meeting_provider'])
  })
})
