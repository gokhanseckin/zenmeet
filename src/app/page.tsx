import Link from 'next/link'

export default function Landing() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <p className="font-bold">■ Zenmeet</p>
      <h1 className="mt-6 text-5xl font-bold leading-tight">Your live classes,<br />on your own terms.</h1>
      <p className="mt-4 text-neutral-600">Run paid live classes with your own Zoom or Google Meet and your own Stripe.
        Students subscribe; the class link unlocks 5 minutes before you go live.</p>
      <div className="mt-8 space-x-4">
        <Link href="/onboarding" className="rounded bg-orange-800 px-8 py-3 text-white font-semibold">Start teaching</Link>
        <Link href="/auth/sign-in?next=/dashboard" className="underline">Sign in</Link>
      </div>
    </main>
  )
}
