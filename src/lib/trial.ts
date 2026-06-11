/**
 * Decide whether a Checkout subscription should include the free trial.
 *
 * The trial is a first-time-only incentive: it is granted only when the
 * classroom offers trial days AND the student has no existing membership row
 * for that classroom. A canceled membership still counts as "existing", so
 * cancel + re-subscribe does not restart the trial.
 */
export function shouldGrantTrial(trialDays: number, hasExistingMembership: boolean): boolean {
  return trialDays > 0 && !hasExistingMembership
}
