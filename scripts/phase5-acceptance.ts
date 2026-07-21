/**
 * Phase 5 acceptance (spec §9): the first-real-site pipeline, end to end.
 *
 * Verifies against the LIVE stack that the pilot site built from
 * kb/fynbos-fern went through the actual pipeline:
 *  - create-site registration: content API serves the pilot only with its
 *    generated key (401 for bad key/unknown slug), tokens match the kb repo;
 *  - the typed seed: expected pages/section composition, every published
 *    section's props parse against the registry schema, every image ref
 *    resolves to a media row;
 *  - idempotency: two consecutive seed runs produce identical content;
 *  - isolation: the demo site is untouched; create-site refuses a dup slug.
 *
 * Requires: local Supabase, admin on :3000, the pilot created
 * (sites/fynbos-fern with .env.local) and seeded at least once.
 * Run with: pnpm test:phase5
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registry } from "../packages/sections/src/registry";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ADMIN = "http://127.0.0.1:3000";
const SLUG = "fynbos-fern";
const DEMO_KEY = process.env.DEMO_SITE_API_KEY ?? "local-dev-demo-content-key";

let passed = 0;
function ok(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
  passed += 1;
  console.log(`  ok - ${message}`);
}

function envLocal(): Record<string, string> {
  const file = join(ROOT, "sites", SLUG, ".env.local");
  if (!existsSync(file)) {
    throw new Error(
      `${file} not found — run \`pnpm create-site\` for the pilot first`,
    );
  }
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

async function fetchContent(key: string, slug = SLUG) {
  return fetch(`${ADMIN}/api/content/${slug}`, {
    headers: { "x-api-key": key },
  });
}

function runSeed() {
  const result = spawnSync("pnpm", ["--filter", `site-${SLUG}`, "seed"], {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`pilot seed failed:\n${result.stdout}\n${result.stderr}`);
  }
}

interface Payload {
  site: { name: string; tokens: Record<string, unknown> };
  pages: Array<{
    slug: string;
    title: string;
    status: string;
    seo: { description?: string };
    sections: Array<{ section_type: string; props: unknown; status: string }>;
  }>;
  media: Array<{ id: string; url: string; alt: string }>;
}

/** Strip volatile fields (row ids, timestamps) for run-to-run comparison. */
function normalize(payload: Payload) {
  return {
    pages: payload.pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      seo: p.seo,
      sections: p.sections.map((s) => ({
        type: s.section_type,
        props: s.props,
        status: s.status,
      })),
    })),
    media: payload.media
      .map((m) => ({ url: m.url.split("/").pop(), alt: m.alt }))
      .sort((a, b) => (a.url! < b.url! ? -1 : 1)),
  };
}

function collectMediaIds(value: unknown, into: Set<string>) {
  if (Array.isArray(value)) {
    for (const item of value) collectMediaIds(item, into);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.mediaId === "string") into.add(record.mediaId);
    for (const child of Object.values(record)) collectMediaIds(child, into);
  }
}

const EXPECTED_COMPOSITION: Record<string, string[]> = {
  "/": ["hero", "feature_grid", "testimonials", "image_text_split", "cta_banner"],
  "/portfolio": ["rich_text", "gallery", "testimonials", "cta_banner"],
  "/about": [
    "rich_text",
    "image_text_split",
    "faq_accordion",
    "logo_strip",
    "contact_form",
    "cta_banner",
  ],
};

async function main() {
  const env = envLocal();
  const key = env.SITE_API_KEY;
  ok(key && key.startsWith("fable_"), "pilot .env.local has a generated fable_ key");

  console.log("\n# create-site registration + key auth");
  ok((await fetchContent("wrong-key")).status === 401, "content API rejects a bad key (401)");
  ok(
    (await fetchContent(key!, "no-such-site")).status === 401,
    "unknown slug returns 401 (no slug leak)",
  );
  const first = await fetchContent(key!);
  ok(first.status === 200, "content API serves the pilot with its key");
  const payloadA = (await first.json()) as Payload;
  ok(payloadA.site.name === "Fynbos & Fern", "site name matches registration");

  const kbTokens = JSON.parse(
    readFileSync(join(ROOT, "kb", SLUG, "tokens.json"), "utf8"),
  ) as Record<string, unknown>;
  delete kbTokens.$comment;
  // Postgres jsonb re-orders keys — compare canonically, not by raw stringify.
  const canonical = (value: unknown): unknown =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : value;
  ok(
    JSON.stringify(canonical(payloadA.site.tokens)) === JSON.stringify(canonical(kbTokens)),
    "site tokens in the CMS match kb/fynbos-fern/tokens.json exactly",
  );

  console.log("\n# brief -> pages -> sections composition");
  ok(
    payloadA.pages.map((p) => p.slug).join(",") === "/,/portfolio,/about",
    "the three brief pages are published in nav order",
  );
  for (const page of payloadA.pages) {
    const types = page.sections.map((s) => s.section_type);
    ok(
      types.join(",") === EXPECTED_COMPOSITION[page.slug]!.join(","),
      `${page.slug} composition matches the brief (${types.length} sections)`,
    );
    ok(
      typeof page.seo.description === "string" && page.seo.description.length > 50,
      `${page.slug} has a real meta description`,
    );
  }

  console.log("\n# every published section validates against the registry");
  let sectionCount = 0;
  for (const page of payloadA.pages) {
    for (const section of page.sections) {
      const entry = registry[section.section_type as keyof typeof registry];
      ok(entry !== undefined, `${page.slug}: known type ${section.section_type}`);
      const parsed = entry.schema.safeParse(section.props);
      ok(
        parsed.success,
        `${page.slug} ${section.section_type} props parse against the schema`,
      );
      sectionCount += 1;
    }
  }
  ok(sectionCount === 15, "15 sections total across the pilot");

  console.log("\n# media integrity");
  ok(payloadA.media.length === 16, "16 kb assets present as media");
  const knownIds = new Set(payloadA.media.map((m) => m.id));
  const referenced = new Set<string>();
  for (const page of payloadA.pages) {
    for (const section of page.sections) collectMediaIds(section.props, referenced);
  }
  ok(referenced.size > 0, "sections reference media");
  for (const id of referenced) {
    ok(knownIds.has(id), `image ref ${id.slice(0, 8)}… resolves to a media row`);
  }
  ok(
    payloadA.media.every((m) => m.alt.length > 0),
    "every media row carries alt text",
  );

  console.log("\n# idempotency: reseed twice, content identical");
  runSeed();
  runSeed();
  const payloadB = (await (await fetchContent(key!)).json()) as Payload;
  ok(
    JSON.stringify(normalize(payloadA)) === JSON.stringify(normalize(payloadB)),
    "two consecutive seed runs produce identical normalized content",
  );

  console.log("\n# isolation + safety");
  const demo = await fetchContent(DEMO_KEY, "demo-site");
  ok(demo.status === 200, "demo site still serves with its own key");
  ok(
    (await fetchContent(DEMO_KEY)).status === 401,
    "demo key does not unlock the pilot site",
  );
  const dup = spawnSync(
    "pnpm",
    ["create-site", "--", "--slug", SLUG, "--name", "Duplicate"],
    { cwd: ROOT, shell: true, encoding: "utf8" },
  );
  ok(dup.status !== 0, "create-site refuses an existing slug/directory");

  console.log(`\nPhase 5 acceptance: ${passed} checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
