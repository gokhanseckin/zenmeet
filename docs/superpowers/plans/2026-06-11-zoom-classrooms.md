# Zoom Classrooms (dev/unpublished) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Zoom a fully working meeting provider for the app owner (and manually-added Zoom test users) by creating a real Zoom Marketplace app, wiring its credentials, and adding regression tests for the already-built Zoom code path — without publishing to the Zoom Marketplace yet.

**Architecture:** The Zoom provider is already implemented end-to-end in code (OAuth start/callback, token store + refresh, `zoomProvider.createMeeting/deleteMeeting`, onboarding provider step, publish gate, cron dispatch, dashboard reconnect alert). The only true gaps are (1) real Zoom OAuth credentials from a Marketplace **General App** with user-managed OAuth, and (2) automated test coverage for the Zoom code that currently has none. Classroom provider stays **immutable after creation** (no edit UI) — confirmed product decision.

**Tech Stack:** Next.js (App Router, this repo's pinned fork), TypeScript, Vitest, Zoom OAuth 2.0 (user-managed), Supabase (encrypted `zoom_tokens_enc` column).

**Out of scope (documented in Task 5, deferred):** Zoom Marketplace publishing/review (needed only when *arbitrary* teachers must connect Zoom), reconnect-in-onboarding UI polish, exposing meeting settings (`approval_type`/`waiting_room`) as classroom config.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `docs/superpowers/zoom-marketplace-runbook.md` | Manual steps to create + configure the Zoom app and fill credentials | Create (Task 1) |
| `tests/providers-zoom.test.ts` | Unit tests for `zoomProvider.createMeeting/deleteMeeting`, `exchangeZoomCode`, `refreshZoom` | Create (Task 2, 3) |
| `.env.example` | Document `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Modify (Task 4) |
| `docs/superpowers/NEXT-SESSION.md` | Record Zoom status + deferred Marketplace-publish step | Modify (Task 5) |

---

## Task 1: Zoom Marketplace app runbook (manual, app owner executes)

This task produces a runbook the **app owner** follows in the Zoom Marketplace UI. No code. The credentials it yields feed Task 4.

**Files:**
- Create: `docs/superpowers/zoom-marketplace-runbook.md`

- [ ] **Step 1: Write the runbook** with this content:

```markdown
# Zoom Marketplace App Runbook (dev/unpublished)

Goal: a **General App** with **user-managed OAuth** that can create meetings on the
connected user's account via `POST /v2/users/me/meetings`.

## 1. Create the app
- https://marketplace.zoom.us → Develop → Build App → **General App**.
- App name: "Zenmeet".
- "Choose your app type" / auth: **User-managed OAuth** (NOT account-level / server-to-server).

## 2. OAuth redirect + allow list
- Redirect URL for OAuth:  https://www.zenmeet.me/api/oauth/zoom/callback
- OAuth allow list: add the same URL. (For local dev also add
  http://localhost:3000/api/oauth/zoom/callback — APP_URL must match.)

## 3. Scopes
- Scopes tab → add granular scope: **meeting:write:meeting** (create meetings).
  Add **meeting:delete:meeting** if you want the delete path covered.
- NOTE: Zoom scopes are configured HERE, not passed in the authorize URL — the
  app's /api/oauth/zoom/start route intentionally sends no `scope` param.

## 4. Credentials
- Copy **Client ID** and **Client Secret** from the App Credentials tab.

## 5. Test users (because we are NOT publishing)
- Add the owner's Zoom account (it's the developer account, already allowed).
- Add any other teachers who must test Zoom: Manage → add as test users.
  Unpublished apps ONLY work for the developer + explicitly-added test users.

## 6. Where to put the credentials
- Local: .env.local → ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET (replace PLAC… placeholders).
- Prod: `vercel env add ZOOM_CLIENT_ID production` and `... ZOOM_CLIENT_SECRET production`
  (project gokhan-seckins-projects/zenmeet), then redeploy.

## 7. Verify
- Sign in as a teacher → onboarding "provider" step with a Zoom classroom →
  "Connect Zoom" → grant → callback persists teachers.zoom_tokens_enc.
- Publish the classroom; let cron/tick provision a session; confirm the session
  row gets join_url + provider_meeting_id.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/zoom-marketplace-runbook.md
git commit -m "docs(zoom): Marketplace app runbook (dev/unpublished, user-managed OAuth)"
```

---

## Task 2: Test `zoomProvider.createMeeting` / `deleteMeeting`

These functions have zero tests. They take `accessToken` directly (no `env()` call), so we mock only `fetch`.

**Files:**
- Create: `tests/providers-zoom.test.ts`
- Reference (do not modify): `src/lib/providers/zoom.ts:27-53`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest'
import { zoomProvider } from '@/lib/providers/zoom'

function stubFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }))
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => vi.unstubAllGlobals())

const args = {
  accessToken: 'A',
  title: 'Lesson 1',
  startsAt: new Date('2026-06-15T10:00:00.000Z'),
  endsAt: new Date('2026-06-15T11:00:00.000Z'),
  timezone: 'Europe/Istanbul',
}

describe('zoomProvider.createMeeting', () => {
  it('posts a scheduled meeting and returns join url + stringified id', async () => {
    const fetchMock = stubFetch(201, { id: 99887766, join_url: 'https://zoom.us/j/99887766' })
    const out = await zoomProvider.createMeeting(args)
    expect(out).toEqual({ joinUrl: 'https://zoom.us/j/99887766', providerMeetingId: '99887766' })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.zoom.us/v2/users/me/meetings')
    const sent = JSON.parse(init.body as string)
    expect(sent.type).toBe(2)
    expect(sent.duration).toBe(60)
    expect(sent.start_time).toBe('2026-06-15T10:00:00Z') // no milliseconds
    expect(init.headers).toMatchObject({ Authorization: 'Bearer A' })
  })

  it('rejects a sub-minute duration before calling fetch', async () => {
    const fetchMock = stubFetch(201, {})
    await expect(zoomProvider.createMeeting({ ...args, endsAt: args.startsAt }))
      .rejects.toThrow(/duration must be >= 1 minute/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws on a non-ok create response', async () => {
    stubFetch(400, { code: 300, message: 'bad' })
    await expect(zoomProvider.createMeeting(args)).rejects.toThrow(/zoom create: 400/)
  })
})

describe('zoomProvider.deleteMeeting', () => {
  it('treats 404 as success (idempotent)', async () => {
    stubFetch(404, {})
    await expect(zoomProvider.deleteMeeting({ accessToken: 'A', providerMeetingId: '1' }))
      .resolves.toBeUndefined()
  })
  it('throws on other non-ok delete responses', async () => {
    stubFetch(500, {})
    await expect(zoomProvider.deleteMeeting({ accessToken: 'A', providerMeetingId: '1' }))
      .rejects.toThrow(/zoom delete: 500/)
  })
})
```

- [ ] **Step 2: Run and confirm they PASS** (this is regression coverage for existing code, so green is expected — but run first to confirm the harness wiring and assertions match reality):

Run: `npx vitest run tests/providers-zoom.test.ts`
Expected: PASS (6 tests). If `start_time` or `duration` assertions fail, the test captured a real behavior mismatch — investigate `src/lib/providers/zoom.ts` before "fixing" the test.

- [ ] **Step 3: Commit**

```bash
git add tests/providers-zoom.test.ts
git commit -m "test(zoom): cover createMeeting/deleteMeeting behavior"
```

---

## Task 3: Test `exchangeZoomCode` / `refreshZoom` (env-dependent)

These call `env()` for Basic-auth credentials, so mock `@/lib/env` and `fetch`.

**Files:**
- Modify: `tests/providers-zoom.test.ts` (append)
- Reference (do not modify): `src/lib/providers/zoom.ts:4-24`

- [ ] **Step 1: Append failing tests** to `tests/providers-zoom.test.ts`:

```typescript
import { exchangeZoomCode, refreshZoom } from '@/lib/providers/zoom'

vi.mock('@/lib/env', () => ({
  env: () => ({
    ZOOM_CLIENT_ID: 'cid',
    ZOOM_CLIENT_SECRET: 'csecret',
    APP_URL: 'https://www.zenmeet.me',
  }),
}))

describe('zoom token requests', () => {
  it('exchanges an auth code into stored tokens with computed expiry', async () => {
    const fetchMock = stubFetch(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600 })
    const before = Date.now()
    const tokens = await exchangeZoomCode('the-code')
    expect(tokens.access_token).toBe('AT')
    expect(tokens.refresh_token).toBe('RT')
    expect(tokens.expires_at).toBeGreaterThanOrEqual(before + 3600 * 1000 - 50)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://zoom.us/oauth/token')
    // Basic auth = base64("cid:csecret")
    expect((init.headers as Record<string, string>).Authorization)
      .toBe(`Basic ${Buffer.from('cid:csecret').toString('base64')}`)
    expect(init.body!.toString()).toContain('grant_type=authorization_code')
    expect(init.body!.toString()).toContain('redirect_uri=https%3A%2F%2Fwww.zenmeet.me%2Fapi%2Foauth%2Fzoom%2Fcallback')
  })

  it('refreshes with grant_type=refresh_token', async () => {
    const fetchMock = stubFetch(200, { access_token: 'AT2', refresh_token: 'RT2', expires_in: 3600 })
    const tokens = await refreshZoom('old-refresh')
    expect(tokens.access_token).toBe('AT2')
    expect(fetchMock.mock.calls[0][1]!.body!.toString()).toContain('grant_type=refresh_token')
    expect(fetchMock.mock.calls[0][1]!.body!.toString()).toContain('refresh_token=old-refresh')
  })

  it('throws on a non-ok token response', async () => {
    stubFetch(401, { error: 'invalid_client' })
    await expect(exchangeZoomCode('x')).rejects.toThrow(/zoom token: 401/)
  })
})
```

- [ ] **Step 2: Run the full Zoom test file**

Run: `npx vitest run tests/providers-zoom.test.ts`
Expected: PASS (9 tests total). If the `vi.mock('@/lib/env')` hoist conflicts with the Task 2 imports, move the `vi.mock` call and the new imports to the TOP of the file (vitest hoists `vi.mock`, but keep imports tidy).

- [ ] **Step 3: Run the whole suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS (prior 59 + 9 new = 68).

- [ ] **Step 4: Commit**

```bash
git add tests/providers-zoom.test.ts
git commit -m "test(zoom): cover OAuth code exchange + token refresh"
```

---

## Task 4: Document Zoom env vars in `.env.example`

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Ensure `.env.example` has Zoom entries.** Add (or confirm) this block:

```bash
# Zoom OAuth app (Marketplace General App, user-managed OAuth)
# See docs/superpowers/zoom-marketplace-runbook.md
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
```

- [ ] **Step 2: Verify no real secret leaked**

Run: `git diff .env.example` and confirm values are empty.

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "docs(env): document Zoom OAuth credentials"
```

---

## Task 5: Record status + deferred Marketplace publish

**Files:**
- Modify: `docs/superpowers/NEXT-SESSION.md`

- [ ] **Step 1: Append a Zoom section** noting:
  - Zoom works for owner + added test users once Task 1 credentials are filled.
  - Code path fully tested (Tasks 2–3).
  - **Deferred:** Zoom Marketplace **publishing/review** is required before *arbitrary* teachers can connect Zoom (analogous to Google verification). Also deferred: reconnect-in-onboarding UI, configurable meeting settings.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/NEXT-SESSION.md
git commit -m "docs: Zoom dev rollout status + deferred Marketplace publish"
```

---

## Self-Review Notes

- **Spec coverage:** dev/unpublished rollout (Task 1), credentials wiring (Tasks 1+4), regression tests for the previously-untested Zoom code (Tasks 2–3), provider-immutable confirmed (no task needed — current code already locks; `tests/publish.test.ts:24` covers the gate), deferred publish documented (Task 5).
- **No code changes to `src/`** — the Zoom integration is already implemented; this plan only adds credentials, docs, and tests. If Task 2's "expected PASS" tests instead FAIL, that surfaces a real bug in existing Zoom code; switch to systematic-debugging before altering tests.
- **Type consistency:** test args match `MeetingProvider.createMeeting` signature (`accessToken`, `title`, `startsAt`, `endsAt`, `timezone`) per `src/lib/providers/types.ts`; return shape `{ joinUrl, providerMeetingId }` per `zoom.ts:46`.
