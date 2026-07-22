/**
 * Phase 7: restore a scripts/backup.ts backup into the LOCAL stack.
 *
 *   pnpm restore-backup -- --dir backups/<timestamp> --yes
 *
 * DESTRUCTIVE by design: runs `supabase db reset` (schema from migrations,
 * zero data), then loads the backup's auth + public data through psql inside
 * the database container, then recreates the media buckets and re-uploads
 * every object. --yes is required; there is no partial mode.
 *
 * For a hosted project the same shape applies (psql against the project's
 * connection string instead of docker exec) — see BACKUPS.md.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../packages/db/src/types";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../packages/db/scripts/local-env";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = process.platform === "win32";

function fail(message: string): never {
  console.error(`\nrestore-backup: ${message}`);
  process.exit(1);
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

function parseArgs(argv: string[]): { dir: string; yes: boolean } {
  let dir: string | undefined;
  let yes = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--dir") dir = argv[++i];
    else if (arg === "--yes") yes = true;
    else fail(`unknown argument: ${arg}`);
  }
  if (!dir) fail("--dir is required");
  return { dir: isAbsolute(dir) ? dir : resolve(ROOT, dir), yes };
}

function run(label: string, command: string, args: string[], input?: string) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    shell: SHELL,
    encoding: "utf8",
    input,
    maxBuffer: 1024 * 1024 * 512,
  });
  if (result.status !== 0) {
    fail(`${label} failed:\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function dbContainer(): string {
  const out = run("docker ps", "docker", ["ps", "--format", "{{.Names}}"]);
  const name = out
    .split(/\r?\n/)
    .find((line) => line.startsWith("supabase_db_"));
  if (!name) fail("no supabase_db_* container running — is the local stack up?");
  return name;
}

function applySql(container: string, file: string, label: string) {
  // Data-only dumps carry no FK ordering guarantees; replica role skips
  // constraint triggers for the load (single transaction, superuser).
  const sql = [
    "BEGIN;",
    "SET LOCAL session_replication_role = replica;",
    readFileSync(file, "utf8"),
    "COMMIT;",
  ].join("\n");
  run(
    `psql apply ${label}`,
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-f",
      "-",
    ],
    sql,
  );
  console.log(`applied ${label}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  for (const required of ["auth-data.sql", "public-data.sql", "buckets.json"]) {
    if (!existsSync(join(args.dir, required))) fail(`${required} missing from ${args.dir}`);
  }
  if (!args.yes) {
    fail(
      "this DESTROYS the current local database and replaces it with the " +
        "backup. Re-run with --yes if that is exactly what you want.",
    );
  }

  console.log("## 1/4 supabase db reset (schema from migrations, zero data)");
  run("supabase db reset", "pnpm", ["exec", "supabase", "db", "reset", "--local"]);

  console.log("## 2/4 load database data");
  const container = dbContainer();
  applySql(container, join(args.dir, "auth-data.sql"), "auth data");
  applySql(container, join(args.dir, "public-data.sql"), "public data");

  console.log("## 3/4 recreate buckets + upload objects");
  const db: SupabaseClient<Database> = createClient<Database>(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const buckets = JSON.parse(
    readFileSync(join(args.dir, "buckets.json"), "utf8"),
  ) as Array<{ name: string; public: boolean }>;
  let uploaded = 0;
  // db reset recreates the storage container; kong can keep routing to the
  // old upstream and 502 indefinitely (observed in the first live drill).
  // Retry, and if it hasn't recovered after ~20s, bounce kong — that is the
  // documented fix — then keep retrying.
  let kongRestarted = false;
  const createBucketEventually = async (name: string, isPublic: boolean) => {
    for (let attempt = 0; ; attempt += 1) {
      const { error } = await db.storage.createBucket(name, { public: isPublic });
      if (!error || /already exists/i.test(error.message)) return;
      if (attempt === 10 && !kongRestarted) {
        const kong = run("docker ps", "docker", ["ps", "--format", "{{.Names}}"])
          .split(/\r?\n/)
          .find((line) => line.startsWith("supabase_kong_"));
        if (kong) {
          console.log(`storage still 502ing after reset — restarting ${kong}`);
          run("docker restart kong", "docker", ["restart", kong]);
          kongRestarted = true;
        }
      }
      if (attempt >= 45) fail(`creating bucket ${name}: ${error.message}`);
      await new Promise((sleep) => setTimeout(sleep, 2000));
    }
  };
  for (const bucket of buckets) {
    await createBucketEventually(bucket.name, bucket.public);
    const dir = join(args.dir, "storage", bucket.name);
    if (!existsSync(dir)) continue;
    const walk = (rel: string): string[] => {
      const entries: string[] = [];
      for (const entry of readdirSync(join(dir, rel))) {
        const full = rel ? `${rel}/${entry}` : entry;
        if (statSync(join(dir, full)).isDirectory()) entries.push(...walk(full));
        else entries.push(full);
      }
      return entries;
    };
    for (const path of walk("")) {
      const { error: uploadError } = await db.storage
        .from(bucket.name)
        .upload(path, readFileSync(join(dir, path)), {
          contentType:
            CONTENT_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream",
          upsert: true,
        });
      if (uploadError) fail(`uploading ${bucket.name}/${path}: ${uploadError.message}`);
      uploaded += 1;
    }
  }
  console.log(`recreated ${buckets.length} buckets, uploaded ${uploaded} objects`);

  console.log("## 4/4 verify against the backup manifest");
  const manifestFile = join(args.dir, "manifest.json");
  if (existsSync(manifestFile)) {
    const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as {
      counts: Record<string, number>;
    };
    const count = async (table: keyof Database["public"]["Tables"]) =>
      (await db.from(table).select("*", { count: "exact", head: true })).count ?? 0;
    const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const now: Record<string, number> = {
      users: userList?.users.length ?? 0,
      sites: await count("sites"),
      site_members: await count("site_members"),
      pages: await count("pages"),
      sections: await count("sections"),
      media: await count("media"),
      form_submissions: await count("form_submissions"),
      section_revisions: await count("section_revisions"),
      activity_log: await count("activity_log"),
      storage_objects: uploaded,
      buckets: buckets.length,
    };
    let mismatched = false;
    for (const [key, expected] of Object.entries(manifest.counts)) {
      const actual = now[key];
      const match = actual === expected;
      if (!match) mismatched = true;
      console.log(`  ${match ? "ok " : "MISMATCH"} ${key}: ${actual} (backup had ${expected})`);
    }
    if (mismatched) fail("restored counts do not match the manifest");
  }

  console.log("\nrestore complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
