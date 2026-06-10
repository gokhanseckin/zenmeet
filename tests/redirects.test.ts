import { describe, it, expect } from 'vitest'
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
