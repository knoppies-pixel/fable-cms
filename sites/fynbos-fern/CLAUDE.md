# CLAUDE.md — Client Site Template

You are working inside a client site built on the studio's custom CMS platform.
Read this file fully before making changes. The platform spec lives in `CMS_SYSTEM_SPEC.md`
at the monorepo root — consult it for schema and architecture questions.

## What this repo is

A Next.js (App Router, TypeScript) site cloned from `site-template`. It renders content
fetched from the studio CMS content API and deploys to a **client-owned Vercel project**.

- Content (pages, sections, media) lives in the CMS — **not in this repo**.
- This repo owns: the renderer, the section registry, design tokens, layout, SEO plumbing.
- Rule of thumb: **copy changes → CMS rows. Look/behavior changes → this repo.**
  If asked to "change the headline", that's a content edit — do it via the seeding/content
  helpers or tell the user to do it in the admin. Do not hardcode content into components.

## Building a site from a brief

Prerequisites (done before this repo existed, by `create-site.ts` at the monorepo root):
the site row + content API key are registered, `.env.local` is written, and
`theme/tokens.json` carries the client's approved tokens. The design-direction step
(`kb/README.md`) must have produced `kb/{client}/tokens.json` and `design/DIRECTION.md` —
if they're missing, stop and run that step first; never invent a direction while building.

When asked to build or extend a site from a client brief:

1. Read the client knowledge repo (`kb/{client}`): `brief.md`, `tokens.json`,
   `design/DIRECTION.md`, brand assets, keyword list. Treat `brief.md` as the spec —
   sitemap, sections per page, CTAs, keywords. DIRECTION.md's rules (band rhythm, edge
   pairing, ornament limits) govern which variants/props you pick.
2. If tokens changed since the clone, re-copy `kb/{client}/tokens.json` →
   `theme/tokens.json` and run `pnpm tokens:build`. Never hardcode brand colors
   in components.
3. Compose each page from **existing registry sections only**. Express the entire brief
   as the `SiteSeedSpec` in `scripts/seed-content.ts`: pages → sections → props, assets
   from `kb/{client}/assets` referenced via `img(file, alt)`, rich text via the `rt`
   builders. Props are compile-time typed per section type and validated against the
   registry's Zod schemas before any row is written. Then `pnpm seed` (idempotent —
   pages are replaced wholesale, media upserts; stop re-seeding once the client owns
   content in the admin).
4. Only create a **new section type** if no existing section or variant fits after genuinely
   trying. New sections follow the registry contract below and must be generic enough to
   reuse on other sites (no client names in section code).
5. Set per-page SEO as part of seeding — never as an afterthought. `title` is the **short
   nav label**; keyword-length titles go in `seo.title` (used verbatim as the tab/search
   title, include the brand suffix yourself). Meta descriptions use the keyword list.
6. Verify: `pnpm typecheck && pnpm build`, then `pnpm preview` and check every page renders
   with no error cards.

## Section registry contract

Each section in `packages/sections/src/{type}/` exports `schema` (Zod), `meta`, `Component`.

- The Zod schema is the single source of truth — admin forms are generated from it.
- Schema changes must be **additive with `.default()`** once a section is used in production.
  Breaking changes require a props migration script and a note in `DECISIONS.md`.
- Section components are **presentational server components**: props in, markup out.
  No data fetching inside sections. Client components (`'use client'`) only for
  interactivity: accordions, forms, galleries, animated wrappers.
- Every section must render acceptably with its `meta.defaults` and with all optional
  fields empty. Test both states.
- Images always render through `components/CmsImage.tsx` (handles Storage URLs, `next/image`
  sizing, alt text). Never use raw `<img>`.

## Styling

- Tailwind only, themed via CSS variables generated from `theme/tokens.json`.
  Use semantic token classes (`bg-surface`, `text-primary`, `text-muted`, `bg-accent`) —
  never raw palette values like `bg-blue-500` in section code.
- Mobile-first. Test at 375px, 768px, 1280px minimum.
- Spacing rhythm comes from the shared section wrapper (`SectionShell`) — sections do not
  set their own outer vertical padding.

## Animations (GSAP)

- All scroll animations go through `lib/animations/` presets (`fadeUp`, `staggerReveal`,
  `pinnedFade`) — registry sections declare a preset via props, they do not write their own
  ScrollTrigger code inline.
- Presets must: respect `prefers-reduced-motion` (no motion, content visible), clean up
  triggers on unmount, and use `dvh` units for any viewport-height pinning (mobile browser
  chrome jitter). Test pinned animations on mobile Safari sizing before calling them done.
- Content must be readable with JavaScript disabled — animations enhance, never gate.

## SEO & quality bar

Non-negotiable on every page before a change is "done":

- Unique title + meta description; canonical URL; valid `sitemap.xml` and `robots.txt`
  (generated — check they still build).
- One `h1` per page; heading levels don't skip; all images have meaningful alt text.
- Lighthouse ≥ 95 performance, 100 SEO, ≥ 95 accessibility on the built output
  (`pnpm build && pnpm lighthouse`). If a change drops a score, fix it or revert.
- The automated version of this bar is `pnpm quality` (also `.github/workflows/quality.yml`
  when this repo lives standalone): snapshot-mode build against the generated CI fixture,
  Lighthouse on `/` and `/sections` (perf error line 90 locally/CI — the documented
  HTTP/1.1 loopback artifact vs the ≥ 95 production bar), and an internal link check.
  A red gate blocks the change; don't lower thresholds to make it pass.

## Forms, monitoring, offboarding (Phase 7 plumbing)

- **Contact form**: `/api/contact` verifies a honeypot plus a signed interaction token
  (`/api/contact/token`, HMAC with `PREVIEW_SECRET`) and forwards submissions to the CMS
  forms API (`x-api-key`), which persists them (admin → Submissions) and, when
  `sites.settings.forms.notifyEmail` + the admin's `RESEND_API_KEY` are set, emails the
  client. Heuristic spam is stored flagged — never silently dropped. Don't weaken these
  layers; if a client reports missing enquiries, check the admin inbox first (spam flag),
  then Sentry.
- **Error monitoring**: Sentry is wired (instrumentation*.ts, `global-error.tsx`) and
  activates only when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` are set. Verify a live DSN
  with `SENTRY_SMOKE=1` + `/api/debug-sentry` (deliberate 500).
- **Snapshot mode**: with `CONTENT_SNAPSHOT_FILE` set, the site renders from a local
  content-API-shaped JSON (media under `public/cms-media/`) and needs no CMS at all.
  Used by CI and by `pnpm export-site` (monorepo root) — the client-offboarding exporter
  that produces a fully standalone copy of this site. Keep new code snapshot-safe: all
  content access goes through `lib/cms.ts`.

## Commands

- `pnpm dev` — run locally against the CMS content API (uses `SITE_API_KEY` in `.env.local`)
- `pnpm typecheck && pnpm build` — must pass before any task is considered complete
- `pnpm tokens:build` — regenerate Tailwind theme from `theme/tokens.json`
- `pnpm seed` — run `scripts/seed-content.ts` against the CMS (idempotent; safe to re-run;
  needs `SUPABASE_SERVICE_ROLE_KEY` in the env outside local dev)
- `pnpm preview` — production build + local serve
- `pnpm lighthouse` — Lighthouse against the running preview (writes `lighthouse.json`;
  quality bar above reads its scores)
- `pnpm quality` — the full automated gate: CI fixture → snapshot build → Lighthouse
  thresholds → internal link check (no CMS required)
- `pnpm ci:snapshot` — (re)generate the CI content fixture on its own

## Hard rules

- Never commit secrets; keep `.env.example` current when adding env vars.
- Never bypass the content API to hit Supabase directly from this repo's **runtime**
  (renderer, routes, components). The one sanctioned exception is the seeding tool
  (`scripts/seed-content.ts` / `seed-lib.ts`) — a studio-side authoring script that
  writes rows through the service role and never ships with the site.
- Never edit generated files (`registry.ts`, theme output) by hand.
- Deploys: pushing `main` deploys production on the client's Vercel project. Feature work
  happens on branches → preview deployments. Do not push directly to `main` unless the
  change has passed the quality bar above.
- When a design/implementation choice is ambiguous, pick the simpler option and record the
  tradeoff in `DECISIONS.md` rather than asking and stalling — unless the choice is
  client-visible (layout, copy, brand), in which case stop and ask.
