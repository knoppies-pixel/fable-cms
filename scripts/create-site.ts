/**
 * Phase 5: register a new client site and clone the template for it.
 *
 *   pnpm create-site -- --slug acme --name "Acme Plumbing" [options]
 *
 * Options:
 *   --slug <slug>          sites.slug, [a-z0-9-], required
 *   --name <name>          display name, required
 *   --domain <domain>      production domain (optional; can be set later)
 *   --kb <path>            knowledge repo (default kb/{slug}); its tokens.json
 *                          becomes the site's theme. Missing tokens fall back
 *                          to the template defaults with a warning.
 *   --port <port>          local dev port (default: first free slot from 3002,
 *                          judged by existing sites/[slug] package.json files)
 *   --admin-email <email>  existing auth user to attach as studio_admin
 *                          (repeatable; default admin@studio.local)
 *
 * What it does, in order:
 *   1. inserts the sites row: name, domain, tokens from kb, settings.delivery
 *      (local siteUrl + fresh preview/revalidate secrets), api_key_hash of a
 *      fresh high-entropy content key (printed ONCE at the end — only the
 *      SHA-256 lands in the database);
 *   2. creates the public media-{siteId} Storage bucket;
 *   3. attaches studio_admin membership(s);
 *   4. clones apps/site-template -> sites/{slug} (new pnpm workspace member),
 *      rewrites the package name + ports, writes theme/tokens.json from kb and
 *      a complete .env.local;
 *   5. prints the Vercel setup steps for the client-owned project.
 *
 * Requires local Supabase (or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY for a
 * real environment). Safe to abort: refuses to run if the slug or the target
 * directory already exists, so it never overwrites a live site.
 */
import { createHash, randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../packages/db/src/types";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../packages/db/scripts/local-env";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_DIR = join(ROOT, "apps", "site-template");
const SITES_DIR = join(ROOT, "sites");

// --- args -------------------------------------------------------------------

interface Args {
  slug: string;
  name: string;
  domain: string | null;
  kb: string;
  port: number;
  adminEmails: string[];
}

function fail(message: string): never {
  console.error(`\ncreate-site: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const values = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue; // pnpm forwards the separator literally
    if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      fail(`missing value for ${arg}`);
    }
    const list = values.get(arg) ?? [];
    list.push(value);
    values.set(arg, list);
    i += 1;
  }
  const single = (flag: string): string | undefined => {
    const list = values.get(flag);
    if (list && list.length > 1) fail(`${flag} given more than once`);
    return list?.[0];
  };

  const slug = single("--slug") ?? fail("--slug is required");
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slug)) {
    fail(`invalid slug "${slug}" — lowercase letters, digits and hyphens only`);
  }
  const name = single("--name") ?? fail("--name is required");

  const portRaw = single("--port");
  const port = portRaw ? Number(portRaw) : pickPort();
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    fail(`invalid --port "${portRaw}"`);
  }

  return {
    slug,
    name,
    domain: single("--domain") ?? null,
    kb: single("--kb") ?? `kb/${slug}`,
    port,
    adminEmails: values.get("--admin-email") ?? ["admin@studio.local"],
  };
}

/** First port from 3002 not claimed by an existing sites/* package.json. */
function pickPort(): number {
  const used = new Set<number>();
  if (existsSync(SITES_DIR)) {
    for (const entry of readdirSync(SITES_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const pkgPath = join(SITES_DIR, entry.name, "package.json");
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
        scripts?: Record<string, string>;
      };
      const match = pkg.scripts?.dev?.match(/--port (\d+)/);
      if (match) used.add(Number(match[1]));
    }
  }
  let port = 3002;
  while (used.has(port)) port += 1;
  return port;
}

// --- main -------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDir = join(SITES_DIR, args.slug);
  const kbDir = resolve(ROOT, args.kb);

  if (existsSync(targetDir)) {
    fail(`sites/${args.slug} already exists — refusing to overwrite it`);
  }

  // Tokens: kb is the source of truth; template defaults only as a fallback.
  const kbTokensPath = join(kbDir, "tokens.json");
  let tokensSource = kbTokensPath;
  if (!existsSync(kbTokensPath)) {
    tokensSource = join(TEMPLATE_DIR, "theme", "tokens.json");
    console.warn(
      `warning: ${args.kb}/tokens.json not found — falling back to template default tokens.\n` +
        `         Run the design-direction step (kb/README.md) before shipping this site.`,
    );
  }
  const tokens = JSON.parse(readFileSync(tokensSource, "utf8")) as Record<
    string,
    unknown
  >;
  delete tokens.$comment;

  const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existing, error: existingError } = await db
    .from("sites")
    .select("id")
    .eq("slug", args.slug)
    .maybeSingle();
  if (existingError) fail(`checking slug: ${existingError.message}`);
  if (existing) {
    fail(
      `a site with slug "${args.slug}" is already registered.\n` +
        `  To rebuild its repo, clone manually or remove the row first — this script\n` +
        `  never rotates keys or overwrites an existing registration.`,
    );
  }

  // 1. Register the site row. The content key is shown once and never stored.
  const apiKey = `fable_${randomBytes(32).toString("hex")}`;
  const previewSecret = randomBytes(24).toString("hex");
  const revalidateSecret = randomBytes(24).toString("hex");
  const localSiteUrl = `http://localhost:${args.port}`;

  const { data: site, error: siteError } = await db
    .from("sites")
    .insert({
      slug: args.slug,
      name: args.name,
      domain: args.domain,
      tokens,
      settings: {
        delivery: {
          siteUrl: localSiteUrl,
          previewSecret,
          revalidateSecret,
        },
      },
      api_key_hash: createHash("sha256").update(apiKey).digest("hex"),
    })
    .select("id")
    .single();
  if (siteError) fail(`inserting site: ${siteError.message}`);
  console.log(`registered site ${args.slug} (${site.id})`);

  // 2. Media bucket (public — media URLs are served straight from Storage).
  const bucket = `media-${site.id}`;
  const { error: bucketError } = await db.storage.createBucket(bucket, {
    public: true,
  });
  if (bucketError) fail(`creating bucket ${bucket}: ${bucketError.message}`);
  console.log(`created storage bucket ${bucket}`);

  // 3. studio_admin memberships for existing auth users.
  const { data: userList, error: listError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) fail(`listing users: ${listError.message}`);
  for (const email of args.adminEmails) {
    const user = userList.users.find((u) => u.email === email);
    if (!user) {
      console.warn(
        `warning: no auth user ${email} — create the user, then insert their site_members row.`,
      );
      continue;
    }
    const { error } = await db
      .from("site_members")
      .insert({ site_id: site.id, user_id: user.id, role: "studio_admin" });
    if (error) fail(`membership for ${email}: ${error.message}`);
    console.log(`attached ${email} as studio_admin`);
  }

  // 4. Clone the template.
  mkdirSync(SITES_DIR, { recursive: true });
  const EXCLUDE = new Set([
    "node_modules",
    ".next",
    ".env.local",
    "tsconfig.tsbuildinfo",
  ]);
  cpSync(TEMPLATE_DIR, targetDir, {
    recursive: true,
    filter: (src) => !EXCLUDE.has(basename(src)),
  });

  // Package name + ports. The template pins 3001 (and 3100 in prebuild's
  // free-port list); each clone gets its own pair so local dev servers of
  // several sites can coexist.
  const pkgPath = join(targetDir, "package.json");
  const pkg = readFileSync(pkgPath, "utf8")
    .replace(/"name": "site-template"/, `"name": "site-${args.slug}"`)
    .replaceAll("3001", String(args.port))
    .replaceAll("3100", String(args.port + 100));
  writeFileSync(pkgPath, pkg);

  const tokensOut = {
    $comment: `${args.name} — generated by create-site.ts from ${args.kb}/tokens.json. Edit kb first, then re-copy; run \`pnpm tokens:build\` after changes.`,
    ...tokens,
  };
  writeFileSync(
    join(targetDir, "theme", "tokens.json"),
    `${JSON.stringify(tokensOut, null, 2)}\n`,
  );

  writeFileSync(
    join(targetDir, ".env.local"),
    [
      `SITE_SLUG=${args.slug}`,
      `SITE_API_KEY=${apiKey}`,
      `CMS_API_URL=http://127.0.0.1:3000`,
      `SITE_URL=${localSiteUrl}`,
      `PREVIEW_SECRET=${previewSecret}`,
      `REVALIDATE_SECRET=${revalidateSecret}`,
      `NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
      "# Optional: Sentry error monitoring (set per environment)",
      "SENTRY_DSN=",
      "NEXT_PUBLIC_SENTRY_DSN=",
      "",
    ].join("\n"),
  );
  console.log(`cloned template -> sites/${args.slug} (dev port ${args.port})`);

  // 5. Operator handoff.
  const adminHost = "<your admin deployment, e.g. https://admin.studio.example>";
  console.log(`
──────────────────────────────────────────────────────────────────────────────
${args.name} is registered. Next steps:

  Local build
    1. pnpm install                       # link the new workspace package
    2. Build content per sites/${args.slug}/CLAUDE.md §"Building a site from a
       brief" (${args.kb}/brief.md -> scripts/seed-content.ts), then:
         pnpm --filter site-${args.slug} seed
    3. pnpm --filter site-${args.slug} dev   # ${localSiteUrl} (admin must run on :3000)

  Client-owned Vercel project
    1. Create a GitHub repo for the client and push sites/${args.slug}
       (or import this monorepo and set Root Directory = sites/${args.slug}).
    2. Vercel -> Add New Project -> import that repo. Framework: Next.js.
    3. Environment variables (Production + Preview):
         SITE_SLUG                 ${args.slug}
         SITE_API_KEY              (the key printed below)
         CMS_API_URL               ${adminHost}
         SITE_URL                  https://${args.domain ?? "<production-domain>"}
         PREVIEW_SECRET            ${previewSecret}
         REVALIDATE_SECRET         ${revalidateSecret}
         NEXT_PUBLIC_SUPABASE_URL  <your Supabase project URL>
         SENTRY_DSN                <optional — Sentry project DSN>
         NEXT_PUBLIC_SENTRY_DSN    <optional — same DSN, for browser errors>
    4. Add the client's domain to the project; invite the studio team.
    5. Point the admin at the deployed site so preview + revalidation work:
         update sites
           set settings = jsonb_set(settings, '{delivery,siteUrl}',
                                    '"https://${args.domain ?? "<production-domain>"}"')
           where slug = '${args.slug}';

  Content API key — SHOWN ONCE, only its hash is stored. Keep it in the
  password manager; rotating it means updating this row's api_key_hash.

    ${apiKey}
──────────────────────────────────────────────────────────────────────────────`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
