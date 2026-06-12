# ZenMeet Docs — Starlight site (design spec)

**Date:** 2026-06-11
**Status:** Approved design, pre-plan
**Target:** `docs.zenmeet.me`

## Goal

Stand up a documentation site for ZenMeet built on **Starlight** (the Astro
docs framework), matching the supplied design mockup (`ZenMeet Docs - Connect
Stripe.html`). This initial build is **structure-only**: the full navigation
and a close-matching theme, with placeholder body copy on every page (real
prose comes later).

## Fork vs. copy vs. dependency — the decision

**We do not fork or copy the Starlight repository.** Starlight is consumed as a
published npm package, `@astrojs/starlight`, exactly as its maintainers intend.

- **Scaffold:** `npm create astro@latest docs-site -- --template starlight`.
  This template produces a *minimal* project — a `package.json`, an
  `astro.config.mjs`, a `tsconfig.json`, and a `src/content/docs/` folder. The
  project *depends on* `@astrojs/starlight`; it does not contain its source.
- **Why not fork:** forking means owning thousands of lines of theme/runtime
  code and manually rebasing every upstream release. Starlight is explicitly
  built to be customized *without* forking.
- **Why not copy:** copying component source into our tree freezes us on one
  version and breaks the upgrade path (`npm update @astrojs/starlight`).
- **How we customize instead** — three supported extension points, no vendoring:
  1. **Config** (`astro.config.mjs` → `starlight({...})`): title, logo,
     sidebar, social links, per-item badges, `customCss`.
  2. **`customCss`**: our own stylesheet that overrides Starlight's documented
     CSS custom properties (`--sl-color-*`, fonts, etc.) to hit the mockup's
     palette.
  3. **Component overrides** (`components` map in config): swap individual
     built-in components (e.g. `SiteTitle`, `Header`, `Hero`) for thin local
     wrappers when config + CSS can't reach a detail. We override the *minimum*
     needed and re-export the originals where possible.

The only files we author are config, CSS, a few small override components,
content `.mdx`, and assets. Upgrading Starlight stays a one-line dependency bump.

## Architecture

- **Location:** new project at `docs-site/` inside this repo (its own
  `package.json`, build, and `node_modules`). Zero coupling to the Next.js app.
- **Framework:** Astro + `@astrojs/starlight`. Built-in: left sidebar,
  full-text search (Pagefind), right-hand "On this page" TOC, breadcrumbs,
  prev/next pagination — all already mirrored by the mockup.
- **Build/deploy:** separate Vercel project, **root directory = `docs-site/`**,
  framework preset Astro. Served at `docs.zenmeet.me`.
- **Scope boundary:** AGENTS.md's "this is not the Next.js you know" warning
  applies to the Next.js app, **not** this Astro project. No changes to the
  Next.js app, DNS, or Vercel are made by the implementation — DNS/Vercel steps
  are *documented only*.

## Information architecture

Sidebar groups map 1:1 to the mockup and to content folders under
`src/content/docs/`. Order and labels are exact.

| Group | Page (slug) | Notes |
|---|---|---|
| Start here | `what-is-zenmeet` | |
| Start here | `create-your-account` | |
| For teachers | `set-up-classroom` | "Set up your classroom page" |
| For teachers | `schedule-classes` | "Schedule live classes" |
| For teachers | `connect-stripe` | reference page — real heading skeleton |
| For teachers | `manage-members` | |
| For teachers | `payouts-and-refunds` | |
| For students | `join-a-class` | |
| For students | `manage-membership` | |
| Help | `faq` | |
| Help | `contact-support` | sidebar **badge: `24h`** |

Plus `index.mdx` — a landing page (Starlight splash or simple intro).

**Content depth:** structure-only. Each page ships a correct H1 + lead +
section headings where the mockup tells us them; body text is short
placeholders. `connect-stripe` reproduces the mockup's heading skeleton
(*Before you start → Connect your account → Set your monthly price → How
payouts work → Troubleshooting*) so it reads as the canonical example page.

## Theming (close match via custom CSS)

`src/styles/custom.css`, registered through `customCss`, overrides Starlight's
documented variables to the mockup palette:

- **Palette:** paper `#faf8f3`, panel `#f1ede4`, card `#ffffff`, ink `#2b2a27`
  / `#6f6c64` / `#a39e94`, lines `#cbc7bd` / `#e3dfd5`. Accent **`#b1492f`**
  mapped onto `--sl-color-accent`, `--sl-color-accent-high`, `--sl-color-accent-low`.
- **Type:** body `"Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`;
  code `ui-monospace, "SF Mono", Menlo, Consolas, monospace`.
- **Theme mode:** light-first (the mockup is a warm light theme). Dark mode is
  tuned to a sensible complementary palette rather than left at Starlight's
  default; light remains the canonical look.
- **Accents on built-ins:** terracotta links, cream-tinted asides, step
  circles, breadcrumb "here" color — reached via CSS variable overrides, not
  component rewrites.

### Custom chrome (component overrides, minimal)
- **`SiteTitle`** override: ZenMeet mark + `zen`**meet** wordmark + small
  `Docs` pill tag.
- **Header actions:** "For teachers" / "For students" links and the terracotta
  **"Open ZenMeet"** button → Starlight `social`/`actions` config where it
  fits, otherwise a small header component override.
- **Nav badge:** `24h` on Contact support via native sidebar `badge`.

## Component mapping (native Starlight, no bespoke rebuild)

| Mockup widget | Starlight equivalent |
|---|---|
| Aside `note` / `tip` | `:::note` / `:::tip` |
| Numbered walkthrough | `<Steps>` |
| Troubleshooting accordions | native `<details>` / Starlight cards |
| "On this page" TOC, breadcrumbs, prev/next | built-in |
| Search ⌘K | built-in (Pagefind) |

## Assets

- Copy `zenmeet-mark.png` and `zenmeet-logo.png` from the design export into
  `docs-site/src/assets/` (and `public/favicon`), wired via Starlight `logo`
  and the `SiteTitle` override.

## Deployment (documented, not executed)

A short `docs-site/README.md` covering: create a Vercel project with root
`docs-site/`, Astro preset, then add `docs.zenmeet.me` as a domain and point
its DNS CNAME at Vercel. Optional `docs-site/vercel.json` if config-as-code is
preferred. No DNS or Vercel changes are made during implementation.

## Out of scope

- Real documentation copy (placeholders only this pass).
- DNS / Vercel project creation (documented only).
- Any change to the Next.js app, its deps, or shared tooling.
- Forking, vendoring, or patching Starlight source.

## Success criteria

- `cd docs-site && npm install && npm run dev` serves the site locally.
- `npm run build` succeeds (Pagefind index builds).
- Sidebar matches the mockup's groups, order, labels, and the `24h` badge.
- Palette, fonts, logo, `Docs` tag, and "Open ZenMeet" button visibly match
  the mockup in light mode.
- Every nav entry resolves to a real page (placeholder body allowed).
- Starlight remains an unmodified npm dependency (no forked/copied source).
