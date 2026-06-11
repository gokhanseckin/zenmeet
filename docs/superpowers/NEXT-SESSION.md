# Zenmeet — v1 shipped

`feature/zenmeet-v1` merged to `main` (PR #1, merge commit `0eed76a`) on 2026-06-11. Deployed live and verified end-to-end.

## Live
- **Prod:** https://zenmeet.vercel.app — Vercel project `gokhan-seckins-projects/zenmeet`, all 13 env vars set in Production.
- **Supabase:** project `zenmeet` (ref `glwrxeptoswvhfwlkihe`, eu-central-1), migrations 0001–0003 applied.
- **Cron:** GitHub Actions `cron-tick` runs every 10 min (`CRON_SECRET` secret + `APP_URL` variable set); manual dispatch confirmed 200.
- **Stripe:** sandbox/test platform, Connect Standard (direct charges); Connect webhook → `/api/webhooks/stripe` (`customer.subscription.{created,updated,deleted}`).
- **Provider:** Google Meet wired (Calendar API). Zoom adapter present but unconfigured.

## Verified end-to-end (2026-06-11)
Magic-link auth · teacher wizard → publish (Stripe Connect + Google connected, Stripe price on connected account, schedule) · cron materialize + provision → real Meet link (token decrypt → Calendar event → compare-and-set) · student subscribe → Stripe checkout → Connect webhook (signature-verified) → membership (`trialing`) → Join-button reveal → joined live Meet. `vitest` 50/50, `lint` 0 errors, clean build.

## Launch follow-ups (before public launch)
1. **Email deliverability — use Resend (chosen provider)** — free-tier Supabase default email is rate-limited and blocks custom templates. Set up **Resend** as custom SMTP: verify the `zenmeet.me` sending domain (SPF/DKIM/DMARC), wire Resend's SMTP creds into Supabase Auth, then confirm a real magic-link email lands in the inbox. This also unlocks custom templates. (`/auth/confirm` already handles both the default-email PKCE `?code=` flow and the `token_hash` custom-template flow, so no code change is needed.)
2. **Publish the Google consent screen** — currently in Testing mode, so refresh tokens expire after 7 days; publish (and verify if prompted) for durable teacher connections.
3. **Register prod OAuth redirect URIs** (only `localhost` is registered so far — real teacher onboarding on prod fails the connect steps without these):
   - Stripe Connect OAuth settings → `https://zenmeet.vercel.app/api/oauth/stripe/callback`
   - Google OAuth client → `https://zenmeet.vercel.app/api/oauth/google/callback`
4. **Purge prod E2E test data** — Supabase has verification rows (teacher `gokhanseckin@gmail.com`, classroom "Nöro Esneklik" / `esneklik`, student `gokhanseckin+student@gmail.com` membership, a few sessions). This is the real project, not a sandbox — clean before launch.
5. **Stripe — expanded sandbox testing first (do NOT go live yet)** — exercise the full subscription lifecycle in test mode before any live switch: trial→active (`customer.subscription.updated`), cancel + `customer.subscription.deleted` → membership revoked + join access lost, declined card (e.g. `4000000000000341`) + dunning, customer portal via `/api/portal`, multiple students + re-subscribe (first-trial-only gate), webhook replay/idempotency, Connect `account.application.deauthorized`. Confirm membership rows + join gating stay correct throughout. **Go-live is a later session, only after these pass:** swap test→live secret key + live Connect client ID + live webhook (new `whsec_`), and resolve the FR/EUR-platform vs hardcoded-USD-prices currency issue.
6. **Zoom** — `ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET` are placeholders; configure a Zoom app only if offering Zoom classrooms.
7. **Minor:** onboarding `display_name` is saved blank (investigate `saveTeacherAccount`); Next 16 deprecates the `middleware` convention → rename `src/middleware.ts` to `proxy`.

## Update — 2026-06-11 (session 2)
Worked the launch follow-ups. Status:
- **#1 Email (Resend):** ✅ Done. `zenmeet.me` verified in Resend (SPF/DKIM/DMARC, eu-west-1); custom SMTP wired into Supabase Auth (`smtp.resend.com:465`, user `resend`); real magic-link email **delivered to inbox** (sender `noreply@zenmeet.me`). Auth email rate limit now 30/hr.
- **#2 Google consent:** ✅ Published to production (refresh tokens no longer expire at 7 days). Still unverified for the Calendar sensitive scope → "unverified app" screen + 100-user cap until full verification (separate later step).
- **#3 Prod OAuth redirect URIs:** ✅ Canonical domain set to **`https://www.zenmeet.me`** (apex 308s to www; `APP_URL` updated + prod redeployed). Registered Google + Stripe Connect callbacks for `www.zenmeet.me` (+ `zenmeet.vercel.app` backup); Stripe verified live. Supabase Auth Site URL + redirect allow-list updated to include `www.zenmeet.me/**`.
- **#7 Minor fixes:** ✅ [PR #2](https://github.com/gokhanseckin/zenmeet/pull/2) — `display_name` blank root cause was the `teachers.onboarding_step` default (`'classroom'` instead of first step `'account'`), fixed by migration `0004` (applied to prod DB); `middleware.ts` → `proxy.ts` for Next 16.
- **#5 Stripe sandbox testing:** ✅ All scenarios pass in test mode (trial→active, cancel→deleted+join-lost, declined-card dunning→past_due via test clock, billing portal, multi-student, replay/idempotency + bad-sig→400). Verified membership rows + join gating throughout. First-trial-only gate locked by a unit test (extracted `src/lib/trial.ts`). **Go-live still deferred** to a later session.

### Findings from #5 (still open)
- **`account.application.deauthorized` is NOT handled** — webhook only handles `customer.subscription.{created,updated,deleted}`. When a teacher revokes Connect, `teachers.stripe_account_id` is left stale (future checkouts/portal would break). **TODO:** add a handler (clear `stripe_account_id`; decide whether to revoke memberships). Deferred by choice this session.
- **`past_due` grants join access** (it's in `ACTIVE_STATUSES`) — confirmed **intentional** (grace period during dunning). Leave as-is.
- **Stray worktree** `.claude/worktrees/nice-sanderson-93c0c7` (branch `claude/nice-sanderson-93c0c7`, "Zenmeet-designs") pollutes bare `eslint` with ~33 errors from generated/old JSX. Real `src`/`tests` lint clean (0 errors). Remove the worktree or add `.claude/**` to eslint ignores.

## Security reminder
A Supabase **Personal Access Token** (`sbp_…`) was used this session for auth-config + webhook setup. If you haven't already, **revoke it**: https://supabase.com/dashboard/account/tokens — auth config is now set and the app uses only the project keys at runtime. All other secrets live in `.env.local` (gitignored) and Vercel Production env.
