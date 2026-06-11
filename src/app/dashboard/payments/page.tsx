import { loadDashboard } from '../lib'
import { ACTIVE_STATUSES } from '@/lib/unlock'
import { ClassroomSwitcher } from '../switcher'

export const dynamic = 'force-dynamic'

export default async function PaymentsTab({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  const { classroom, classrooms, db } = await loadDashboard(c)
  const { data: members } = await db.from('memberships').select('status').eq('classroom_id', classroom.id)
  const active = (members ?? []).filter(m => ACTIVE_STATUSES.has(m.status)).length
  const paying = (members ?? []).filter(m => m.status === 'active' || m.status === 'past_due').length
  const mrr = classroom.price_amount ? (paying * classroom.price_amount / 100) : 0
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payments</h1>
      <ClassroomSwitcher classrooms={classrooms} currentId={classroom.id} basePath="/dashboard/payments" />
      <div className="grid grid-cols-3 gap-4">
        {([['Members', active], ['Paying', paying], ['Est. MRR', `$${mrr.toFixed(0)}`]] as const).map(([l, v]) => (
          <div key={l} className="rounded border p-4">
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">{l}</p>
            <p className="text-3xl font-bold">{v}</p>
          </div>))}
      </div>
      <p className="text-sm text-neutral-600">
        Payouts, refunds, and invoices live in your own Stripe &mdash;{' '}
        <a className="underline" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">open Stripe dashboard &#8599;</a>.
        Remember to enable the <b>customer portal</b> there so students can manage billing.
      </p>
    </div>
  )
}
