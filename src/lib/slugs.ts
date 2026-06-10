export const RESERVED_SLUGS = new Set([
  'my', 'api', 'dashboard', 'admin', 'auth', 'onboarding', 'about', 'pricing',
  'terms', 'privacy', 'help', 'blog', 'app', 'www', 'static', '_next', 'favicon.ico',
])

const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Returns null if valid, else a human-readable error. */
export function validateSlug(slug: string): string | null {
  if (!slug || slug.length > 63) return 'Slug must be 1-63 characters.'
  if (!SHAPE.test(slug)) return 'Use lowercase letters, numbers, and single hyphens.'
  if (RESERVED_SLUGS.has(slug)) return 'That URL is reserved — pick another.'
  return null
}

export function slugify(title: string): string {
  return title.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/g, '')
}
