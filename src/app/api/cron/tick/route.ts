import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { env } from '@/lib/env'
import { runTick } from '@/lib/cron/tick'
import { supabaseCronDb, liveMeetingCreator } from '@/lib/cron/supabase-db'

export const maxDuration = 60

function authorized(req: NextRequest) {
  const got = req.headers.get('authorization') ?? ''
  const want = `Bearer ${env().CRON_SECRET}`
  const a = Buffer.from(got)
  const b = Buffer.from(want)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const result = await runTick(supabaseCronDb(), liveMeetingCreator())
  return NextResponse.json(result)
}
