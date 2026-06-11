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
