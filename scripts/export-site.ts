/**
 * Phase 7: site exporter — client offboarding.
 *
 *   pnpm export-site -- --slug fynbos-fern [--out exports/fynbos-fern]
 *
 * Produces everything a departing client needs, with zero studio dependency:
 *
 *   {out}/export.json            all their rows: site (sans key hash), pages,
 *                                sections, media records, form submissions,
 *                                section revisions, activity log, members
 *   {out}/media/...              every storage object from media-{siteId}
 *   {out}/supabase-migrations/   the schema, for re-homing into a fresh
 *                                Supabase project (with import-site-export.ts)
 *   {out}/standalone/            a self-contained copy of their site repo:
 *                                vendored packages (no pnpm workspace), media
 *                                in public/cms-media, content-snapshot.json,
 *                                builds and deploys with CONTENT_SNAPSHOT_FILE
 *                                and no CMS at all
 *   {out}/README.md              the offboarding guide
 *
 * The inverse (restore into a Supabase project, preserving ids) is
 * scripts/import-site-export.ts — together they are the backup/offboarding
 * drill run by pnpm test:phase7.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../packages/db/src/types";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../packages/db/scripts/local-env";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message: string): never {
  console.error(`\nexport-site: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): { slug: string; out: string } {
  let slug: string | undefined;
  let out: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--slug") slug = argv[++i];
    else if (arg === "--out") out = argv[++i];
    else fail(`unknown argument: ${arg}`);
  }
  if (!slug) fail("--slug is required");
  return { slug, out: out ?? join("exports", slug) };
}

type Db = SupabaseClient<Database>;

async function listAllObjects(
  db: Db,
  bucket: string,
  prefix = "",
): Promise<string[]> {
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
      if (entry.id === null) {
        // Folder placeholder — recurse.
        paths.push(...(await listAllObjects(db, bucket, full)));
      } else {
        paths.push(full);
      }
    }
    if (data.length < 1000) break;
    offset += data.length;
  }
  return paths;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = resolve(ROOT, args.out);

  const db: Db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- 1. Rows ---------------------------------------------------------------
  const { data: site, error: siteError } = await db
    .from("sites")
    .select("id, slug, name, domain, tokens, settings, created_at")
    .eq("slug", args.slug)
    .maybeSingle();
  if (siteError) fail(siteError.message);
  if (!site) fail(`no site with slug "${args.slug}"`);

  const { data: pages, error: pagesError } = await db
    .from("pages")
    .select("*")
    .eq("site_id", site.id)
    .order("sort_order");
  if (pagesError) fail(`pages: ${pagesError.message}`);

  const pageIds = (pages ?? []).map((page) => page.id);
  const { data: sections, error: sectionsError } = pageIds.length
    ? await db.from("sections").select("*").in("page_id", pageIds).order("sort_order")
    : { data: [], error: null };
  if (sectionsError) fail(`sections: ${sectionsError.message}`);

  const { data: media, error: mediaError } = await db
    .from("media")
    .select("*")
    .eq("site_id", site.id)
    .order("id");
  if (mediaError) fail(`media: ${mediaError.message}`);

  const { data: submissions } = await db
    .from("form_submissions")
    .select("*")
    .eq("site_id", site.id)
    .order("created_at");
  const { data: revisions } = await db
    .from("section_revisions")
    .select("*")
    .eq("site_id", site.id)
    .order("id");
  const { data: activity } = await db
    .from("activity_log")
    .select("*")
    .eq("site_id", site.id)
    .order("id");

  const { data: memberRows } = await db
    .from("site_members")
    .select("user_id, role")
    .eq("site_id", site.id);
  const { data: userList } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const members = (memberRows ?? []).map((member) => ({
    role: member.role,
    email:
      userList?.users.find((user) => user.id === member.user_id)?.email ?? null,
  }));

  // --- 2. Storage objects ----------------------------------------------------
  const bucket = `media-${site.id}`;
  const objectPaths = await listAllObjects(db, bucket);
  const mediaDir = join(outDir, "media");
  mkdirSync(mediaDir, { recursive: true });
  for (const path of objectPaths) {
    const { data, error } = await db.storage.from(bucket).download(path);
    if (error || !data) fail(`downloading ${bucket}/${path}: ${error?.message}`);
    const target = join(mediaDir, ...path.split("/"));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(await data.arrayBuffer()));
  }
  console.log(`downloaded ${objectPaths.length} storage objects from ${bucket}`);

  // Integrity: every media row must have its file (a missing object would
  // silently ship a broken export).
  const objectSet = new Set(objectPaths);
  const missing = (media ?? []).filter((row) => !objectSet.has(row.path));
  if (missing.length > 0) {
    fail(
      `media rows without storage objects (export would be incomplete):\n  ${missing
        .map((row) => row.path)
        .join("\n  ")}`,
    );
  }

  // --- 3. export.json --------------------------------------------------------
  const exportPayload = {
    format: "fable-cms-site-export/1",
    exportedAt: new Date().toISOString(),
    source: { supabaseUrl: SUPABASE_URL },
    site,
    members,
    pages: pages ?? [],
    sections: sections ?? [],
    media: media ?? [],
    form_submissions: submissions ?? [],
    section_revisions: revisions ?? [],
    activity_log: activity ?? [],
  };
  writeFileSync(
    join(outDir, "export.json"),
    `${JSON.stringify(exportPayload, null, 2)}\n`,
  );

  // --- 4. Published content snapshot (content-API shape, local media URLs) ---
  const publishedPages = (pages ?? [])
    .filter((page) => page.status === "published")
    .map((page) => ({
      slug: page.slug,
      title: page.title,
      seo: page.seo,
      status: page.status,
      published_at: page.published_at,
      sort_order: page.sort_order,
      sections: (sections ?? [])
        .filter(
          (section) =>
            section.page_id === page.id && section.status === "published",
        )
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((section) => ({
          id: section.id,
          section_type: section.section_type,
          props: section.props,
          sort_order: section.sort_order,
          status: section.status,
        })),
    }));
  const snapshot = {
    site: {
      slug: site.slug,
      name: site.name,
      domain: site.domain,
      tokens: site.tokens,
      settings: site.settings,
    },
    pages: publishedPages,
    media: (media ?? []).map((row) => ({
      id: row.id,
      url: `/cms-media/${row.path}`,
      alt: row.alt ?? "",
      width: row.width,
      height: row.height,
    })),
  };
  writeFileSync(
    join(outDir, "content-snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );

  // --- 5. Schema for re-homing ----------------------------------------------
  cpSync(join(ROOT, "supabase", "migrations"), join(outDir, "supabase-migrations"), {
    recursive: true,
  });

  // --- 6. Standalone site bundle --------------------------------------------
  const cloneDir = join(ROOT, "sites", args.slug);
  const sourceDir = existsSync(cloneDir)
    ? cloneDir
    : join(ROOT, "apps", "site-template");
  if (sourceDir !== cloneDir) {
    console.warn(
      `warning: sites/${args.slug} not found — bundling the bare template instead`,
    );
  }
  const standaloneDir = join(outDir, "standalone");
  const EXCLUDE = new Set([
    "node_modules",
    ".next",
    ".env.local",
    "tsconfig.tsbuildinfo",
    "lighthouse.json",
  ]);
  cpSync(sourceDir, standaloneDir, {
    recursive: true,
    filter: (src) => !EXCLUDE.has(basename(src)),
  });
  for (const pkg of ["sections", "db", "config"]) {
    cpSync(join(ROOT, "packages", pkg), join(standaloneDir, "vendor", pkg), {
      recursive: true,
      filter: (src) => !EXCLUDE.has(basename(src)),
    });
  }

  // Workspace deps -> vendored file: deps; strip monorepo-only prehooks.
  const pkgPath = join(standaloneDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  if (pkg.dependencies) {
    pkg.dependencies["@fable/db"] = "file:./vendor/db";
    pkg.dependencies["@fable/sections"] = "file:./vendor/sections";
  }
  if (pkg.devDependencies) {
    pkg.devDependencies["@fable/config"] = "file:./vendor/config";
  }
  if (pkg.scripts) {
    for (const [key, value] of Object.entries(pkg.scripts)) {
      const stripped = value
        .replace(/node \.\.\/\.\.\/scripts\/free-port\.mjs[\d ]*&& /, "")
        .replace(/node \.\.\/\.\.\/scripts\/free-port\.mjs[\d ]*/, "")
        .trim();
      if (stripped === "") delete pkg.scripts[key];
      else pkg.scripts[key] = stripped;
    }
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  for (const vendored of ["sections", "db"]) {
    const vendorPkgPath = join(standaloneDir, "vendor", vendored, "package.json");
    const vendorPkg = JSON.parse(readFileSync(vendorPkgPath, "utf8")) as {
      devDependencies?: Record<string, string>;
    };
    if (vendorPkg.devDependencies?.["@fable/config"]) {
      vendorPkg.devDependencies["@fable/config"] = "file:../config";
    }
    writeFileSync(vendorPkgPath, `${JSON.stringify(vendorPkg, null, 2)}\n`);
  }

  // The vendored packages sit inside the app dir, so the site tsconfig's
  // `**/*.ts` include would sweep them into Next's typecheck — but their
  // imports resolve through node_modules (pnpm .pnpm graph), not in place.
  // Exclude the folder; the packages typecheck in the monorepo, and the app
  // code that consumes them is still fully checked.
  const tsconfigPath = join(standaloneDir, "tsconfig.json");
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8")) as {
    exclude?: string[];
  };
  tsconfig.exclude = [...new Set([...(tsconfig.exclude ?? []), "vendor"])];
  writeFileSync(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

  // Outside the monorepo there's no workspace config approving native build
  // scripts — without this, a fresh `pnpm install` stops at a prompt
  // (verified against pnpm 11; package.json's `pnpm` field is ignored there).
  writeFileSync(
    join(standaloneDir, "pnpm-workspace.yaml"),
    "allowBuilds:\n  esbuild: true\n  sharp: true\n",
  );

  // Media + snapshot inside the bundle; minimal env.
  cpSync(mediaDir, join(standaloneDir, "public", "cms-media"), { recursive: true });
  writeFileSync(
    join(standaloneDir, "content-snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );
  writeFileSync(
    join(standaloneDir, ".env.local"),
    [
      "# Snapshot mode: the site renders from content-snapshot.json + public/cms-media",
      "# with no CMS or Supabase dependency. Delete this var (and restore the",
      "# SITE_SLUG/SITE_API_KEY/CMS_API_URL trio) to reconnect to a CMS.",
      "CONTENT_SNAPSHOT_FILE=./content-snapshot.json",
      `SITE_URL=${site.domain ? `https://${site.domain}` : "http://localhost:3001"}`,
      "",
    ].join("\n"),
  );

  // --- 7. README -------------------------------------------------------------
  writeFileSync(
    join(outDir, "README.md"),
    `# Site export — ${site.name} (${site.slug})

Exported ${exportPayload.exportedAt} from ${SUPABASE_URL}.

You own everything in this folder. Nothing here depends on the studio's
infrastructure.

## What's here

- \`export.json\` — every content row: pages, sections, media records, form
  submissions, section revision history, activity log, member list (emails).
- \`media/\` — every uploaded file.
- \`standalone/\` — your website, ready to run without the CMS:
  \`\`\`
  cd standalone
  pnpm install   # or npm install
  pnpm build && pnpm start
  \`\`\`
  It renders from \`content-snapshot.json\` (your published content at export
  time) and \`public/cms-media/\`. Deploy it to Vercel/Netlify/anywhere as a
  normal Next.js app — set \`CONTENT_SNAPSHOT_FILE=./content-snapshot.json\`
  and \`SITE_URL=https://your-domain\` in the project's env.
- \`supabase-migrations/\` — the database schema, if you want a live CMS again.

## Re-homing into your own Supabase (optional, for continued editing)

1. Create a Supabase project; apply \`supabase-migrations/\` (supabase db push).
2. From the studio monorepo (or any checkout of it):
   \`SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm import-site -- --dir <this folder>\`
   This recreates all rows (ids preserved), the storage bucket, and prints a
   fresh content API key once.
3. Deploy the CMS admin app against that project, point the site's env back at
   it (SITE_SLUG/SITE_API_KEY/CMS_API_URL), and remove CONTENT_SNAPSHOT_FILE.

## Form submissions

Recent enquiries are in \`export.json\` under \`form_submissions\` — check for
any you haven't answered yet.
`,
  );

  console.log(`
export complete → ${outDir}
  site:        ${site.name} (${site.slug})
  pages:       ${(pages ?? []).length}
  sections:    ${(sections ?? []).length}
  media rows:  ${(media ?? []).length} (${objectPaths.length} files)
  submissions: ${(submissions ?? []).length}
  revisions:   ${(revisions ?? []).length}
  activity:    ${(activity ?? []).length}
  standalone:  ${standaloneDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
