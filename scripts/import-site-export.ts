/**
 * Phase 7: import a site export (the inverse of export-site.ts).
 *
 *   pnpm import-site -- --dir exports/fynbos-fern [--api-key <key>]
 *
 * Restores a site into the target Supabase (SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY env; local stack by default): site row with its
 * ORIGINAL id, pages/sections/media with original ids and timestamps, the
 * storage bucket + files, form submissions, revision history and activity
 * log (history tables get fresh sequence ids, original order preserved).
 *
 * A content API key is generated and printed once (only its hash is stored).
 * --api-key supplies one instead — used by the offboarding drill so the
 * existing site clone keeps working after a destroy/restore round-trip.
 *
 * Refuses if the slug or site id already exists: importing over a live site
 * is never the answer (delete the site row + bucket first, deliberately).
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../packages/db/src/index";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../packages/db/scripts/local-env";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message: string): never {
  console.error(`\nimport-site: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { dir: string; apiKey: string | null } {
  let dir: string | undefined;
  let apiKey: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--dir") dir = argv[++i];
    else if (arg === "--api-key") apiKey = argv[++i];
    else fail(`unknown argument: ${arg}`);
  }
  if (!dir) fail("--dir is required");
  return { dir, apiKey: apiKey ?? null };
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

interface ExportPayload {
  format: string;
  site: {
    id: string;
    slug: string;
    name: string;
    domain: string | null;
    tokens: Json;
    settings: Json;
    created_at: string | null;
  };
  members: Array<{ role: string; email: string | null }>;
  pages: Array<Record<string, unknown>>;
  sections: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown> & { path: string }>;
  form_submissions: Array<Record<string, unknown>>;
  section_revisions: Array<Record<string, unknown>>;
  activity_log: Array<Record<string, unknown>>;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  // pnpm scripts run with a package cwd — relative paths mean "from the repo root".
  const dir = isAbsolute(args.dir) ? args.dir : resolve(ROOT, args.dir);
  const exportFile = join(dir, "export.json");
  if (!existsSync(exportFile)) fail(`${exportFile} not found`);
  const payload = JSON.parse(readFileSync(exportFile, "utf8")) as ExportPayload;
  if (payload.format !== "fable-cms-site-export/1") {
    fail(`unrecognized export format: ${payload.format}`);
  }

  const db: SupabaseClient<Database> = createClient<Database>(
    SUPABASE_URL,
    SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data: existing } = await db
    .from("sites")
    .select("id")
    .or(`slug.eq.${payload.site.slug},id.eq.${payload.site.id}`)
    .maybeSingle();
  if (existing) {
    fail(
      `site "${payload.site.slug}" (or its id) already exists — delete the row ` +
        `and its media bucket first if you really mean to replace it.`,
    );
  }

  // 1. Site row, original id preserved; fresh (or supplied) content key.
  const apiKey = args.apiKey ?? `fable_${randomBytes(32).toString("hex")}`;
  const { error: siteError } = await db.from("sites").insert({
    id: payload.site.id,
    slug: payload.site.slug,
    name: payload.site.name,
    domain: payload.site.domain,
    tokens: payload.site.tokens,
    settings: payload.site.settings,
    created_at: payload.site.created_at,
    api_key_hash: createHash("sha256").update(apiKey).digest("hex"),
  });
  if (siteError) fail(`site insert: ${siteError.message}`);

  // 2. Bucket + files.
  const bucket = `media-${payload.site.id}`;
  const { error: bucketError } = await db.storage.createBucket(bucket, {
    public: true,
  });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    fail(`bucket: ${bucketError.message}`);
  }
  let uploaded = 0;
  for (const row of payload.media) {
    const file = join(dir, "media", ...row.path.split("/"));
    if (!existsSync(file)) fail(`media file missing from export: ${row.path}`);
    const { error } = await db.storage
      .from(bucket)
      .upload(row.path, readFileSync(file), {
        contentType:
          CONTENT_TYPES[extname(row.path).toLowerCase()] ??
          "application/octet-stream",
        upsert: true,
      });
    if (error) fail(`uploading ${row.path}: ${error.message}`);
    uploaded += 1;
  }

  // 3. Rows, in FK order, ids and timestamps preserved.
  const insertAll = async (
    table: "pages" | "sections" | "media" | "form_submissions",
    rows: Array<Record<string, unknown>>,
  ) => {
    if (rows.length === 0) return;
    const { error } = await db.from(table).insert(rows as never);
    if (error) fail(`${table} insert: ${error.message}`);
  };
  await insertAll("pages", payload.pages);
  await insertAll("sections", payload.sections);
  await insertAll("media", payload.media);
  await insertAll("form_submissions", payload.form_submissions);

  // History tables use identity ids — insert without them (order preserved
  // by the export's id sort; created_at keeps true chronology).
  const stripId = (rows: Array<Record<string, unknown>>) =>
    rows.map(({ id: _id, ...rest }) => rest);
  if (payload.section_revisions.length > 0) {
    const { error } = await db
      .from("section_revisions")
      .insert(stripId(payload.section_revisions) as never);
    if (error) fail(`section_revisions insert: ${error.message}`);
  }
  if (payload.activity_log.length > 0) {
    const { error } = await db
      .from("activity_log")
      .insert(stripId(payload.activity_log) as never);
    if (error) fail(`activity_log insert: ${error.message}`);
  }

  // 4. Memberships by email, where the target knows the user.
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let attached = 0;
  for (const member of payload.members) {
    const user = userList?.users.find((u) => u.email === member.email);
    if (!user) {
      console.warn(
        `warning: no auth user ${member.email ?? "(unknown)"} in the target — ` +
          `create them, then insert their site_members row (role ${member.role}).`,
      );
      continue;
    }
    const { error } = await db.from("site_members").insert({
      site_id: payload.site.id,
      user_id: user.id,
      role: member.role,
    });
    if (error) fail(`membership ${member.email}: ${error.message}`);
    attached += 1;
  }

  console.log(`
import complete → ${SUPABASE_URL}
  site:        ${payload.site.name} (${payload.site.slug}, id preserved)
  pages:       ${payload.pages.length}
  sections:    ${payload.sections.length}
  media:       ${payload.media.length} rows, ${uploaded} files uploaded
  submissions: ${payload.form_submissions.length}
  revisions:   ${payload.section_revisions.length}
  activity:    ${payload.activity_log.length}
  members:     ${attached}/${payload.members.length} attached
${
  args.apiKey
    ? "  content API key: (supplied via --api-key, unchanged)"
    : `  content API key — SHOWN ONCE, only its hash is stored:\n\n    ${apiKey}`
}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
