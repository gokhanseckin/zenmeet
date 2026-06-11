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
1. **Email deliverability** — free-tier Supabase default email is rate-limited and blocks custom templates. Add custom SMTP (e.g. Resend) to unlock templates + real deliverability. (`/auth/confirm` already handles both the default-email PKCE `?code=` flow and the `token_hash` custom-template flow, so no code change is needed when SMTP is added.)
2. **Publish the Google consent screen** — currently in Testing mode, so refresh tokens expire after 7 days; publish (and verify if prompted) for durable teacher connections.
3. **Register prod OAuth redirect URIs** (only `localhost` is registered so far — real teacher onboarding on prod fails the connect steps without these):
   - Stripe Connect OAuth settings → `https://zenmeet.vercel.app/api/oauth/stripe/callback`
   - Google OAuth client → `https://zenmeet.vercel.app/api/oauth/google/callback`
4. **Purge prod E2E test data** — Supabase has verification rows (teacher `gokhanseckin@gmail.com`, classroom "Nöro Esneklik" / `esneklik`, student `gokhanseckin+student@gmail.com` membership, a few sessions). This is the real project, not a sandbox — clean before launch.
5. **Stripe go-live** — currently test/sandbox keys. Switch to live secret key + live Connect client ID + live webhook (new `whsec_`). Platform is FR/EUR while prices are hardcoded USD — revisit currency handling.
6. **Zoom** — `ZOOM_CLIENT_ID`/`ZOOM_CLIENT_SECRET` are placeholders; configure a Zoom app only if offering Zoom classrooms.
7. **Minor:** onboarding `display_name` is saved blank (investigate `saveTeacherAccount`); Next 16 deprecates the `middleware` convention → rename `src/middleware.ts` to `proxy`.

## Security reminder
A Supabase **Personal Access Token** (`sbp_…`) was used this session for auth-config + webhook setup. If you haven't already, **revoke it**: https://supabase.com/dashboard/account/tokens — auth config is now set and the app uses only the project keys at runtime. All other secrets live in `.env.local` (gitignored) and Vercel Production env.
