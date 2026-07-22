# Backups — strategy, runbook, drill log

The rule this document exists to enforce: **a backup that has never been
restored is a hope, not a backup.** Every change to this machinery reruns the
drill; the log at the bottom is the evidence.

## What is protected, and by what

| Asset | Where it lives | Protection |
| --- | --- | --- |
| Schema | `supabase/migrations/` | Git (this repo). Never backed up separately — restore replays migrations. |
| Content rows (sites, pages, sections, media, form_submissions, section_revisions, activity_log) | Postgres `public` schema | `pnpm backup` → `public-data.sql` |
| Logins (incl. password hashes) | Postgres `auth` schema | `pnpm backup` → `auth-data.sql` |
| Uploaded files | Storage `media-*` buckets | `pnpm backup` → `storage/<bucket>/...` + `buckets.json` |
| Site repos, kb repos, this platform | Git | GitHub remotes |
| Per-client data alone | — | `pnpm export-site` (offboarding exporter — separate tool, same discipline) |

Not covered: Studio/Inbucket state (ephemeral), storage objects not referenced
by a `media-*` bucket (none exist by design), Supabase Edge functions (none).

## Commands

- `pnpm backup` — write `backups/<timestamp>/` (db data + storage + manifest).
  `-- --out <dir>` to name it; `-- --db-url <url>` to dump a hosted project.
- `pnpm restore-backup -- --dir backups/<timestamp> --yes` — DESTRUCTIVE:
  `supabase db reset` (schema from migrations, zero data) → load auth+public
  data via psql in the db container → recreate buckets → re-upload objects →
  verify counts against the manifest. Local stack only.
- `pnpm backup:drill -- --yes` — the proof: snapshot all content APIs →
  backup → destroy the database → prove the loss (401s, login fails) →
  restore → assert byte-identical payloads + working login. Requires the
  admin on :3000.

## Cadence

- **Local/studio (now):** run `pnpm backup` before every risky operation
  (migration, import, bulk edit) and at least weekly while any real client
  content exists. Keep the last ~8 backups; `backups/` is gitignored — copy
  the latest to off-machine storage (external drive / cloud folder).
- **Hosted Supabase (at launch):** turn on the platform's daily backups
  (paid tier; PITR if the budget allows) **and still run this script** —
  platform backups don't cover "we deleted the project" or "the platform is
  the problem", and they can't be restore-drilled locally. Schedule
  `pnpm backup -- --db-url <project connection string>` (service key in env)
  weekly, store off-platform.
- **Drill:** rerun `pnpm backup:drill -- --yes` after any change to schema,
  backup scripts, or the storage layout — and quarterly regardless. Log below.

## Restore runbook (hosted, sketch — drill locally first)

1. Fresh/rescued Supabase project → `supabase db push` (schema from git).
2. `psql <connection-string> -f auth-data.sql` then `-f public-data.sql`
   (wrap with `SET session_replication_role = replica;` — data-only dumps
   carry no FK ordering; restore-backup.ts shows the exact incantation).
3. Recreate buckets + re-upload from `storage/` (restore-backup.ts logic,
   pointed at the project via SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).
4. Rotate any secrets that may have leaked with the incident; content API
   keys survive (hashes live in `sites`), site clones keep working.

## Known local-stack quirks (hit in real drills, handled in the scripts)

- After `supabase db reset`, kong can keep routing storage requests to the
  dead storage container and 502 forever. `restore-backup.ts` retries and
  bounces the kong container automatically after ~20s of failures.
- `db reset` orphans old storage files inside the docker volume (objects
  table is wiped, files linger). Harmless locally; re-uploads are keyed by
  path.

## Drill log

| Date | Backup | Result |
| --- | --- | --- |
| 2026-07-22 | `drill-2026-07-22T09-08-46` | **PASS 10/10** — 3 sites (demo-site, fynbos-fern, mulkern-demo), 2 users, 14 pages / 87 sections / 79 media rows + 79 objects / 4 submissions / 22 revisions / 5 activity events. Destruction proven (content APIs dead, login dead), restore byte-identical on all three content payloads, login restored from dumped password hashes, manifest counts exact. First run surfaced the kong-502 quirk → auto-restart added to restore-backup.ts and re-proven in the same session. |
