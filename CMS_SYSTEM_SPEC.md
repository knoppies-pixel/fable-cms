# Studio CMS — System Spec & Build Plan

> **Purpose of this document:** This is the seed spec for building a custom, AI-native headless CMS
> for a freelance web studio. It is written to be read by Claude Code at the start of every session.
> Work through the build phases in order. Do not skip acceptance criteria.

---

## 1. Vision

A self-owned CMS platform that replaces WordPress/Elementor for client marketing sites.

- Sites are **Next.js (App Router)** deployed on **Vercel** — fast, static-first, plain HTML/JS output.
- Content lives in **Supabase** (Postgres + Storage + Auth), edited through a custom **admin panel**.
- Pages are composed from a **section registry** of pre-built, tested React components.
- Clients own their Vercel project; the studio has team access. Easy exit = easy trust.
- Per-client **knowledge repos on GitHub** (brand, copy, keywords, brief) feed AI-assisted builds.
- Claude Code is the primary developer and site builder. The system is designed so an AI agent
  can build a full client site by inserting rows and composing registry sections.

**Explicitly out of scope (v1):** e-commerce (carts, payments, inventory), multi-language,
full revision history, freeform visual editing (Elementor-style arbitrary layout). Blog support
is a v1.5 goal, not v1.

---

## 2. Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Admin panel     │────▶│  Supabase             │◀────│  Client site      │
│  (Next.js app,   │     │  Postgres + Storage   │     │  (Next.js, from   │
│  studio-hosted)  │     │  + Auth + RLS         │     │  template repo)   │
└─────────────────┘     └──────────────────────┘     └────────┬─────────┘
        │                        ▲                            │ deploy
        │ on save: revalidate    │ per-site API key           ▼
        └────────────────────────┴──────────────────▶  Vercel (client-owned)
```

**Model: one multi-tenant admin + database, many client site repos.**

- **`cms-admin`** — one Next.js app, hosted by the studio. Multi-tenant: manages all client
  sites. Supabase RLS scopes every query to the client's site(s).
- **`site-template`** — a template repo. Each client site is created from it. Contains the
  renderer, the section registry package, base layout, Tailwind config, `CLAUDE.md`.
- **`sites/{client}`** — per-client repo cloned from the template, connected to the client's
  Vercel project. Reads content from Supabase using a scoped, read-only site key.
- **`kb/{client}`** — per-client knowledge repo: `brief.md`, `tokens.json`, brand assets,
  keyword list, tone-of-voice notes. Read by Claude Code during builds; not a runtime dependency.

**Why multi-tenant content DB (not per-client Supabase):** one schema to migrate, one admin to
maintain, one login for the studio. Clients still own the _site_ (repo + Vercel project). If a
client ever leaves, export their rows + assets to a standalone Supabase — write this exporter in
Phase 7, not before.

---

## 3. Tech stack

| Layer       | Choice                                     | Notes                                                                 |
| ----------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Framework   | Next.js 15+, App Router, TypeScript        | Server components by default                                          |
| Styling     | Tailwind CSS                               | Theme generated from `tokens.json` per site                           |
| Database    | Supabase Postgres                          | RLS on everything                                                     |
| Auth        | Supabase Auth                              | Studio admins + client editors                                        |
| Media       | Supabase Storage                           | One bucket per site: `media-{site_id}`                                |
| Rich text   | Tiptap (JSON stored, rendered server-side) | Do NOT build a custom editor                                          |
| Drag & drop | `@dnd-kit/core` + `@dnd-kit/sortable`      | Section reordering only, not freeform layout                          |
| Animations  | GSAP + ScrollTrigger (site-side)           | Registry sections may declare animation presets                       |
| Validation  | Zod                                        | Every section's props schema is a Zod schema — single source of truth |
| Deployment  | Vercel                                     | Client-owned projects, studio team access                             |

---

## 4. Data model

```sql
-- Tenancy ------------------------------------------------------------------
create table sites (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 'acme-plumbing'
  name          text not null,
  domain        text,                          -- 'acmeplumbing.co.za'
  tokens        jsonb not null default '{}',   -- design tokens (colors, type scale)
  settings      jsonb not null default '{}',   -- analytics IDs, social links, etc.
  api_key_hash  text not null,                 -- read-only content key for the site
  created_at    timestamptz default now()
);

create table site_members (
  site_id   uuid references sites(id) on delete cascade,
  user_id   uuid references auth.users(id) on delete cascade,
  role      text not null check (role in ('studio_admin','client_editor')),
  primary key (site_id, user_id)
);

-- Content ------------------------------------------------------------------
create table pages (
  id           uuid primary key default gen_random_uuid(),
  site_id      uuid not null references sites(id) on delete cascade,
  slug         text not null,                  -- '/', '/about', '/services/gutters'
  title        text not null,
  seo          jsonb not null default '{}',    -- meta description, og image, noindex
  status       text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  sort_order   int not null default 0,         -- nav ordering
  updated_at   timestamptz default now(),
  unique (site_id, slug)
);

create table sections (
  id           uuid primary key default gen_random_uuid(),
  page_id      uuid not null references pages(id) on delete cascade,
  section_type text not null,                  -- 'hero', 'feature_grid', 'testimonials'...
  props        jsonb not null default '{}',    -- validated against the registry's Zod schema
  sort_order   int not null,
  status       text not null default 'published' check (status in ('draft','published')),
  updated_at   timestamptz default now()
);

create table media (
  id         uuid primary key default gen_random_uuid(),
  site_id    uuid not null references sites(id) on delete cascade,
  path       text not null,                    -- storage path
  alt        text default '',
  width      int, height int,
  created_at timestamptz default now()
);

-- Draft/publish strategy (v1, simple): sections carry a status flag and the
-- admin edits props in place. A published page renders only published sections.
-- Snapshot-based drafts (copy-on-publish) are a Phase 7 upgrade if needed.
```

**RLS policy intent** (write the actual policies in Phase 1):

- `studio_admin` members: full CRUD on their sites' rows.
- `client_editor` members: read all, update `sections.props`, `pages.seo`, media CRUD on their
  site only. Cannot create/delete pages or change `section_type` (prevents breaking layouts).
- Site runtime access: a Postgres function `get_published_site(slug, api_key)` (security definer)
  returning published pages + sections, OR a thin `/api/content` route in the admin app checked
  against `api_key_hash`. Choose the API-route approach — simpler to cache and log.

---

## 5. Section registry — the core contract

The registry is a **package inside the template repo** (`packages/sections`). Every section type
exports exactly this shape:

```ts
// packages/sections/src/hero/index.ts
import { z } from "zod";

export const schema = z.object({
  heading: z.string().min(1).max(120),
  subheading: z.string().max(240).default(""),
  cta: z
    .object({ label: z.string(), href: z.string() })
    .nullable()
    .default(null),
  image: z
    .object({ mediaId: z.string().uuid(), alt: z.string() })
    .nullable()
    .default(null),
  variant: z.enum(["centered", "split", "full-bleed"]).default("centered"),
});

export type HeroProps = z.infer<typeof schema>;

export const meta = {
  type: "hero" as const,
  label: "Hero",
  description: "Top-of-page banner with heading, CTA, optional image.",
  category: "headers",
  icon: "layout-navbar", // Tabler icon name, used by the admin
  defaults: schema.parse({ heading: "Headline goes here" }),
};

export { Hero as Component } from "./Hero"; // the React server component
```

A generated `registry.ts` maps `section_type → { schema, meta, Component }`. Rules:

1. **The Zod schema is the single source of truth.** The admin panel auto-generates its edit
   form from the schema (string → text input, enum → select, image ref → media picker,
   array → repeatable group). Never hand-write admin forms per section.
2. **Renderer is dumb:** fetch page → for each published section, validate props, render
   `Registry[type].Component`. Unknown type or invalid props → render nothing in production,
   render a visible error card in preview mode.
3. **Additive schema changes only** once sections are in production (new fields need
   `.default()`). Breaking changes require a migration script over `sections.props`.
4. **v1 section set (build in this order):** `hero`, `rich_text`, `feature_grid`,
   `image_text_split`, `testimonials`, `cta_banner`, `faq_accordion`, `contact_form`,
   `gallery`, `logo_strip`. Ten sections is enough to build real sites.
5. `contact_form` submits to a Next.js route handler → stores in a `form_submissions` table
   - emails the client (use Resend). Include a honeypot field.

---

## 6. Rendering & publishing

- **Site pages are statically generated.** `generateStaticParams` from published page slugs;
  content fetched at build time and via ISR.
- **On-demand revalidation:** when the admin publishes/saves, it calls the site's
  `/api/revalidate?path=...` route (secret-protected). Content changes go live in seconds
  without a redeploy. Deploys are only needed for code/registry changes.
- **Preview mode:** admin "Preview" opens the site with Next.js draft mode enabled
  (secret cookie) so draft sections render, with the error cards described above.
- **SEO baked in:** per-page metadata from `pages.seo`, auto `sitemap.xml`, `robots.txt`,
  canonical URLs, OG image fallback from site settings. This is generated code in the
  template, not per-site work.

---

## 7. Admin panel

**MVP (Phases 2–4):**

- Site switcher (studio admins see all sites; client editors see theirs).
- Page list → page editor: vertical list of section cards, drag to reorder (`dnd-kit`),
  add-section drawer grouped by registry category, duplicate/delete section.
- Section editor: form auto-generated from the Zod schema, side-by-side live preview iframe
  (preview mode URL), save = validate → write props → revalidate.
- Media library per site: upload to Supabase Storage, browse grid, edit alt text, pick from
  any image field.
- Publish toggle per page and per section.

**Later (Phase 7+):** activity log, simple revision history (props snapshots on save),
client-facing dashboard with Lighthouse scores, multi-variant page generation.

**Design bar:** the admin must feel calmer and faster than WordPress. Instant saves,
optimistic UI, keyboard-friendly. No page reloads inside the editor.

---

## 8. Design workflow (Claude Design)

Claude Design (claude.ai/design) is used as the **pre-build exploration layer**. It is a
research-preview tool: it feeds the pipeline, it is never a runtime dependency. The system
of record for visual identity is always `kb/{client}/tokens.json` + the section registry.

**8.1 Studio design system.** Once the registry exists (after Phase 2), set up a Claude Design
design system by pointing it at `packages/sections` and the base theme. Its mockups then
compose from components that actually exist, styled with real tokens — no fantasy layouts.
Maintain one base studio system, plus one derived system per active client.

**8.2 Client design-direction step** (runs at the start of every client project, before
content seeding):

1. Feed Claude Design the client's `brief.md` and any brand assets.
2. Generate 2–3 homepage directions as interactive mockups; share with the client.
3. Refine the chosen direction via conversation/inline edits until approved.
4. Distill the approved direction into `kb/{client}/tokens.json` (colors, type scale,
   radius, spacing feel) plus reference screenshots saved to `kb/{client}/design/`.
5. From here the normal build flow takes over (`CLAUDE.md` §"Building a site from a brief").

**8.3 New-section prototyping loop.** When a brief needs a section type the registry lacks:
prototype it in Claude Design first → client/studio approval → hand off to Claude Code to
implement against the registry contract (Zod schema, `SectionShell`, token classes, both
default and empty states). Design explores; Code productionizes. Never ship Claude Design
output directly into `packages/sections` without refactoring it to the contract.

**8.4 Sales collateral.** Proposals and pitch one-pagers with an embedded mockup of the
prospect's future site, exported as PDF or shareable URL. Store per-prospect outputs in
`kb/{client}/proposals/`.

## 9. Build phases

Work strictly in order. Each phase ends with acceptance criteria — verify them (run the app,
run the checks) before moving on. Commit at every green checkpoint.

### Phase 0 — Monorepo scaffold

- pnpm workspace: `apps/admin`, `apps/site-template`, `packages/sections`, `packages/db`
  (generated Supabase types + client helpers), `packages/config` (shared TS/Tailwind config).
- Supabase project wired up locally (`supabase start`), env handling, CI stub (typecheck + build).
- **Accept:** both apps run dev servers; `pnpm build` passes clean.

### Phase 1 — Schema, RLS, seed

- Migrations for all tables in §4. RLS policies per §4. `/api/content/[siteSlug]` route in the
  admin app serving published content, authenticated by site API key.
- Seed script: one demo site, two pages, sections of at least 3 types.
- **Accept:** SQL tests (or a script) proving a `client_editor` cannot read another site's rows,
  cannot change `section_type`; content API returns the seeded site as JSON.

### Phase 2 — Registry + renderer

- Implement all 10 v1 sections with schemas, meta, defaults, and server components styled from
  `tokens.json`-driven Tailwind theme.
- Site template renders seeded pages fully; preview mode renders drafts + error cards.
- **Accept:** demo site builds statically, Lighthouse ≥ 95 performance / 100 SEO on the seeded
  home page; invalid props render error card in preview, nothing in prod.

### Phase 3 — Admin CRUD + auto-forms

- Auth (Supabase), site switcher, page list, section list per page.
- Zod-to-form generator covering: string, textarea (via `.describe('textarea')`), enum, boolean,
  number, nested object, array of objects, image ref (media picker), link object.
- Media library with upload + alt editing.
- **Accept:** create a page, add/edit/delete sections of every type through the UI only, upload
  and select an image — and the content API reflects it.

### Phase 4 — Drag & drop, preview, publishing

- dnd-kit reordering with optimistic persistence of `sort_order`.
- Live preview iframe beside the section form; on-demand revalidation on publish.
- Publish/draft toggles for pages and sections.
- **Accept:** full flow — reorder sections, edit hero heading, hit publish, deployed demo site
  shows the change within 10 seconds without a redeploy.

### Phase 5 — First real site pipeline

- Run the design-direction step (§8.2) for the pilot client; commit the approved
  `tokens.json` and reference screenshots to `kb/{client}` before any seeding.
- Script `create-site.ts`: registers site row + API key, clones template, writes site env,
  gives setup steps for the client-owned Vercel project.
- `CLAUDE.md` in the template: conventions for building a client site from a `kb/{client}`
  brief (map brief → pages → registry sections → insert rows via a typed seeding helper).
- **Accept:** build one real (or realistic pilot) site end-to-end from a brief using the system.

### Phase 6 — WordPress/Elementor migration tool

- CLI: crawl an existing site (or parse a WP export XML), extract pages, headings, copy,
  images; propose a mapping into registry sections as a reviewable JSON plan; on approval,
  download media into Storage and insert rows.
- Human-in-the-loop by design: the plan file is reviewed/edited before import.
- **Accept:** migrate one existing WordPress client site to a preview deployment.

### Phase 7 — Hardening & polish

- Props snapshots (lightweight revisions), activity log, site exporter (client offboarding),
  Lighthouse CI + link checker in the template's GitHub Actions, form spam protection review,
  error monitoring (Sentry), backup strategy for Supabase.

---

## 10. Conventions for Claude Code

- TypeScript strict; no `any` in `packages/*`.
- Every schema change = a Supabase migration file, never dashboard-only edits.
- After any change: `pnpm typecheck && pnpm build` before claiming done. Phases 2+: also run
  the seed + hit the content API as a smoke test.
- Keep sections presentational: no data fetching inside section components — props in,
  markup out. Site-level data flows from the page loader.
- Prefer server components; client components only for interactivity (accordion, form,
  gallery, dnd editor).
- Never commit secrets. `.env.example` stays current.
- When uncertain between two designs, implement the simpler one and leave a `DECISIONS.md`
  entry explaining the tradeoff.

## 11. Open decisions (revisit at Phase 5)

- Product name and admin domain.
- Resend vs. SMTP for form notifications.
- Whether blog/collections (repeatable content types) land in v1.5 as a `collections` table
  or as pages with a `post` layout.
- Snapshot-based drafts vs. in-place editing (only if clients complain).
