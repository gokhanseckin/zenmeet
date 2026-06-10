import { supabaseServer } from '@/lib/supabase/server'
import { env } from '@/lib/env'

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string }> }) {
  const { next = '/', sent } = await searchParams

  async function send(formData: FormData) {
    'use server'
    const email = String(formData.get('email') ?? '').trim()
    const nextPath = String(formData.get('next') ?? '/')
    if (!email) return
    const supabase = await supabaseServer()
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${env().APP_URL}/auth/confirm?next=${encodeURIComponent(nextPath)}` },
    })
    const { redirect } = await import('next/navigation')
    redirect(`/auth/sign-in?sent=1&next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <main className="mx-auto max-w-sm p-8">
      <h1 className="text-2xl font-semibold mb-4">Sign in to Zenmeet</h1>
      {sent ? (
        <p>Check your email for a sign-in link.</p>
      ) : (
        <form action={send} className="space-y-3">
          <input type="hidden" name="next" value={next} />
          <input name="email" type="email" required placeholder="you@example.com"
            className="w-full border rounded px-3 py-2" />
          <button className="w-full rounded bg-orange-700 text-white py-2">Send magic link</button>
        </form>
      )}
    </main>
  )
}
