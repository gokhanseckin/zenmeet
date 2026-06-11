# Zenmeet — continuation handoff

State as of the last session (branch `feature/zenmeet-v1`, pushed to github.com/gokhanseckin/zenmeet):

## Done
- Spec: `docs/superpowers/specs/2026-06-10-zenmeet-design.md` (approved).
- Plan: `docs/superpowers/plans/2026-06-10-zenmeet-v1.md` — **all 25 tasks implemented** via subagent-driven development; every task passed spec-compliance + code-quality review, with fixes applied (notable: sessions RLS join_url leak closed, open-redirect chain via safeNext, Stripe price-replacement + idempotency-replay handling, webhook record-after-success dedup, membership forgery guard via subscription metadata cross-check, first-trial-only gate, cron split failure domains + compare-and-set link save + atomic attempts increment).
- Final whole-implementation review done; its 3 Important findings fixed in `e6533fc` (provider-meeting delete on cancel, `?c=` scoping across dashboard tabs, stopSchedule primitive). The reviewer's confirmation ping of e6533fc was cut off by the session limit — optionally re-verify that commit, otherwise treat as closed (fixes followed the reviewer's own prescriptions).
- Verification: `npx vitest run` 50/50, `npm run build` clean, `npm run lint` 0 errors.
- Supabase project `zenmeet` (ref `glwrxeptoswvhfwlkihe`, eu-central-1) created; migrations 0001–0003 applied live. (Avatar Chat project was paused to free the slot.)
- `.env.local` exists with real Supabase URL + anon key and generated CRON_SECRET/TOKEN_ENC_KEY.

## Outstanding (Plan Task 25 remainder — tracking task #34)
Blocked on user-provided credentials/config:
1. **SUPABASE_SERVICE_ROLE_KEY** — placeholder `PLACEHOLDER_PENDING_USER` in `.env.local`. Get from https://supabase.com/dashboard/project/glwrxeptoswvhfwlkihe/settings/api-keys (the CLI is logged into a different Supabase account — org "Anychat" — so `supabase projects api-keys` 403s; either re-login with the right account or paste the key).
2. **Supabase Auth config** (dashboard): enable Email provider; Site URL = APP_URL; magic-link email template → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` (required by src/app/auth/confirm/route.ts).
3. **Stripe**: platform secret key, enable Connect (Standard), Connect client ID (`ca_...`), OAuth redirect URI, webhook endpoint ("Listen to events on Connected accounts": customer.subscription.created/updated/deleted) → STRIPE_WEBHOOK_SECRET. Local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
4. **Zoom OAuth app** (Marketplace, user-managed, scope meeting:write) and **Google OAuth client** (calendar.events scope, offline access) — dev mode with test users is fine pre-launch. Redirect URIs: `${APP_URL}/api/oauth/{zoom,google}/callback`.
5. **Vercel deploy** + all 13 env vars (see `.env.example`); then GitHub repo secret `CRON_SECRET` + variable `APP_URL`; manually trigger the cron workflow once and confirm 200.
6. **Manual E2E** (README "launch checklist" + plan T25 Step 2): teacher wizard through publish; student join through unlocked Join button.
7. Then: `superpowers:finishing-a-development-branch` — decide merge vs PR for `feature/zenmeet-v1` → `main`.

## Suggested continuation prompt
"Continue the Zenmeet build. Read docs/superpowers/NEXT-SESSION.md for state. All 25 plan tasks are implemented and reviewed on feature/zenmeet-v1. Walk me through the outstanding credentials/config items one by one (I'll provide keys as we go), update .env.local, run the manual end-to-end verification, deploy to Vercel, set up the GitHub cron secret/variable, and then run the finishing-a-development-branch flow."
