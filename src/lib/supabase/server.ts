import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (all) => all.forEach(({ name, value, options }) => {
          try { cookieStore.set(name, value, options) } catch { /* RSC render — middleware refresh handles it */ }
        }),
      },
    },
  )
}
