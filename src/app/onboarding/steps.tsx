import { redirect } from 'next/navigation'
import { saveTeacherAccount, setOnboardingStep } from '@/app/actions/teacher'
import { upsertClassroom, publishClassroom } from '@/app/actions/classroom'
import { createSchedule } from '@/app/actions/schedule'

export function AccountStep({ teacher }: { teacher: any }) {
  return (
    <form action={saveTeacherAccount} className="space-y-4">
      <h1 className="text-2xl font-bold">Create your teacher account</h1>
      <input
        name="displayName"
        defaultValue={teacher.display_name}
        required
        placeholder="Your name"
        className="w-full rounded border px-3 py-2"
      />
      <select
        name="timezone"
        defaultValue={teacher.timezone}
        className="w-full rounded border px-3 py-2"
      >
        {Intl.supportedValuesOf('timeZone').map((tz) => (
          <option key={tz}>{tz}</option>
        ))}
      </select>
      <button className="rounded bg-orange-800 px-6 py-2 text-white">Continue</button>
    </form>
  )
}

export function ClassroomStep({ classroom }: { classroom: any }) {
  async function save(formData: FormData) {
    'use server'
    const r = await upsertClassroom({
      id: classroom?.id,
      title: String(formData.get('title')),
      slug: String(formData.get('slug') || ''),
      description: String(formData.get('description') || ''),
      provider: (formData.get('provider') as 'zoom' | 'meet') ?? 'meet',
      currency: 'usd',
      trialDays: 7,
    })
    if ('error' in r && r.error) redirect(`/onboarding?step=classroom&error=1`)
    await setOnboardingStep('stripe')
    redirect('/onboarding?step=stripe')
  }
  return (
    <form action={save} className="space-y-4">
      <h1 className="text-2xl font-bold">Set up your classroom</h1>
      <input
        name="title"
        defaultValue={classroom?.title}
        required
        placeholder="Morning Vinyasa with Aiko"
        className="w-full rounded border px-3 py-2"
      />
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        zenmeet.me/
        <input
          name="slug"
          defaultValue={classroom?.slug}
          placeholder="auto from title"
          className="rounded border px-2 py-1"
        />
      </div>
      <textarea
        name="description"
        defaultValue={classroom?.description}
        placeholder="What students get"
        className="w-full rounded border px-3 py-2"
      />
      <label className="block text-sm">
        Where do classes happen?
        <select
          name="provider"
          defaultValue={classroom?.provider ?? 'meet'}
          className="ml-2 rounded border px-2 py-1"
        >
          <option value="meet">Google Meet</option>
          <option value="zoom">Zoom</option>
        </select>
      </label>
      <button className="rounded bg-orange-800 px-6 py-2 text-white">Continue</button>
    </form>
  )
}

export function StripeStep({ connected }: { connected: boolean }) {
  async function next() {
    'use server'
    await setOnboardingStep('provider')
    redirect('/onboarding?step=provider')
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Get paid &mdash; connect Stripe</h1>
      <p className="text-sm text-neutral-600">
        Students pay you directly; money lands in your Stripe account. After connecting, enable the{' '}
        <b>customer portal</b> in your Stripe settings so students can manage billing.
      </p>
      {connected ? (
        <form action={next}>
          <p className="text-green-700 mb-3">&#10003; Stripe connected</p>
          <button className="rounded bg-orange-800 px-6 py-2 text-white">Continue</button>
        </form>
      ) : (
        <div className="space-x-3">
          <a
            href="/api/oauth/stripe/start"
            className="inline-block rounded bg-orange-800 px-6 py-2 text-white"
          >
            Connect Stripe
          </a>
          <form action={next} className="inline">
            <button className="text-sm underline">do this later</button>
          </form>
        </div>
      )}
    </div>
  )
}

export function ProviderStep({
  teacher,
  provider,
}: {
  teacher: any
  provider: 'zoom' | 'meet'
}) {
  async function next() {
    'use server'
    await setOnboardingStep('schedule')
    redirect('/onboarding?step=schedule')
  }
  const connected =
    provider === 'zoom' ? !!teacher.zoom_tokens_enc : !!teacher.google_tokens_enc
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Where is your classroom?</h1>
      <p className="text-sm text-neutral-600">
        Connect {provider === 'zoom' ? 'Zoom' : 'Google'} so Zenmeet can create a fresh private
        link for every session.
      </p>
      {connected ? (
        <form action={next}>
          <p className="text-green-700 mb-3">&#10003; Connected</p>
          <button className="rounded bg-orange-800 px-6 py-2 text-white">Continue</button>
        </form>
      ) : (
        <div className="space-x-3">
          <a
            href={`/api/oauth/${provider === 'zoom' ? 'zoom' : 'google'}/start`}
            className="inline-block rounded bg-orange-800 px-6 py-2 text-white"
          >
            Connect {provider === 'zoom' ? 'Zoom' : 'Google'}
          </a>
          <form action={next} className="inline">
            <button className="text-sm underline">do this later</button>
          </form>
        </div>
      )}
    </div>
  )
}

export function ScheduleStep({
  classroom,
  scheduleCount,
}: {
  classroom: any
  scheduleCount: number
}) {
  async function save(formData: FormData) {
    'use server'
    if (!classroom) redirect('/onboarding?step=classroom')
    const priceRaw = Number(formData.get('price'))
    if (!isFinite(priceRaw) || priceRaw < 1) redirect('/onboarding?step=schedule&error=1')
    const u = await upsertClassroom({
      id: classroom.id,
      title: classroom.title,
      slug: classroom.slug,
      description: classroom.description,
      provider: classroom.provider,
      currency: 'usd',
      trialDays: 7,
      priceAmount: Math.round(priceRaw * 100),
    })
    if ('error' in u && u.error) redirect('/onboarding?step=schedule&error=1')
    if (formData.get('localTime')) {
      await createSchedule({
        kind: 'weekly',
        classroomId: classroom.id,
        weekday: Number(formData.get('weekday')),
        localTime: String(formData.get('localTime')),
        durationMinutes: Number(formData.get('duration')),
        until: null,
      })
    }
    const r = await publishClassroom(classroom.id)
    if ('error' in r && r.error) redirect('/onboarding?step=schedule&error=1')
    await setOnboardingStep('done')
    redirect('/onboarding?step=done')
  }
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return (
    <form action={save} className="space-y-4">
      <h1 className="text-2xl font-bold">Schedule your first class</h1>
      <div className="flex gap-2 items-center text-sm">
        Weekly on
        <select name="weekday" defaultValue={1} className="rounded border px-2 py-1">
          {days.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </select>
        at{' '}
        <input
          name="localTime"
          type="time"
          defaultValue="07:00"
          required={scheduleCount === 0}
          className="rounded border px-2 py-1"
        />{' '}
        for{' '}
        <input
          name="duration"
          type="number"
          defaultValue={60}
          min={5}
          max={480}
          className="w-20 rounded border px-2 py-1"
        />{' '}
        min
      </div>
      <label className="block text-sm">
        Monthly price (USD)
        <input
          name="price"
          type="number"
          step="0.01"
          min="1"
          defaultValue="19"
          required
          className="ml-2 w-28 rounded border px-2 py-1"
        />
      </label>
      <p className="text-xs text-orange-800">
        Fresh private link per session &middot; revealed 5 min before
      </p>
      <button className="rounded bg-orange-800 px-6 py-2 text-white">Save &amp; publish</button>
    </form>
  )
}

export function DoneStep({ slug }: { slug?: string }) {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">You&apos;re live &#127881;</h1>
      {slug && (
        <p>
          Share your classroom:{' '}
          <a className="underline text-orange-800" href={`/${slug}`}>
            zenmeet.me/{slug}
          </a>
        </p>
      )}
      <a
        href="/dashboard"
        className="inline-block rounded bg-orange-800 px-6 py-2 text-white"
      >
        Go to dashboard
      </a>
    </div>
  )
}
