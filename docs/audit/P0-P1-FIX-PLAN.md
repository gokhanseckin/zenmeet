# Zenmeet P0/P1 Fix Plan

Source: full audit (2026-06-12). Fix P0 + P1. Each task = one agent, non-overlapping file set. TDD where practical; run `npm test` after.

## Agent groups (parallel — disjoint files)

### Agent 1 — P0 #1: Stripe webhook cross-tenant membership bypass
Files: `src/lib/stripe-webhook.ts`, `src/app/api/webhooks/stripe/route.ts`, `tests/stripe-webhook.test.ts`
- Add `WebhookDb.classroomOwnerAccount(classroomId): Promise<string|null>` returning the owning teacher's `stripe_account_id`.
- In `handleStripeEvent`, for sub events: require `event.account` present and `=== classroomOwnerAccount(classroom_id)`; else ignore (return, mark processed).
- Implement accessor in route via `supabaseAdmin` join `classrooms → teachers.stripe_account_id`.
- Tests: reject event whose `event.account` ≠ classroom owner; accept matching; ignore when account missing.

### Agent 2 — P1 #6: getFreshMembership reconciles old sub on re-subscribe
Files: `src/lib/membership.ts`, new `tests/membership.test.ts`
- When `checkoutSessionId` present, resolve `subId` from the checkout session FIRST (fall back to `existing.stripe_subscription_id`).
- Keep metadata guard (`student_id`/`classroom_id` match). Add tests covering cancel→re-subscribe with `cs=` param.

### Agent 3 — P1 #2: sessions created < 1 cron period before start never materialized
Files: `src/lib/cron/tick.ts`, `src/lib/recurrence.ts`, `src/app/actions/schedule.ts`, `src/lib/cron/supabase-db.ts`
- Materialize synchronously in `createSchedule` (insert occurrences for the new rule, ignore-dupes).
- Widen `PROVISION_GRACE_MS` to ≥ tick period (use session `ends_at` as join-window bound where sensible).
- Tests: ad-hoc schedule starting < 10 min out yields a session row immediately.

### Agent 4 — P1 #3,#4,#5: onboarding/classroom/dashboard error + clobber bugs
Files: `src/app/actions/classroom.ts`, `src/app/onboarding/steps.tsx`, `src/app/dashboard/schedule/page.tsx`, `src/app/dashboard/page.tsx`
- #3: `upsertClassroom` only writes `price_amount`/`trial_days`/`currency` when explicitly provided (no default-clobber on partial edit). Add test for price-preservation on title-only update.
- #4: ScheduleStep skips `createSchedule` when a schedule already exists; check its result; surface `publishClassroom` `missing[]` in redirect.
- #5: thread `{error}` from `submit`/`cancel`/`manualLink`/`stop` and onboarding/publish to UI (error query param / useActionState).

## Integration
- After all 4: run full `npm test` + `npx tsc --noEmit`; fix cross-agent breakage; commit on a branch.
