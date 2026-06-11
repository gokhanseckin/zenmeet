# Zenmeet

Teachers run paid live classes using their own video conferencing accounts (Zoom or Google Meet) and collect payments through their own Stripe account via Stripe Connect Standard. Students subscribe to a teacher's channel; the meeting link unlocks 5 minutes before the session starts and is visible only to active members.

## Architecture

- **Next.js App Router on Vercel** — all pages and API routes; middleware enforces auth + membership gates.
- **Supabase Postgres + Auth** — database, row-level security, magic-link email auth (token-hash flow).
- **GitHub Actions cron → `/api/cron/tick`** — polls every 10 minutes to publish upcoming sessions and unlock meeting links.
- **Stripe Checkout + webhooks on connected accounts** — teachers onboard via Stripe Connect Standard; subscriptions and webhooks run on each connected account.
- **Zoom Marketplace app + Google Cloud Console OAuth client** — per-session meeting links fetched at unlock time using each teacher's stored OAuth tokens.

## Local Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd Zenmeet
npm install
```

### 2. Environment variables

Copy `.env.example` to `.env.local` and fill in each value:

```bash
cp .env.example .env.local
```

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → `service_role` key (keep secret) |
| `APP_URL` | `http://localhost:3000` for local; production URL when deploying |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` (must be ≥ 16 chars) |
| `TOKEN_ENC_KEY` | Generate: `openssl rand -base64 32` (base64 of 32 bytes) |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys → Secret key |
| `STRIPE_CONNECT_CLIENT_ID` | Stripe dashboard → Connect → Settings → Client ID (`ca_…`) |
| `STRIPE_WEBHOOK_SECRET` | Created when you register the webhook endpoint (see below) |
| `ZOOM_CLIENT_ID` | Zoom Marketplace → your OAuth app → App Credentials |
| `ZOOM_CLIENT_SECRET` | Zoom Marketplace → your OAuth app → App Credentials |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client Secret |

### 3. Apply database migrations

Three migration files live in `supabase/migrations/`:

- `0001_init.sql`
- `0002_security_fixes.sql`
- `0003_increment_attempts.sql`

Run them in order via the Supabase SQL editor (dashboard → SQL Editor) or the Supabase MCP tool (`apply_migration`).

### 4. Supabase Auth configuration

In the Supabase dashboard → Authentication → Providers:

- Enable the **Email** provider.
- Set **Site URL** to your `APP_URL` (e.g. `http://localhost:3000`).
- Edit the **magic link email template** to use the token-hash flow (required for `src/app/auth/confirm/route.ts`):

```
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

### 5. Stripe webhooks (local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret printed by the CLI into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

### 6. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How the Cron Works

`.github/workflows/cron.yml` triggers on a `*/10 * * * *` schedule (and supports `workflow_dispatch` for manual runs). Each run makes a POST to `/api/cron/tick` with an `Authorization: Bearer <CRON_SECRET>` header.

The route publishes sessions whose start time is within the upcoming window and unlocks meeting links for sessions starting within 5 minutes. Unlock is computed at request time — jitter in cron scheduling does not cause missed unlocks.

**Required repo settings:**

| Setting | Value |
|---|---|
| Secret `CRON_SECRET` | Same value as the env var |
| Variable `APP_URL` | Production URL (e.g. `https://your-app.vercel.app`) |

Set these under Repository → Settings → Secrets and variables → Actions.

## Testing

```bash
npm test
```

Runs 9 test files / 50 unit and handler tests using Vitest with in-memory fakes (no real DB, Stripe, or video API calls).

## Launch Checklist

Before going live, verify each item:

- [ ] **Supabase Site URL** — set to production `APP_URL` in Authentication → URL Configuration.
- [ ] **Supabase magic-link email template** — updated to token-hash URL (see Local Setup §4).
- [ ] **Stripe webhook endpoint** — register `https://<prod-url>/api/webhooks/stripe` in Stripe dashboard; under "Listen to events on Connected accounts" enable: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`; copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
- [ ] **Stripe Connect OAuth redirect URI** — add `https://<prod-url>/api/oauth/stripe/callback` in Stripe → Connect → Settings → Redirect URIs.
- [ ] **Zoom app redirect URI** — add `https://<prod-url>/api/oauth/zoom/callback` in Zoom Marketplace app settings; submit for marketplace review if publishing publicly.
- [ ] **Google OAuth redirect URI** — add `https://<prod-url>/api/oauth/google/callback` in Google Cloud Console → Credentials; complete verification review for the `calendar.events` scope if publishing to all users.
- [ ] **Vercel env vars** — all 13 variables set to production values in Vercel project settings.
- [ ] **GitHub secrets/vars** — `CRON_SECRET` secret and `APP_URL` variable set in repo Actions settings.
- [ ] **Stripe customer portal** — teachers must enable the customer portal on their own Stripe account so students can manage subscriptions.
