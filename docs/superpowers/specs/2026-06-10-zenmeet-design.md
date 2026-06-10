# Zenmeet — v1 Design

Date: 2026-06-10
Status: Approved (brainstorming session)
Wireframes: `Zenmeet-designs/` (product name in wireframes is "JoinClass"; brand is **Zenmeet.me**)

## 1. Product summary

Zenmeet is a SaaS for teachers who run live online classes. A teacher creates a
**classroom** with a public page at `zenmeet.me/[slug]`, connects their own Zoom
or Google account for meetings and their own Stripe account for payments, and
schedules one-off or weekly recurring sessions. Students subscribe to a
classroom (one subscription type per classroom, monthly, with a free trial) and
get access to the live meeting link, which **unlocks 5 minutes before each
session for members only** — the product's signature moment.

V1 decisions:

- Payments: **bring your own Stripe** only, via Stripe Connect Standard.
- Meetings: **full API integration** — teachers OAuth-connect Zoom or Google;
  Zenmeet auto-creates a unique meeting link per session.
- Monetization: **Zenmeet is free in v1.** No platform fee, no teacher
  subscription. Connect Standard keeps the door open for application fees later.
- UI: the "A" variants from the wireframes throughout — linear onboarding
  wizard, form + session-preview class creation, stepped student checkout.

## 2. Architecture

Single **Next.js (App Router)** app on **Vercel** (free tier). **Supabase**
(free tier) provides Postgres and Auth. **GitHub Actions** scheduled workflow
provides the cron trigger (no Vercel cron — paid/limited on free plan).

```
Browser ──► Next.js on Vercel
              ├─ public: landing, /[slug] (classroom page)
              ├─ teacher app: /dashboard (Classroom, Schedule, Students, Payments)
              ├─ student app: /my/[slug] (member home)
              └─ API routes:
                   /api/webhooks/stripe          ◄── Stripe connected-account events
                   /api/oauth/{stripe,zoom,google}/callback
                   /api/cron/tick                ◄── GitHub Actions schedule (Bearer secret)
Supabase: Postgres + Auth (magic link + Google sign-in)
```

Rationale: the hard parts of this product are integration breadth (three OAuth
providers, webhooks), not orchestration. Keep the runtime boring: one codebase,
request-time checks instead of push infrastructure, idempotent cron.

The cron caller is **scheduler-agnostic**: any scheduler that can send an
authenticated HTTP request works. v1 uses a GitHub Actions workflow on a
~10-minute schedule; Supabase `pg_cron` + `pg_net` is the documented fallback
if GitHub's schedule jitter (typically 5–15 min) becomes a problem. The design
tolerates jitter by construction (see §6).

## 3. Data model

All tables in Supabase Postgres.

- **`teachers`** — 1:1 with auth user. Display name, timezone (IANA), Stripe
  Connect account id, Zoom/Google OAuth tokens (encrypted at rest, AES-GCM with
  a server-side key; never sent to the client), `needs_reconnect` flags per
  provider, onboarding step state.
- **`classrooms`** — owned by a teacher. Slug (public URL, unique, reserved-word
  list enforced), title, description, meeting provider (`zoom` | `meet`), price
  amount + currency, trial days (default 7), Stripe product id + price id
  (created on the teacher's connected account at publish), status
  (`draft` | `published`). One classroom = one product = one subscription type.
  A teacher can own several classrooms.
- **`class_schedules`** — recurrence rules per classroom. Either one-off
  (`starts_at`) or recurring: weekday(s) + local time + duration, optional
  `until`. **Weekly recurrence only in v1** (matches wireframe: "Weekly on
  Monday · until · forever"). Times are stored as the teacher's local wall time
  + timezone; materialization resolves DST.
- **`sessions`** — materialized occurrences. Classroom id, schedule id, start/end
  (UTC), status (`scheduled` | `live` | `done` | `canceled`), `join_url`
  (null until provisioned), provider meeting/event id, provisioning error count.
  Unique on (schedule id, start) so materialization is insert-only idempotent.
- **`students`** — 1:1 with auth user. Name, email.
- **`memberships`** — student × classroom. Stripe customer id + subscription id
  (both on the teacher's connected account), status
  (`trialing` | `active` | `past_due` | `canceled`), current period end.
  Synced by webhook; re-fetched from Stripe on demand if stale-looking.

The same auth user may have both a `teachers` and a `students` row.

**Access rule (the unlock):** a student may see/use a session's `join_url` iff
membership status ∈ {`trialing`, `active`, `past_due`} **and**
`now ≥ session.start − 5 min`. Evaluated server-side at request time.

## 4. Integrations

### Stripe — Connect Standard

- Onboarding wizard step: "Connect Stripe" → Stripe OAuth → callback stores
  `stripe_account_id`.
- On classroom publish: create Product + recurring monthly Price **on the
  connected account**.
- Student checkout: hosted **Stripe Checkout**, subscription mode, on the
  connected account, `subscription_data.trial_period_days` from the classroom.
  Card data/SCA never touch Zenmeet.
- One platform webhook endpoint for connected-account events:
  `customer.subscription.created/updated/deleted`, `invoice.payment_failed` →
  update `memberships.status`. Signature-verified, event-id deduped.
- Self-service billing: Stripe **Billing Portal** on the teacher's account
  (cancel, card update, receipts). Zenmeet builds no billing UI beyond links.
- Teacher "Payments" tab reads from `memberships` (subscriber count, MRR
  estimate, recent events) and deep-links to the teacher's Stripe dashboard.
- Refunds: teachers handle in their own Stripe dashboard (out of scope in app).

### Zoom — OAuth app

- Scope `meeting:write`. Store access + refresh tokens encrypted; refresh
  transparently on 401; on refresh failure set `needs_reconnect`.
- Cron provisions a scheduled meeting per session (type 2, start time +
  duration; waiting room off; join-before-host per teacher preference) and
  stores `join_url` + meeting id.
- Canceling a session deletes the provider meeting (best-effort).

### Google Meet — via Calendar API

- Scope `calendar.events`. Same token storage/refresh pattern as Zoom.
- Meet links are obtained by creating a Calendar event with `conferenceData`
  requested (there is no simple standalone Meet-link API). Side benefit:
  sessions appear on the teacher's real calendar. Store event id so
  cancellations propagate.

### Launch caveat (checklist item, not code)

Both OAuth apps start in dev/unverified mode with limited test users. Public
launch requires Google OAuth verification review and Zoom Marketplace review.
Build and demo against dev-mode apps; run reviews in parallel with development.

### Auth — Supabase

Magic-link email + Google sign-in, both roles. Role rows (`teachers` /
`students`) are created based on entry path: teacher signup wizard vs. joining
a classroom.

## 5. Flows and pages

### Public classroom page — `/[slug]`

Server-rendered (shareable/SEO). Class name, schedule summary, provider badge,
member count, price, trial line ("First 7 days free"), countdown to next
session. Accent panel: "Live link unlocks 5 min before — members only"; for an
active member inside the window it becomes the **Join class now** button.
Countdown ticks client-side and re-fetches page state when it crosses an
unlock boundary.

### Teacher onboarding — linear wizard (variant A)

account → classroom basics (name, slug, description) → connect Stripe →
connect Zoom **or** Google → first class schedule + price → publish.

- Every step persists immediately; drop-off resumes at the last step.
- Integration steps are skippable ("do this later"), but publishing requires
  Stripe + one meeting provider connected. This rule lives in a single
  `canPublish()` check.

### Teacher dashboard — 4 tabs (wireframe nav)

- **Classroom**: public-page settings, preview, share link.
- **Schedule**: "New class" form with live preview of generated sessions
  (variant A: one-off vs recurring toggle, provider picker, "fresh private
  link per session · revealed 5 min before" note); upcoming-session list with
  per-session cancel and a manual "paste link" override.
- **Students**: member list with membership status.
- **Payments**: subscriber count, MRR estimate, recent payment events, link to
  Stripe dashboard.

### Student flow — stepped (variant A)

Public page → Join → sign in (magic link) → hosted Stripe Checkout → success →
**member home** `/my/[slug]`: "Active member" pill, next session ("Next:
Monday · 7:00am · Google Meet"), doors-open panel (countdown → **Join class
now**), Manage membership (→ Billing Portal), Billing & receipts, Class
schedule.

The join button calls a server endpoint that re-checks the access rule before
redirecting to the real meeting URL. The URL is never embedded in HTML for
non-members or before the unlock window.

## 6. Background work — `/api/cron/tick`

One idempotent endpoint, Bearer-secret protected, called every ~10 min by a
GitHub Actions scheduled workflow. Safe to call twice or concurrently.

1. **Materialize**: roll every active `class_schedule` forward so concrete
   `sessions` exist for the next 30 days. Insert-only, keyed on
   (schedule id, start time) — re-runs are no-ops.
2. **Provision links**: for sessions starting within 60 min with no
   `join_url`, call the provider API and store the link. Failures increment the
   error count and retry on every subsequent tick (~6 attempts before class
   time), so transient provider failures self-heal.
3. Mark past sessions `done`.

The 5-minute unlock is **not** cron work — it is computed at request time, so
scheduler jitter can never delay an unlock.

## 7. Error handling

- **Link provisioning fails through class time** (provider down, tokens
  revoked): member home shows a fallback ("link is on its way — refresh
  shortly"); teacher dashboard shows a prominent banner ("We couldn't create
  Monday's link — reconnect Zoom") with a manual paste-link escape hatch on
  the session. Revoked tokens set `needs_reconnect`, surfaced across the
  dashboard.
- **Stripe webhook gaps**: handler idempotent (event-id dedupe); membership
  status re-fetched from Stripe on demand when a student hits member home with
  a stale-looking status; signature verification on every event.
- **Subscription lapses**: `past_due` keeps access during Stripe's retry
  window; `canceled` ends access at period end. Derived purely from
  webhook-synced status — no custom dunning.
- **Slug safety**: unique index + reserved-word list (`my`, `api`, `dashboard`,
  `admin`, ...).
- **Cron security**: constant-time Bearer comparison; endpoint idempotent.

## 8. Testing

- **Unit**: recurrence materialization (DST transitions in the teacher's
  timezone — the trickiest pure function, test hard), unlock-window logic,
  `canPublish()`.
- **Integration**: Stripe webhook handler against recorded fixture events;
  OAuth callbacks with mocked providers; cron tick idempotency (run twice,
  assert no duplicates).
- **E2E (Playwright)**: teacher wizard through publish (Stripe/Zoom stubbed);
  student join through to an unlocked Join button (injected clock).
- Local dev: Stripe test mode + Stripe CLI webhook forwarding.

## 9. Out of scope for v1

Platform fees / "use our Stripe"; multiple plans or tiers per classroom;
B-variant UIs (week-calendar schedule, checklist-dashboard onboarding,
one-sheet checkout); email reminders before class; recordings; attendance
tracking; payouts UI; in-app refunds; native apps; i18n; non-weekly recurrence
rules.
