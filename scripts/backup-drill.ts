/**
 * Phase 7: the backup restore drill — proof, not hope.
 *
 *   pnpm backup:drill -- --yes
 *
 * 1. Snapshots every registered site's content API payload (drafts included)
 *    using the real per-site keys (sites/*'s .env.local + the demo key).
 * 2. Takes a fresh backup (scripts/backup.ts).
 * 3. DESTROYS the local database (`supabase db reset` — schema, zero data)
 *    and proves the loss: content APIs 401, admin login fails.
 * 4. Restores from the backup (scripts/restore-backup.ts).
 * 5. Verifies: content API payloads byte-identical, admin login works again
 *    (auth restored with password hashes), manifest counts already checked
 *    by the restore step.
 *
 * DESTRUCTIVE to local data between steps 3 and 4 — that is the point.
 * Requires the admin running on :3000. Run it whenever the backup story
 * changes, and on the cadence in BACKUPS.md. Log results there.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../packages/db/src/types";
import {
  ANON_KEY,
  DEMO_SITE_API_KEY,
  SEED_USERS,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "../packages/db/scripts/local-env";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ADMIN = "http://127.0.0.1:3000";
const SHELL = process.platform === "win32";

let passed = 0;
function ok(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
  passed += 1;
  console.log(`  ok - ${message}`);
}

function runScript(label: string, args: string[]) {
  const result = spawnSync("pnpm", args, {
    cwd: ROOT,
    shell: SHELL,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 64,
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

/** slug -> api key for every site with a local clone, plus the seeded demo. */
function siteKeys(): Map<string, string> {
  const keys = new Map<string, string>([["demo-site", DEMO_SITE_API_KEY]]);
  const sitesDir = join(ROOT, "sites");
  if (existsSync(sitesDir)) {
    for (const entry of readdirSync(sitesDir, { withFileTypes: true })) {
      const envFile = join(sitesDir, entry.name, ".env.local");
      if (!entry.isDirectory() || !existsSync(envFile)) continue;
      const env = readFileSync(envFile, "utf8");
      const slug = env.match(/^SITE_SLUG=(.+)$/m)?.[1];
      const key = env.match(/^SITE_API_KEY=(.+)$/m)?.[1];
      if (slug && key) keys.set(slug, key);
    }
  }
  return keys;
}

async function contentPayload(slug: string, key: string): Promise<string | null> {
  // Network-level failure counts as "not served" — around a stack reset the
  // admin's upstream (or a keep-alive socket) can drop mid-request.
  try {
    const response = await fetch(`${ADMIN}/api/content/${slug}?drafts=1`, {
      headers: { "x-api-key": key },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { media: Array<{ id: string }> };
    payload.media.sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

/** Post-restore reads retry briefly: the restarted stack needs a moment. */
async function contentPayloadEventually(
  slug: string,
  key: string,
  attempts = 30,
): Promise<string | null> {
  for (let i = 0; i < attempts; i += 1) {
    const payload = await contentPayload(slug, key);
    if (payload) return payload;
    await new Promise((sleep) => setTimeout(sleep, 1000));
  }
  return null;
}

async function loginWorks(): Promise<boolean> {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: SEED_USERS.studioAdmin.email,
    password: SEED_USERS.studioAdmin.password,
  });
  return !error && Boolean(data.user);
}

async function main() {
  if (!process.argv.includes("--yes")) {
    console.error(
      "backup-drill: DESTROYS and restores the local database. Re-run with --yes.",
    );
    process.exit(1);
  }
  console.log("# Backup restore drill");

  console.log("\n## 1. Snapshot every site's content API");
  const keys = siteKeys();
  const before = new Map<string, string>();
  for (const [slug, key] of keys) {
    const payload = await contentPayload(slug, key);
    if (payload) before.set(slug, payload);
  }
  ok(before.size >= 2, `snapshotted ${before.size} sites (${[...before.keys()].join(", ")})`);
  ok(await loginWorks(), "admin login works before the drill");

  console.log("\n## 2. Backup");
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  const backupDir = join("backups", `drill-${stamp}`);
  runScript("backup", ["backup", "--", "--out", backupDir]);
  ok(existsSync(join(ROOT, backupDir, "manifest.json")), `backup written to ${backupDir}`);

  console.log("\n## 3. Destroy (supabase db reset) and prove the loss");
  runScript("db reset", ["exec", "supabase", "db", "reset", "--local"]);
  const lostSite = [...before.keys()][0]!;
  ok(
    (await contentPayload(lostSite, keys.get(lostSite)!)) === null,
    "content API no longer serves anything (data really is gone)",
  );
  ok(!(await loginWorks()), "admin login fails (auth really is gone)");

  console.log("\n## 4. Restore from the backup");
  runScript("restore", ["restore-backup", "--", "--dir", backupDir, "--yes"]);

  console.log("\n## 5. Verify");
  ok(await loginWorks(), "admin login works again (password hashes restored)");
  for (const [slug, snapshot] of before) {
    const restored = await contentPayloadEventually(slug, keys.get(slug)!);
    ok(
      restored === snapshot,
      `content API payload for ${slug} is byte-identical after restore`,
    );
  }

  // Sanity: service role sees the same world (spot check one table).
  const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { count: sitesCount } = await db
    .from("sites")
    .select("id", { count: "exact", head: true });
  ok((sitesCount ?? 0) >= before.size, "sites table repopulated");

  console.log(`\nDrill complete: all ${passed} checks passed. Log this run in BACKUPS.md.`);
}

main().catch((error) => {
  console.error(`\nDRILL FAILED after ${passed} passing checks:\n${error.message ?? error}`);
  console.error(
    "The local stack may be in the destroyed state — restore manually with " +
      "pnpm restore-backup -- --dir <backup> --yes, or re-seed (pnpm db:seed).",
  );
  process.exit(1);
});
