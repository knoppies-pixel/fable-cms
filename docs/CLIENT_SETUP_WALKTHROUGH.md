# Fable CMS — Full System Setup, Walked Through With an Example Client

Example client: **Coastal Plumbing Co**. Follow their site from signed contract to
live on the internet. Every repo structure and config shown below is what actually
exists in the system, not a simplification.

---

## 1. What exists before any client signs (the studio layer)

One GitHub organization, one core repo, shared by every client forever:

```
github.com/your-studio/
└── fable-cms/                    ← the studio monorepo (what you've been building)
    ├── apps/
    │   ├── admin/                ← the admin panel, ONE instance, ALL clients
    │   └── site-template/        ← the base template every client site is cloned from
    ├── packages/
    │   ├── sections/             ← the shared section library (10+ sections)
    │   ├── db/                   ← Supabase types + client helpers
    │   └── config/                ← shared Tailwind/TS config, base design tokens
    ├── design/                   ← the studio's OWN design system (Refined Coastal etc.)
    ├── CMS_SYSTEM_SPEC.md
    └── supabase/migrations/      ← the database schema, RLS policies
```

This repo deploys the **admin panel** to its own hosting (e.g. `admin.yourstudio.com`
on Vercel, one project, used by everyone). It is never cloned per client. Client
sites are cloned from `apps/site-template` — a *copy* of that folder becomes each
client's own repo.

One Supabase project also exists at the studio level — the single shared database
every client's content lives in, walled off by row-level security.

---

## 2. Coastal Plumbing Co signs — two new repos get created

```
github.com/your-studio/
├── fable-cms/                          (unchanged, shared)
├── kb-coastal-plumbing/                ← NEW: their knowledge repo
│   ├── brief.md
│   ├── tokens.json                     (once design is approved)
│   ├── design/
│   │   ├── home-desktop.png
│   │   └── notes.md
│   ├── keywords.md
│   └── assets/
│       └── logo.svg
└── sites-coastal-plumbing/             ← NEW: their live site repo
    ├── (cloned from apps/site-template)
    ├── app/
    ├── theme/tokens.json               (copied in from kb once approved)
    ├── package.json
    └── .env.local                      (their Supabase content API key — gitignored)
```

`kb-coastal-plumbing` never gets deployed anywhere — it's pure reference material.
`sites-coastal-plumbing` is real, runnable Next.js code, and it's the one repo
connected to Vercel.

> **Where these actually live today:** both start life as *folders inside the
> monorepo* — `kb/coastal-plumbing` and `sites/coastal-plumbing` (the latter
> created by `create-site.ts` in §4). Splitting the site out into its own GitHub
> repo happens at deploy/handoff time (or Vercel imports the monorepo with Root
> Directory = `sites/coastal-plumbing`). The diagram above shows the end state.

### brief.md, roughly:

```md
# Coastal Plumbing Co — Brief
Business: residential/commercial plumbing, Pretoria metro
Pages: Home, About, Services, Contact
Key selling points: 24/7 call-outs, licensed & insured, 15 years local
Tone: trustworthy, straightforward, no corporate jargon
Keywords: plumber pretoria, emergency plumber, drain cleaning pretoria
Reference sites liked: [client sent 2 competitor links]
```

---

## 3. The design session (Claude Design, browser)

Someone with design taste (you) feeds `kb-coastal-plumbing/brief.md` + their logo +
reference screenshots into Claude Design. Output after review/redline: an approved
`tokens.json` (their colors, type, spacing) and reference screenshots.

Both get **committed into `kb-coastal-plumbing`**:

```
kb-coastal-plumbing/
├── tokens.json          ← e.g. their blues/oranges, not Refined Coastal's palette
└── design/
    ├── home-desktop.png
    └── notes.md
```

Nothing about the live site changes yet — this repo is just the approved decision,
on record.

---

## 4. Site registration — `create-site.ts`

A senior team member runs the setup script from inside `fable-cms`:

```bash
cd fable-cms
pnpm create-site -- --slug coastal-plumbing --name "Coastal Plumbing Co" --domain coastalplumbing.co.za
```

(`--slug` and `--name` are required; `--domain` is optional and can be set later.
There's also `--kb` to point at the knowledge folder and `--admin-email` to attach
extra studio logins.)

What it does, concretely:

1. Inserts a row into the `sites` table in Supabase: `slug: coastal-plumbing`,
   generates a unique **site API key** (printed ONCE — only its hash is stored),
   plus fresh `PREVIEW_SECRET`/`REVALIDATE_SECRET` delivery secrets.
2. Creates the site's own storage bucket for images and attaches studio-admin
   membership(s).
3. Clones `apps/site-template` into `sites/coastal-plumbing` **inside the
   monorepo** (a new workspace member — it does NOT create or push a GitHub repo;
   pushing it as a standalone client repo, or importing the monorepo into Vercel
   with Root Directory = `sites/coastal-plumbing`, is a manual step from the
   printed handoff).
4. Copies `tokens.json` from `kb/coastal-plumbing` into the clone's
   `theme/tokens.json`, and writes a complete `.env.local` (gitignored — never
   committed) with the API key and all secrets.
5. Prints the full Vercel setup steps, including the exact env-var list (below).

---

## 5. Vercel setup (one-time, per client)

1. In Vercel, **New Project** → **Import Git Repository** → select
   `sites-coastal-plumbing`.
2. Vercel auto-detects Next.js — default build settings are correct, no changes
   needed.
3. **Environment variables** (all generated/printed by `create-site.ts` — copy
   from its handoff output or the clone's `.env.local` into Vercel's dashboard,
   never committed to git):
   ```
   SITE_SLUG=coastal-plumbing
   SITE_API_KEY=<the generated key, shown once by create-site.ts>
   CMS_API_URL=<the deployed admin panel, e.g. https://admin.yourstudio.com>
   SITE_URL=https://coastalplumbing.co.za
   PREVIEW_SECRET=<generated by create-site.ts>
   REVALIDATE_SECRET=<generated by create-site.ts>
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   SENTRY_DSN=<optional — error monitoring>
   NEXT_PUBLIC_SENTRY_DSN=<optional — same DSN, browser errors>
   ```
4. **Domain**: Settings → Domains → add `coastalplumbing.co.za`, follow Vercel's DNS
   instructions (the client points their domain's DNS at Vercel, or you do it on
   their behalf if you manage their DNS).
5. **Ownership**: the Vercel *project* lives under the studio's Vercel team by
   default at setup — for the "client owns it" model, either the client creates
   their own Vercel account and you get added as a team member on their project, or
   you transfer the project to their account once built. (Studio's actual policy on
   this — decide once and repeat it identically for every client.)
6. Click **Deploy**. First build takes a few minutes; every push to `main` after
   this auto-deploys.

Once deployed, the live URL exists (`coastalplumbing.co.za` or a `.vercel.app`
fallback) — but it's empty. No content yet.

---

## 6. Building the actual pages (Claude Code, in `sites-coastal-plumbing`)

```bash
cd sites-coastal-plumbing
claude
```

Prompt, roughly:

> Read ../kb-coastal-plumbing/brief.md. Build this client's site: create the pages
> listed (Home, About, Services, Contact), composing each from the existing section
> registry per CLAUDE.md conventions. Insert content as draft. Set SEO fields from
> the keyword list.

Claude Code reads the brief, then expresses the whole site as a **typed seed spec**
(`scripts/seed-content.ts`) — pages, sections, props, image references — and runs
`pnpm seed`. The seed tool validates every section against the registry's schemas
and writes the rows into the shared Supabase database (it runs with the service
role; row-level security is what scopes *admin-panel users*, not this studio-side
tool). The *code* in this repo barely changes; it's almost entirely content, and
content lives in the database.

---

## 7. Review, client approval, going live

1. **Internal review** via preview mode:
   `https://coastalplumbing.co.za/api/draft?secret=<PREVIEW_SECRET>&path=/`
2. **Client review** — same preview link (or a nicer share link if you build one),
   client gives feedback, edits happen through the admin panel exactly like content
   edits always do.
3. **Publish** — toggle each page live in the admin panel. Live within seconds
   (on-demand revalidation, no redeploy needed for content).

---

## 8. Steady state — what exists for Coastal Plumbing Co forever after

```
GitHub:
  kb-coastal-plumbing         (reference material, private, never deployed)
  sites-coastal-plumbing      (real code, deploys to Vercel on every push to main)

Supabase (shared instance, their data walled off by RLS):
  sites row: coastal-plumbing
  pages: Home, About, Services, Contact
  sections: ~15-20 rows across those pages
  media: their uploaded photos/logo

Vercel:
  1 project, coastalplumbing.co.za, auto-deploying from sites-coastal-plumbing

Admin panel (studio's ONE shared instance):
  Coastal Plumbing Co appears in the site switcher
  Their staff log in with client_editor role, edit content only
  Your studio staff log in with studio_admin role, full access
```

**Ongoing maintenance touches `sites-coastal-plumbing` code only when:** the studio
ships a new section into the shared library and this client wants it, or a
site-specific bug needs fixing. Day-to-day content changes never touch GitHub at
all — they happen entirely in the admin panel, writing directly to Supabase.

---

## 9. The pattern, generalized

Every client repeats steps 2–8 exactly. The studio repo (`fable-cms`) and the admin
panel never change per client — they're the shared factory. What's unique per client
is: one `kb-{client}` repo, one `sites-{client}` repo, one Vercel project, one row
in the `sites` table, and their own subset of `pages`/`sections`/`media` rows in the
one shared database.

This is why the tenth client is dramatically faster to onboard than the first —
almost everything above already exists; only the client-specific brief, design, and
content are new.
