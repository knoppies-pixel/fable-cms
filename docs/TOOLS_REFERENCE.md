# Fable CMS — Software & Tools Reference

One line per tool: what it is, what you use it for, where you touch it.

---

## Development environment (your machine)

| Tool | What it is | You use it for |
|---|---|---|
| **Windows + PowerShell / Git Bash** | Terminal | Where every command below actually gets typed |
| **Node.js** | JavaScript runtime | Required to run pnpm, Next.js, and everything else |
| **pnpm** | Package manager | `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm typecheck` across the monorepo |
| **Git** | Version control | Tracks every change, enables branches/rollback |
| **Docker Desktop** | Container runtime | Runs your local Supabase database stack |

## AI tools — the actual workforce

| Tool | What it is | You use it for |
|---|---|---|
| **Claude Code** (terminal) | AI coding agent | Builds/maintains the codebase, runs migrations, writes tests, commits, deploys |
| **Claude Design** (claude.ai/design) | AI design tool | Generates & art-directs visual designs; syncs with your section library via `/design-sync` |
| **Claude.ai chat** | This conversation | Planning, review, second opinions, documentation, decisions |

## Infrastructure & hosting

| Tool | What it is | You use it for |
|---|---|---|
| **GitHub** | Code hosting | Every repo lives here: studio monorepo + per-client `kb/` and `sites/` repos |
| **GitHub Actions** | CI on every push | Typecheck + admin build, plus the automated site quality gate (Lighthouse + link checker) — wired in Phase 7, green |
| **Supabase** | Database platform | Postgres (content), Storage (images), Auth (logins) — local via Docker, cloud once deployed |
| **Vercel** | Website hosting | Hosts each client's *live* site, under the client's own account |
| **Sentry** | Error monitoring | Wired into both apps (Phase 7); activates when a DSN env var is set — nothing to do locally. Verify a live DSN with `pnpm sentry:smoke` |
| **Resend** | Transactional email | Emails contact-form submissions to clients — wired (Phase 7), env-gated: set `RESEND_API_KEY` + the site's `notifyEmail`; submissions persist in the admin inbox either way |

## The two apps you built (your product, not third-party tools)

| App | Path | What it's for |
|---|---|---|
| **Admin panel** | `apps/admin` | Where you and clients log in to edit content — pages, sections, media, publishing |
| **Client sites** | `apps/site-template` → cloned into `sites/{client}` | The live website itself, per client |

## Local dev utilities

| Tool | What it is | You use it for |
|---|---|---|
| **Supabase Studio** | Local DB GUI (`localhost:54323`) | Browsing/inspecting database rows directly, for debugging |
| **Browser DevTools** | Built into Chrome/Edge | Mobile-width testing, reduced-motion emulation, network/image debugging |
| **Lighthouse + linkinator** | Quality gate (`pnpm quality`) | The automated version of the manual Lighthouse runs — also runs in CI on every push (Phase 7) |
| **Backup & export scripts** | `pnpm backup` / `restore-backup` / `backup:drill`, `pnpm export-site` / `import-site` | Disaster recovery (restore-drilled, see `BACKUPS.md`) and client offboarding — Phase 7 deliverables |

## What clients and interns use

Just the **admin panel**, in a browser. Nothing else on this whole list. That's the design goal — everyone downstream of you never touches Git, Supabase, a terminal, or Vercel directly.

---

## Quick mental grouping

- **Build the factory** (you, occasionally): Node/pnpm/Git/Docker + Claude Code + GitHub
- **Design a client's look** (you, per client): Claude Design
- **Run the business day to day** (you, your team, clients): Admin panel only
- **Where things live**: GitHub (code) → Supabase (content/data) → Vercel (what visitors see)
