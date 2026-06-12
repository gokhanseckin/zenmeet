import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'

describe('security headers config', () => {
  it('disables the Next powered-by header', () => {
    expect(nextConfig.poweredByHeader).toBe(false)
  })

  it('applies baseline security headers to every route', async () => {
    const entries = await nextConfig.headers?.()
    const global = entries?.find((entry) => entry.source === '/:path*')
    const headers = new Map(global?.headers.map((header) => [header.key, header.value]))

    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('Permissions-Policy')).toContain('camera=()')
    expect(headers.get('X-Frame-Options')).toBe('DENY')

    const csp = headers.get('Content-Security-Policy') ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain('https://*.supabase.co')
    expect(csp).toContain('https://*.stripe.com')
    expect(csp).toContain('https://zoom.us')
    expect(csp).toContain('https://accounts.google.com')
    expect(csp).toContain('https://vercel.live')
    expect(csp).not.toContain('default-src *')
  })
})
