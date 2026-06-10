import { describe, it, expect } from 'vitest'
import { validateSlug, slugify } from '@/lib/slugs'

describe('validateSlug', () => {
  it('accepts lowercase letters, digits, hyphens', () => {
    expect(validateSlug('aiko-vinyasa')).toBeNull()
    expect(validateSlug('class-101')).toBeNull()
  })
  it('rejects reserved words', () => {
    for (const s of ['my', 'api', 'dashboard', 'admin', 'auth', 'onboarding']) {
      expect(validateSlug(s)).toMatch(/reserved/)
    }
  })
  it('rejects bad shapes', () => {
    expect(validateSlug('')).toBeTruthy()
    expect(validateSlug('Has-Caps')).toBeTruthy()
    expect(validateSlug('-leading')).toBeTruthy()
    expect(validateSlug('trailing-')).toBeTruthy()
    expect(validateSlug('a'.repeat(64))).toBeTruthy()
    expect(validateSlug('two--hyphens')).toBeTruthy()
  })
})

describe('slugify', () => {
  it('derives a valid slug from a title', () => {
    expect(slugify('Morning Vinyasa with Aiko!')).toBe('morning-vinyasa-with-aiko')
    expect(validateSlug(slugify('Hello   World'))).toBeNull()
  })
  it('emoji-only titles slugify to empty and fail validation', () => {
    expect(slugify('🧘🔥💯')).toBe('')
    expect(validateSlug(slugify('🧘🔥💯'))).toBeTruthy()
  })
  it('63-char truncation never leaves a trailing hyphen', () => {
    const s = slugify('a'.repeat(62) + ' b')
    expect(s).toHaveLength(62)
    expect(validateSlug(s)).toBeNull()
  })
  it('rejects newly reserved route words', () => {
    for (const s of ['new', 'login', 'settings', 'account']) {
      expect(validateSlug(s)).toMatch(/reserved/)
    }
  })
})
