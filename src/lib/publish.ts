export type PublishCheckInput = {
  teacher: { stripe_account_id: string | null; zoom_tokens_enc: string | null; google_tokens_enc: string | null }
  classroom: { title: string; slug: string; provider: 'zoom' | 'meet'; price_amount: number | null }
  scheduleCount: number
}

export function canPublish(i: PublishCheckInput): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  if (!i.classroom.title.trim()) missing.push('title')
  if (!i.classroom.price_amount || i.classroom.price_amount <= 0) missing.push('price')
  if (!i.teacher.stripe_account_id) missing.push('stripe')
  const providerConnected = i.classroom.provider === 'zoom' ? !!i.teacher.zoom_tokens_enc : !!i.teacher.google_tokens_enc
  if (!providerConnected) missing.push('meeting_provider')
  if (i.scheduleCount < 1) missing.push('schedule')
  return { ok: missing.length === 0, missing }
}
