# Zoom Marketplace App Runbook (dev/unpublished)

Goal: a **General App** with **user-managed OAuth** that can create meetings on the
connected user's account via `POST /v2/users/me/meetings`.

## 1. Create the app
- https://marketplace.zoom.us → Develop → Build App → **General App**.
- App name: "Zenmeet".
- Auth: **User-managed OAuth** (NOT account-level / server-to-server).

## 2. OAuth redirect + allow list
- Redirect URL for OAuth:  `https://www.zenmeet.me/api/oauth/zoom/callback`
- OAuth allow list: add the same URL. For local dev also add
  `http://localhost:3000/api/oauth/zoom/callback` — `APP_URL` must match the host.

## 3. Scopes
- Scopes tab → add granular scope: **`meeting:write:meeting`** (create meetings).
  Add **`meeting:delete:meeting`** if you want the delete path covered.
- NOTE: Zoom scopes are configured HERE, not passed in the authorize URL — the
  app's `/api/oauth/zoom/start` route intentionally sends no `scope` param.

## 4. Credentials
- Copy **Client ID** and **Client Secret** from the App Credentials tab.

## 5. Test users (because we are NOT publishing)
- The owner's developer Zoom account is allowed automatically.
- Add any other teachers who must test Zoom as **test users** (Manage tab).
- Unpublished apps ONLY work for the developer + explicitly-added test users.
  Publishing (Marketplace review) is required before arbitrary teachers can connect.

## 6. Where to put the credentials
- Local: `.env.local` → `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` (replace `PLAC…` placeholders).
- Prod: `vercel env add ZOOM_CLIENT_ID production` and `... ZOOM_CLIENT_SECRET production`
  (project `gokhan-seckins-projects/zenmeet`), then redeploy.

## 7. Verify end-to-end
- Sign in as a teacher → onboarding "provider" step with a Zoom classroom →
  "Connect Zoom" → grant → callback persists `teachers.zoom_tokens_enc`.
- Publish the classroom; let `cron/tick` provision a session; confirm the session
  row gets `join_url` + `provider_meeting_id`.
