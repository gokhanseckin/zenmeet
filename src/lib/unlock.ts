export const UNLOCK_MINUTES = 5
export const ACTIVE_STATUSES = new Set(['trialing', 'active', 'past_due'])
export const PAST_DUE_GRACE_DAYS = 3

type MembershipAccessArgs = {
  status: string | null
  currentPeriodEnd?: Date | string | null
  now: Date
}

function periodEndTime(currentPeriodEnd: MembershipAccessArgs['currentPeriodEnd']): number | null {
  if (!currentPeriodEnd) return null
  const time = currentPeriodEnd instanceof Date
    ? currentPeriodEnd.getTime()
    : new Date(currentPeriodEnd).getTime()
  return Number.isFinite(time) ? time : null
}

export function unlocksAt(sessionStartsAt: Date): Date {
  return new Date(sessionStartsAt.getTime() - UNLOCK_MINUTES * 60_000)
}

export function hasMembershipAccess(args: MembershipAccessArgs): boolean {
  if (!args.status) return false
  const end = periodEndTime(args.currentPeriodEnd)
  const now = args.now.getTime()

  if (args.status === 'active' || args.status === 'trialing') {
    return end !== null && end > now
  }

  if (args.status === 'past_due') {
    if (end === null) return false
    const graceEnds = end + PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000
    return now >= end && now <= graceEnds
  }

  return false
}

export function canJoin(args: {
  membershipStatus: string | null
  currentPeriodEnd?: Date | string | null
  sessionStartsAt: Date
  now: Date
}): boolean {
  if (!hasMembershipAccess({
    status: args.membershipStatus,
    currentPeriodEnd: args.currentPeriodEnd,
    now: args.now,
  })) return false
  return args.now.getTime() >= unlocksAt(args.sessionStartsAt).getTime()
}
