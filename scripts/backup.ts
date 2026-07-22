/**
 * Phase 7: studio-side logical backup of the whole CMS stack.
 *
 *   pnpm backup [-- --out backups/<name>]
 *
 * Produces backups/<timestamp>/ with:
 *   auth-data.sql     auth schema data (users incl. password hashes, identities)
 *   public-data.sql   all content: sites, pages, sections, media rows,
 *                     form_submissions, section_revisions, activity_log
 *   storage/<bucket>/ every object of every media-* bucket
 *   buckets.json      bucket names + visibility for recreation
 *   manifest.json     row/object counts — what "complete" meant at backup time
 *
 * Schema is NOT backed up: supabase/migrations is the schema, in git.
 * Restore = scripts/restore-backup.ts; the periodic proof it works =
 * scripts/backup-drill.ts. See BACKUPS.md for cadence and the drill log.
 *
 * Works against the local stack by default; point SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY (+ --db-url for pg_dump) at a hosted project for
 * production backups.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../packages/db/src/types";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../packages/db/scripts/local-env";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHELL = process.platform === "win32";

function fail(message: string): never {
  console.error(`\nbackup: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { out: string; dbUrl: string | null } {
  let out: string | undefined;
  let dbUrl: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--out") out = argv[++i];
    else if (arg === "--db-url") dbUrl = argv[++i];
    else fail(`unknown argument: ${arg}`);
  }
  const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
  return { out: out ?? join("backups", stamp), dbUrl: dbUrl ?? null };
}

type Db = SupabaseClient<Database>;

async function listAllObjects(db: Db, bucket: string, prefix = ""): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await db.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset, sortBy: { column: "name", order: "asc" } });
    if (error) fail(`listing ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) paths.push(...(await listAllObjects(db, bucket, full)));
      else paths.push(full);
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return paths;
}

function dumpSchema(schema: string, file: string, dbUrl: string | null) {
  const args = [
    "exec",
    "supabase",
    "db",
    "dump",
    ...(dbUrl ? ["--db-url", dbUrl] : ["--local"]),
    "--data-only",
    "--use-copy",
    "--schema",
    schema,
    "-f",
    file,
  ];
  const result = spawnSync("pnpm", args, {
    cwd: ROOT,
    shell: SHELL,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    fail(`supabase db dump (${schema}) failed:\n${result.stdout}\n${result.stderr}`);
  }
  console.log(`dumped ${schema} schema data -> ${file}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(ROOT, args.out);
  mkdirSync(outDir, { recursive: true });

  // 1. Database data.
  dumpSchema("auth", join(outDir, "auth-data.sql"), args.dbUrl);
  dumpSchema("public", join(outDir, "public-data.sql"), args.dbUrl);

  // 2. Storage.
  const db: Db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: buckets, error: bucketsError } = await db.storage.listBuckets();
  if (bucketsError) fail(`listing buckets: ${bucketsError.message}`);
  const mediaBuckets = (buckets ?? []).filter((b) => b.name.startsWith("media-"));
  let objectCount = 0;
  for (const bucket of mediaBuckets) {
    const paths = await listAllObjects(db, bucket.name);
    for (const path of paths) {
      const { data, error } = await db.storage.from(bucket.name).download(path);
      if (error || !data) fail(`downloading ${bucket.name}/${path}: ${error?.message}`);
      const target = join(outDir, "storage", bucket.name, ...path.split("/"));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, Buffer.from(await data.arrayBuffer()));
      objectCount += 1;
    }
    console.log(`downloaded ${paths.length} objects from ${bucket.name}`);
  }
  writeFileSync(
    join(outDir, "buckets.json"),
    `${JSON.stringify(
      mediaBuckets.map((b) => ({ name: b.name, public: b.public })),
      null,
      2,
    )}\n`,
  );

  // 3. Manifest — the definition of "everything came back" for the drill.
  const count = async (table: keyof Database["public"]["Tables"]) =>
    (await db.from(table).select("*", { count: "exact", head: true })).count ?? 0;
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const manifest = {
    createdAt: new Date().toISOString(),
    supabaseUrl: SUPABASE_URL,
    counts: {
      users: userList?.users.length ?? 0,
      sites: await count("sites"),
      site_members: await count("site_members"),
      pages: await count("pages"),
      sections: await count("sections"),
      media: await count("media"),
      form_submissions: await count("form_submissions"),
      section_revisions: await count("section_revisions"),
      activity_log: await count("activity_log"),
      storage_objects: objectCount,
      buckets: mediaBuckets.length,
    },
  };
  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\nbackup complete -> ${outDir}`);
  console.log(JSON.stringify(manifest.counts));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
