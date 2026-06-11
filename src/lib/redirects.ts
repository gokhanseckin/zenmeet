/** Resolve a user-supplied next path against our origin; reject anything that escapes it. */
export function safeNext(raw: string | null | undefined, origin: string): string {
  try {
    const u = new URL(raw || '/', origin)
    return u.origin === origin ? u.pathname + u.search : '/'
  } catch {
    return '/'
  }
}
