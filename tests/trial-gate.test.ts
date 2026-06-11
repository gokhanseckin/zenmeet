import { describe, it, expect } from 'vitest'
import { shouldGrantTrial } from '@/lib/trial'

/**
 * Revenue-protection gate: the free trial is granted only on a student's
 * first-ever subscribe to a classroom. Canceling and re-subscribing must NOT
 * restart the trial (a canceled membership row still exists, so the student is
 * not a first-timer). See src/app/api/checkout/route.ts.
 */
describe('shouldGrantTrial (first-trial-only gate)', () => {
  it('grants a trial to a first-time subscriber when the classroom offers one', () => {
    expect(shouldGrantTrial(7, false)).toBe(true)
  })

  it('does NOT grant a trial to a re-subscriber (a membership row already exists)', () => {
    // Re-subscribe after cancel: existing canceled row → hasExistingMembership=true
    expect(shouldGrantTrial(7, true)).toBe(false)
  })

  it('does NOT grant a trial when the classroom offers no trial days', () => {
    expect(shouldGrantTrial(0, false)).toBe(false)
  })

  it('does NOT grant a trial for a re-subscriber even with trial days configured', () => {
    expect(shouldGrantTrial(30, true)).toBe(false)
  })
})
