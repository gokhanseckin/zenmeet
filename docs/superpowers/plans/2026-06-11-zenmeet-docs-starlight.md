# ZenMeet Docs (Starlight) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Starlight (Astro) documentation site at `docs-site/` that matches the supplied ZenMeet mockup — full nav IA, close-matching warm/terracotta theme, placeholder content on every page.

**Architecture:** A standalone Astro + `@astrojs/starlight` project living in `docs-site/` inside this repo, deployed later as its own Vercel project at `docs.zenmeet.me`. Starlight is consumed as an **unmodified npm dependency** — customized only via `astro.config.mjs`, a `customCss` stylesheet, and a minimal set of component overrides (`SiteTitle`, `SocialIcons`). No forking, no vendoring.

**Tech Stack:** Astro 6, `@astrojs/starlight` 0.40, MDX content, Pagefind search (built in), plain CSS custom-property overrides.

**Reference design:** `Zenmeet-designs/../ZenMeet Docs - Connect Stripe.html` mockup (palette, IA, components). Staged logo assets: `Zenmeet-designs/docs-assets/zenmeet-mark.png`, `Zenmeet-designs/docs-assets/zenmeet-logo.png`.

**Verification note:** A docs scaffold isn't TDD-amenable, so each task's "test" is a concrete check — `npm run build` succeeds and/or `grep` confirms required content/config. Every task ends in a commit. Run all commands from the repo root unless stated.

---

### Task 1: Scaffold the Starlight project

**Files:**
- Create: `docs-site/` (whole project tree via scaffolder)

- [ ] **Step 1: Run the non-interactive scaffolder**

Run from repo root:
```bash
npm create astro@latest docs-site -- --template starlight --install --no-git --skip-houston --typescript strict --yes
```
Expected: creates `docs-site/` with `package.json`, `astro.config.mjs`, `src/content/docs/`, and installs deps. (If `--install` is flaky in the sandbox, re-run `cd docs-site && npm install`.)

- [ ] **Step 2: Verify the dependency (not a fork) and build**

```bash
cd docs-site && grep '@astrojs/starlight' package.json && npm run build
```
Expected: `package.json` lists `@astrojs/starlight` as a dependency, and `npm run build` completes with a Pagefind index. Confirms Starlight is a package, not copied source.

- [ ] **Step 3: Add a docs-site .gitignore guard**

Ensure `docs-site/.gitignore` exists and ignores build output. If the scaffolder didn't create one, create `docs-site/.gitignore`:
```
dist/
node_modules/
.astro/
```

- [ ] **Step 4: Commit**

```bash
cd .. && git add docs-site && git reset docs-site/node_modules 2>/dev/null; git add docs-site && git commit -m "feat(docs): scaffold Starlight project in docs-site/"
```
(node_modules is ignored by the docs-site/.gitignore, so it won't be staged.)

---

### Task 2: Stage logo assets into the project

**Files:**
- Create: `docs-site/src/assets/zenmeet-mark.png`
- Create: `docs-site/src/assets/zenmeet-logo.png`
- Create: `docs-site/public/favicon.png`

- [ ] **Step 1: Copy the staged logos in**

```bash
mkdir -p docs-site/src/assets
cp Zenmeet-designs/docs-assets/zenmeet-mark.png docs-site/src/assets/zenmeet-mark.png
cp Zenmeet-designs/docs-assets/zenmeet-logo.png docs-site/src/assets/zenmeet-logo.png
cp Zenmeet-designs/docs-assets/zenmeet-mark.png docs-site/public/favicon.png
```

- [ ] **Step 2: Verify**

```bash
ls -la docs-site/src/assets/zenmeet-mark.png docs-site/src/assets/zenmeet-logo.png docs-site/public/favicon.png
```
Expected: all three files present, non-zero size.

- [ ] **Step 3: Commit**

```bash
git add docs-site/src/assets docs-site/public && git commit -m "feat(docs): add ZenMeet logo assets"
```

---

### Task 3: Theme stylesheet (warm/terracotta palette + fonts)

**Files:**
- Create: `docs-site/src/styles/custom.css`

- [ ] **Step 1: Write the custom stylesheet**

Create `docs-site/src/styles/custom.css`:
```css
/* ZenMeet docs theme — maps the mockup palette onto Starlight's CSS variables.
   Light is the canonical look; dark is a tuned complement. */

:root {
  /* Fonts (mockup: system sans + mono) */
  --sl-font: "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif;
  --sl-font-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}

/* ---------- Light theme (canonical) ---------- */
:root[data-theme='light'] {
  /* Accent — terracotta #b1492f */
  --sl-color-accent-low: #f3e0da;
  --sl-color-accent: #b1492f;
  --sl-color-accent-high: #7c3220;

  /* Text / ink scale */
  --sl-color-white: #2b2a27;      /* highest-contrast "white" slot = darkest ink in light mode */
  --sl-color-gray-1: #3a3833;
  --sl-color-gray-2: #6f6c64;
  --sl-color-gray-3: #a39e94;
  --sl-color-gray-4: #cbc7bd;
  --sl-color-gray-5: #e3dfd5;
  --sl-color-gray-6: #f1ede4;
  --sl-color-black: #faf8f3;       /* "black" slot = paper background in light mode */

  /* Surfaces */
  --sl-color-bg: #faf8f3;          /* paper */
  --sl-color-bg-nav: #faf8f3;
  --sl-color-bg-sidebar: #faf8f3;
  --sl-color-hairline: #e3dfd5;
  --sl-color-hairline-light: #f1ede4;
  --sl-color-text-accent: #b1492f;
}

/* ---------- Dark theme (tuned complement) ---------- */
:root[data-theme='dark'] {
  --sl-color-accent-low: #4a1d13;
  --sl-color-accent: #d4684c;
  --sl-color-accent-high: #f3d9d0;
  --sl-color-text-accent: #e08a72;
}

/* ---------- Small touches to match the mockup ---------- */
/* terracotta inline-code accent on a warm panel */
:root[data-theme='light'] .sl-markdown-content code {
  background: var(--sl-color-gray-6);
  border: 1px solid var(--sl-color-gray-5);
}

/* "Docs" pill spacing handled in SiteTitle override; header button styled there too. */
```

- [ ] **Step 2: Verify file exists and is referenced later**

```bash
test -f docs-site/src/styles/custom.css && echo OK
```
Expected: `OK`. (Wired into config in Task 4.)

- [ ] **Step 3: Commit**

```bash
git add docs-site/src/styles/custom.css && git commit -m "feat(docs): warm terracotta theme stylesheet"
```

---

### Task 4: Configure Starlight (title, logo, sidebar IA, customCss, overrides)

**Files:**
- Modify: `docs-site/astro.config.mjs` (replace the scaffolded `starlight({...})` block)

- [ ] **Step 1: Replace astro.config.mjs**

Overwrite `docs-site/astro.config.mjs` with:
```js
// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://docs.zenmeet.me',
  integrations: [
    starlight({
      title: 'ZenMeet Docs',
      logo: {
        src: './src/assets/zenmeet-mark.png',
        alt: 'ZenMeet',
        replacesTitle: true, // our SiteTitle override renders mark + wordmark + Docs tag
      },
      customCss: ['./src/styles/custom.css'],
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        SocialIcons: './src/components/HeaderActions.astro',
      },
      pagination: true,
      lastUpdated: true,
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'What is ZenMeet?', slug: 'what-is-zenmeet' },
            { label: 'Create your account', slug: 'create-your-account' },
          ],
        },
        {
          label: 'For teachers',
          items: [
            { label: 'Set up your classroom page', slug: 'set-up-classroom' },
            { label: 'Schedule live classes', slug: 'schedule-classes' },
            { label: 'Connect Stripe to get paid', slug: 'connect-stripe' },
            { label: 'Manage your members', slug: 'manage-members' },
            { label: 'Payouts & refunds', slug: 'payouts-and-refunds' },
          ],
        },
        {
          label: 'For students',
          items: [
            { label: 'Join a class', slug: 'join-a-class' },
            { label: 'Manage your membership', slug: 'manage-membership' },
          ],
        },
        {
          label: 'Help',
          items: [
            { label: 'FAQ', slug: 'faq' },
            { label: 'Contact support', slug: 'contact-support', badge: { text: '24h', variant: 'note' } },
          ],
        },
      ],
    }),
  ],
});
```

- [ ] **Step 2: Verify config parses and references are intact**

```bash
cd docs-site && node --check astro.config.mjs && grep -q "docs.zenmeet.me" astro.config.mjs && grep -q "24h" astro.config.mjs && echo OK; cd ..
```
Expected: `OK`. (Build is deferred to Task 5 once the override components + content exist, since the config now references components/slugs not yet created.)

- [ ] **Step 3: Commit**

```bash
git add docs-site/astro.config.mjs && git commit -m "feat(docs): configure sidebar IA, logo, theme, overrides"
```

---

### Task 5: Header override components (SiteTitle + HeaderActions)

**Files:**
- Create: `docs-site/src/components/SiteTitle.astro`
- Create: `docs-site/src/components/HeaderActions.astro`

- [ ] **Step 1: Write SiteTitle.astro (mark + wordmark + Docs tag)**

Create `docs-site/src/components/SiteTitle.astro`:
```astro
---
import { Image } from 'astro:assets';
import mark from '../assets/zenmeet-mark.png';
---
<a href="/" class="zm-brand">
  <Image src={mark} alt="ZenMeet" height={30} width={30} />
  <span class="zm-wordmark"><b>zen</b>meet</span>
  <span class="zm-docs-tag">Docs</span>
</a>

<style>
  .zm-brand { display: flex; align-items: center; gap: 10px; color: var(--sl-color-white); font-weight: 700; font-size: 18px; letter-spacing: -0.01em; text-decoration: none; }
  .zm-wordmark b { color: var(--sl-color-accent); }
  .zm-docs-tag {
    font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--sl-color-gray-2); border: 1px solid var(--sl-color-gray-4);
    border-radius: 20px; padding: 3px 9px; background: var(--sl-color-bg);
  }
</style>
```

- [ ] **Step 2: Write HeaderActions.astro (links + Open ZenMeet button)**

This overrides Starlight's `SocialIcons` slot (header right area). Create `docs-site/src/components/HeaderActions.astro`:
```astro
---
// Overrides Starlight's SocialIcons slot with ZenMeet header actions.
---
<div class="zm-actions">
  <a class="zm-navlink" href="/for-teachers">For teachers</a>
  <a class="zm-navlink" href="/for-students">For students</a>
  <a class="zm-openapp" href="https://zenmeet.me">
    Open ZenMeet
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
  </a>
</div>

<style>
  .zm-actions { display: flex; align-items: center; gap: 16px; }
  .zm-navlink { font-size: 14px; font-weight: 600; color: var(--sl-color-gray-2); text-decoration: none; }
  .zm-navlink:hover { color: var(--sl-color-white); }
  .zm-openapp {
    display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 15px;
    border-radius: 8px; background: var(--sl-color-accent); color: #fff;
    font-size: 13.5px; font-weight: 600; text-decoration: none; white-space: nowrap;
  }
  .zm-openapp:hover { filter: brightness(1.06); }
  @media (max-width: 50rem) { .zm-navlink { display: none; } }
</style>
```

> Note: the `/for-teachers` and `/for-students` links point at section landing routes that don't exist yet — acceptable for this structure-only pass (they 404 until content is added). Leave as-is; do not invent pages.

- [ ] **Step 3: Verify both components exist**

```bash
ls docs-site/src/components/SiteTitle.astro docs-site/src/components/HeaderActions.astro
```
Expected: both listed. (Full build verified in Task 6 once content pages exist.)

- [ ] **Step 4: Commit**

```bash
git add docs-site/src/components && git commit -m "feat(docs): custom SiteTitle and header actions"
```

---

### Task 6: Content pages (full IA, placeholder bodies)

**Files:**
- Modify/replace: `docs-site/src/content/docs/index.mdx`
- Create: `docs-site/src/content/docs/what-is-zenmeet.md`
- Create: `docs-site/src/content/docs/create-your-account.md`
- Create: `docs-site/src/content/docs/set-up-classroom.md`
- Create: `docs-site/src/content/docs/schedule-classes.md`
- Create: `docs-site/src/content/docs/connect-stripe.mdx`
- Create: `docs-site/src/content/docs/manage-members.md`
- Create: `docs-site/src/content/docs/payouts-and-refunds.md`
- Create: `docs-site/src/content/docs/join-a-class.md`
- Create: `docs-site/src/content/docs/manage-membership.md`
- Create: `docs-site/src/content/docs/faq.md`
- Create: `docs-site/src/content/docs/contact-support.md`
- Delete: any leftover scaffolded example pages under `src/content/docs/` (e.g. `guides/`, `reference/`)

- [ ] **Step 1: Remove scaffolded example content**

```bash
rm -rf docs-site/src/content/docs/guides docs-site/src/content/docs/reference
```

- [ ] **Step 2: Write the landing page**

Overwrite `docs-site/src/content/docs/index.mdx`:
```mdx
---
title: ZenMeet Docs
description: Guides for running and joining live online classes on ZenMeet.
template: splash
hero:
  tagline: Everything you need to run — or join — live online classes.
  actions:
    - text: What is ZenMeet?
      link: /what-is-zenmeet/
      icon: right-arrow
    - text: Open ZenMeet
      link: https://zenmeet.me
      variant: minimal
---

import { Card, CardGrid } from '@astrojs/starlight/components';

<CardGrid>
  <Card title="For teachers" icon="open-book">
    Set up your classroom, schedule classes, and get paid with Stripe.
  </Card>
  <Card title="For students" icon="user">
    Find a class, join, and manage your membership.
  </Card>
</CardGrid>
```

- [ ] **Step 3: Write the simple placeholder pages**

Create each of these `.md` files with the frontmatter + body shown. The body is a short placeholder — keep the H1 implicit via `title`.

`docs-site/src/content/docs/what-is-zenmeet.md`:
```md
---
title: What is ZenMeet?
description: An overview of ZenMeet for teachers and students.
---

ZenMeet lets teachers run recurring live online classes and lets students
subscribe and join. _Full content coming soon._

## How it works

Placeholder overview of the teacher and student journey.
```

`docs-site/src/content/docs/create-your-account.md`:
```md
---
title: Create your account
description: Sign up for ZenMeet as a teacher or a student.
---

_Full content coming soon._

## Sign up

Placeholder steps for creating an account.
```

`docs-site/src/content/docs/set-up-classroom.md`:
```md
---
title: Set up your classroom page
description: Create your public classroom page and custom URL.
---

_Full content coming soon._

## Your classroom page

Placeholder for naming your classroom and choosing a custom URL.
```

`docs-site/src/content/docs/schedule-classes.md`:
```md
---
title: Schedule live classes
description: Create one-off and recurring live classes.
---

_Full content coming soon._

## Create a class

Placeholder for scheduling recurring live classes.
```

`docs-site/src/content/docs/manage-members.md`:
```md
---
title: Manage your members
description: View and manage the members of your classroom.
---

_Full content coming soon._

## Your members

Placeholder for viewing and managing members.
```

`docs-site/src/content/docs/payouts-and-refunds.md`:
```md
---
title: Payouts & refunds
description: How payouts reach your bank and how refunds work.
---

_Full content coming soon._

## Payouts

Placeholder for payout schedule and refund handling.
```

`docs-site/src/content/docs/join-a-class.md`:
```md
---
title: Join a class
description: Find a classroom, subscribe, and join live classes.
---

_Full content coming soon._

## Joining

Placeholder for finding and joining a class.
```

`docs-site/src/content/docs/manage-membership.md`:
```md
---
title: Manage your membership
description: Update payment details, pause, or cancel your membership.
---

_Full content coming soon._

## Your membership

Placeholder for managing or cancelling a membership.
```

`docs-site/src/content/docs/faq.md`:
```md
---
title: FAQ
description: Frequently asked questions about ZenMeet.
---

_Full content coming soon._

## Common questions

Placeholder for frequently asked questions.
```

`docs-site/src/content/docs/contact-support.md`:
```md
---
title: Contact support
description: Reach the ZenMeet support team.
---

_Full content coming soon._

## Get help

We aim to reply within 24 hours. Placeholder for support contact details.
```

- [ ] **Step 4: Write the reference page (connect-stripe) with real heading skeleton + components**

Create `docs-site/src/content/docs/connect-stripe.mdx`:
```mdx
---
title: Connect Stripe to get paid
description: Connect your Stripe account so members can subscribe and pay you.
---

import { Steps } from '@astrojs/starlight/components';

ZenMeet uses Stripe to handle your members' subscriptions. Connect your Stripe
account once, and every payment goes straight to your bank — ZenMeet never holds
your money.

:::note
You don't need an existing Stripe account — you can create one during the
connection flow in about five minutes.
:::

## Before you start

- Your classroom page is set up and has a custom URL.
- You have your legal name, address, and bank details handy.
- You're in a country Stripe supports.

## Connect your account

<Steps>

1. **Open your payment settings** — from your teacher dashboard, go to
   Settings → Payments.

2. **Start the connection** — click **Connect with Stripe** to begin Stripe's
   secure onboarding.

3. **Complete Stripe's onboarding** — Stripe asks for your business details and
   payout bank account. Most teachers choose **Individual**.

4. **Return to ZenMeet** — your payment settings show **Stripe connected** and
   your **Join** button goes live.

</Steps>

## Set your monthly price

Set what members pay in Settings → Payments → Membership price. The price
appears on your public classroom page's **Join** button.

:::tip
Every membership starts with a 7-day free trial by default. Members aren't
charged until the trial ends, and they can cancel anytime.
:::

## How payouts work

| What | Details |
| --- | --- |
| First payout | Around 7 days after your first successful payment. |
| After that | Automatic, on a rolling daily schedule. |
| Fees | Stripe's processing fee is deducted from each payment. |

## Troubleshooting

<details>
<summary>Stripe says my account needs more information</summary>

Open Settings → Payments → Manage on Stripe and complete the requested steps —
payouts pause until you do.

</details>

<details>
<summary>I connected the wrong Stripe account</summary>

Go to Settings → Payments and choose **Disconnect**, then connect again with the
right account.

</details>
```

- [ ] **Step 5: Build the whole site (the real verification)**

```bash
cd docs-site && npm run build
```
Expected: build succeeds, no broken-link or missing-slug errors. Pagefind index builds.

- [ ] **Step 6: Verify every nav slug resolves and the badge is present**

```bash
grep -RhoE "slug: '[a-z-]+'" astro.config.mjs | sed "s/slug: '//;s/'//" | while read s; do ls src/content/docs/$s.md src/content/docs/$s.mdx >/dev/null 2>&1 && echo "ok $s" || echo "MISSING $s"; done; cd ..
```
Expected: every slug prints `ok` (none `MISSING`).

- [ ] **Step 7: Commit**

```bash
git add docs-site/src/content && git commit -m "feat(docs): full nav content with placeholders + Stripe reference page"
```

---

### Task 7: Deployment README

**Files:**
- Create: `docs-site/README.md`

- [ ] **Step 1: Write the README**

Create `docs-site/README.md`:
```md
# ZenMeet Docs

Documentation site for ZenMeet, built with [Starlight](https://starlight.astro.build)
(Astro). Starlight is an **npm dependency** (`@astrojs/starlight`) — not forked or
vendored. Customization lives in `astro.config.mjs`, `src/styles/custom.css`, and
`src/components/` overrides.

## Develop

```bash
cd docs-site
npm install
npm run dev      # http://localhost:4321
npm run build    # production build + Pagefind search index
npm run preview  # preview the build
```

## Deploy to docs.zenmeet.me

1. Create a **new Vercel project** from this repo.
2. Set **Root Directory** to `docs-site/` (Framework preset: Astro).
3. Deploy, then add the domain **docs.zenmeet.me** in the project's Domains tab.
4. Point a DNS **CNAME** record for `docs` at Vercel (`cname.vercel-dns.com`).

This is a separate Vercel project from the main ZenMeet app — they do not share a
build.
```

- [ ] **Step 2: Verify**

```bash
grep -q "Root Directory" docs-site/README.md && grep -q "docs.zenmeet.me" docs-site/README.md && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add docs-site/README.md && git commit -m "docs(docs-site): deployment + dev README"
```

---

### Task 8: Final full-build verification

- [ ] **Step 1: Clean build from scratch**

```bash
cd docs-site && rm -rf dist .astro && npm run build && cd ..
```
Expected: build succeeds end-to-end with no errors or warnings about missing pages/components.

- [ ] **Step 2: Confirm theme + override wiring landed**

```bash
cd docs-site
grep -q "b1492f" src/styles/custom.css \
  && grep -q "SiteTitle" astro.config.mjs \
  && grep -q "HeaderActions" astro.config.mjs \
  && grep -q "zm-docs-tag" src/components/SiteTitle.astro \
  && echo "WIRING OK"
cd ..
```
Expected: `WIRING OK`.

- [ ] **Step 3: No extra commit needed** unless Step 1/2 surfaced a fix. If a fix was required, commit it with a descriptive message.

---

## Done criteria

- `cd docs-site && npm run build` succeeds from a clean tree.
- Sidebar groups, labels, order, and the `24h` badge match the mockup.
- Palette (`#faf8f3` paper / `#b1492f` accent), system fonts, ZenMeet mark, `Docs` tag, and "Open ZenMeet" button are wired.
- All 11 nav pages + landing exist and resolve; `connect-stripe` carries the real heading skeleton with Steps/asides/table.
- Starlight remains an unmodified npm dependency.
