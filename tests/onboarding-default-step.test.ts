import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

// The first step of the onboarding flow. Must stay in sync with ORDER in
// src/app/onboarding/page.tsx (and STEPS in src/app/actions/teacher.ts).
const FIRST_ONBOARDING_STEP = 'account'

/**
 * Regression guard for the "display_name saved blank" bug: a brand-new teacher
 * row is created by ensureTeacher() with only { id }, so it inherits the DB
 * default for onboarding_step. If that default isn't the first step, the
 * AccountStep form (the only caller of saveTeacherAccount) is skipped and
 * display_name/timezone are never collected.
 */
describe('teachers.onboarding_step default', () => {
  it('equals the first onboarding step so new teachers see the account form', () => {
    const dir = path.join(__dirname, '..', 'supabase', 'migrations')
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    let effectiveDefault: string | null = null
    for (const file of files) {
      const sql = readFileSync(path.join(dir, file), 'utf8')
      // CREATE TABLE column default
      const created = sql.match(
        /onboarding_step\s+text\s+not\s+null\s+default\s+'([^']*)'/i,
      )
      if (created) effectiveDefault = created[1]
      // Later ALTER ... SET DEFAULT overrides
      const altered = [
        ...sql.matchAll(
          /alter\s+column\s+onboarding_step\s+set\s+default\s+'([^']*)'/gi,
        ),
      ]
      if (altered.length) effectiveDefault = altered[altered.length - 1][1]
    }

    expect(effectiveDefault).toBe(FIRST_ONBOARDING_STEP)
  })
})
