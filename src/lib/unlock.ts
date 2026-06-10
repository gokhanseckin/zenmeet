export const UNLOCK_MINUTES = 5
export const ACTIVE_STATUSES = new Set(['trialing', 'active', 'past_due'])

export function unlocksAt(sessionStartsAt: Date): Date {
  return new Date(sessionStartsAt.getTime() - UNLOCK_MINUTES * 60_000)
}

export function canJoin(args: { membershipStatus: string | null; sessionStartsAt: Date; now: Date }): boolean {
  if (!args.membershipStatus || !ACTIVE_STATUSES.has(args.membershipStatus)) return false
  return args.now.getTime() >= unlocksAt(args.sessionStartsAt).getTime()
}
