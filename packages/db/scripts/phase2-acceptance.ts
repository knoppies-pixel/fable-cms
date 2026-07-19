/**
 * Phase 2 acceptance tests (spec §9, Phase 2):
 *   1. Content API serves media and, with ?drafts=1, draft sections.
 *   2. The statically built demo site renders the seeded pages.
 *   3. Invalid props / unknown types render NOTHING in production and a
 *      visible error card in preview mode; drafts appear only in preview.
 *   4. SEO plumbing: metadata, sitemap.xml, robots.txt.
 *
 * Requires: seeded DB, admin server (CONTENT_API_BASE, default :3000) and the
 * built site running (SITE_BASE, default :3001). Lighthouse runs separately.
 * Run with: pnpm db:test:phase2
 */
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO_SITE_API_KEY, SUPABASE_URL } from "./local-env";
import { seed } from "./seed";

const CONTENT_API_BASE = process.env.CONTENT_API_BASE ?? "http://localhost:3000";
const SITE_BASE = process.env.SITE_BASE ?? "http://localhost:3001";
const PREVIEW_SECRET = process.env.PREVIEW_SECRET ?? "local-preview-secret";
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "local-revalidate-secret";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
  }
}

interface ContentPayload {
  pages: Array<{
    slug: string;
    sections: Array<{ id: string; section_type: string; status: string }>;
  }>;
  media: Array<{ id: string; url: string; width: number | null }>;
}

async function fetchContent(drafts: boolean): Promise<ContentPayload> {
  const response = await fetch(
    `${CONTENT_API_BASE}/api/content/demo-site${drafts ? "?drafts=1" : ""}`,
    { headers: { "x-api-key": DEMO_SITE_API_KEY } },
  );
  if (!response.ok) throw new Error(`content API ${response.status}`);
  return (await response.json()) as ContentPayload;
}

async function main() {
  await seed(); // fresh fixtures every run — suites are order-independent

  // The site server is long-lived and its ISR cache still holds whatever the
  // previous suite left behind — resync it to the fresh seed via Phase 4's
  // on-demand revalidation, and wait until the seeded home page is served.
  const resync = await fetch(`${SITE_BASE}/api/revalidate`, {
    method: "POST",
    headers: { "x-revalidate-secret": REVALIDATE_SECRET },
  });
  if (!resync.ok) {
    throw new Error(`site /api/revalidate failed: HTTP ${resync.status}`);
  }
  const resyncDeadline = Date.now() + 15_000;
  for (;;) {
    const html = await (await fetch(`${SITE_BASE}/`)).text();
    if (
      html.includes("Plumbing done right, the first time") &&
      !html.includes("Winter special")
    ) {
      break;
    }
    if (Date.now() > resyncDeadline) {
      throw new Error("production site did not resync to the fresh seed");
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  console.log("--- Content API: media + drafts ---");

  const published = await fetchContent(false);
  check(
    "media array present with storage URLs and dimensions",
    published.media.length >= 10 &&
      published.media.every(
        (m) => m.url.includes("/storage/v1/object/public/media-") && m.width !== null,
      ),
    published.media.slice(0, 2),
  );
  check(
    "media URLs start with the configured Supabase origin",
    published.media.length > 0 &&
      published.media.every((m) =>
        m.url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/media-`),
      ),
    published.media.slice(0, 1),
  );
  const publishedSections = published.pages.flatMap((p) => p.sections);
  check(
    "published payload has no draft sections",
    publishedSections.every((s) => s.status === "published"),
  );

  const drafted = await fetchContent(true);
  const draftSections = drafted.pages
    .flatMap((p) => p.sections)
    .filter((s) => s.status === "draft");
  check(
    "?drafts=1 includes draft sections",
    draftSections.length >= 1,
    draftSections,
  );

  console.log("\n--- Production rendering ---");

  const prodHome = await (await fetch(`${SITE_BASE}/`)).text();
  check(
    "home renders the hero heading",
    prodHome.includes("Plumbing done right, the first time"),
  );
  check(
    "home renders images through the CMS media pipeline",
    prodHome.includes("hero.jpg") || prodHome.includes("/_next/image"),
  );
  // Grepping HTML is not enough — the optimizer can 400 on a URL the page
  // happily embeds (e.g. blocked local IPs). Fetch a real optimized image.
  const imgSrc = prodHome
    .match(/src="(\/_next\/image[^"]+)"/)?.[1]
    ?.replace(/&amp;/g, "&");
  const imgResponse = imgSrc
    ? await fetch(`${SITE_BASE}${imgSrc}`)
    : null;
  check(
    "image optimizer serves an actual image (200, image/*)",
    imgResponse !== null &&
      imgResponse.status === 200 &&
      (imgResponse.headers.get("content-type") ?? "").startsWith("image/"),
    { imgSrc, status: imgResponse?.status },
  );
  check(
    "draft section (Winter special) is NOT rendered in production",
    !prodHome.includes("Winter special"),
  );
  check("no error cards on production home", !prodHome.includes("data-section-error"));

  const prodAbout = await (await fetch(`${SITE_BASE}/about`)).text();
  check(
    "about renders published content",
    prodAbout.includes("About Demo Plumbing Co") &&
      prodAbout.includes("Frequently asked questions"),
  );
  check(
    "invalid-props + unknown-type sections render NOTHING in production",
    !prodAbout.includes("data-section-error") &&
      !prodAbout.includes("legacy_widget") &&
      !prodAbout.includes("marquee"),
  );

  console.log("\n--- Preview mode (draft mode) ---");

  const enable = await fetch(
    `${SITE_BASE}/api/draft?secret=${PREVIEW_SECRET}&path=/about`,
    { redirect: "manual" },
  );
  check(
    "preview enable redirects",
    enable.status >= 300 && enable.status < 400,
    enable.status,
  );
  const cookies = enable.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  check("preview sets the draft-mode bypass cookie", cookies.includes("__prerender_bypass"));

  const badSecret = await fetch(`${SITE_BASE}/api/draft?secret=nope&path=/`, {
    redirect: "manual",
  });
  check("wrong preview secret is rejected", badSecret.status === 401);

  const previewAbout = await (
    await fetch(`${SITE_BASE}/about`, { headers: { cookie: cookies } })
  ).text();
  // Count DOM occurrences only — the attribute also appears in the
  // serialized RSC flight payload (as a quoted JSON key), which we ignore.
  const errorCards = previewAbout.split("<div data-section-error").length - 1;
  check(
    "preview /about shows 2 error cards (invalid props + unknown type)",
    errorCards === 2,
    { errorCards },
  );
  check(
    "error card names the failing field",
    previewAbout.includes("heading") && previewAbout.includes("legacy_widget"),
  );

  const previewHome = await (
    await fetch(`${SITE_BASE}/`, { headers: { cookie: cookies } })
  ).text();
  check(
    "preview home renders the draft section with a draft badge",
    previewHome.includes("Winter special") && previewHome.includes("data-draft-section"),
  );

  console.log("\n--- Config guard: image host must derive or fail loudly ---");

  // Broken images in production is the silent failure we design against:
  // evaluate the site's next.config.ts under controlled env (it has no
  // runtime imports) and assert the guard fires exactly when it should.
  const siteConfigPath = join(
    fileURLToPath(new URL(".", import.meta.url)),
    "..", "..", "..", "apps", "site-template", "next.config.ts",
  );
  const evalConfig = (env: Record<string, string | undefined>) => {
    const childEnv: NodeJS.ProcessEnv = { ...process.env, ...env };
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete childEnv[key];
    }
    return spawnSync("npx", ["tsx", siteConfigPath], {
      env: childEnv,
      shell: true,
      encoding: "utf8",
      timeout: 60_000,
    });
  };

  const prodMissing = evalConfig({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: undefined,
  });
  check(
    "production config throws when NEXT_PUBLIC_SUPABASE_URL is unset",
    prodMissing.status !== 0 &&
      prodMissing.stderr.includes("NEXT_PUBLIC_SUPABASE_URL is required"),
    { status: prodMissing.status, stderr: prodMissing.stderr.slice(0, 200) },
  );

  const prodGarbage = evalConfig({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
  });
  check(
    "production config throws on an unparseable NEXT_PUBLIC_SUPABASE_URL",
    prodGarbage.status !== 0 &&
      prodGarbage.stderr.includes("not a valid URL"),
    { status: prodGarbage.status, stderr: prodGarbage.stderr.slice(0, 200) },
  );

  const prodValid = evalConfig({
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  });
  check(
    "production config loads with a valid NEXT_PUBLIC_SUPABASE_URL (control)",
    prodValid.status === 0,
    { status: prodValid.status, stderr: prodValid.stderr.slice(0, 200) },
  );

  const devMissing = evalConfig({
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: undefined,
  });
  check(
    "development config still falls back to the local stack when unset",
    devMissing.status === 0,
    { status: devMissing.status, stderr: devMissing.stderr.slice(0, 200) },
  );

  console.log("\n--- SEO plumbing ---");

  check(
    "home has title + meta description",
    prodHome.includes("<title>Home — Demo Plumbing Co</title>") &&
      prodHome.includes('name="description"'),
  );
  const sitemap = await (await fetch(`${SITE_BASE}/sitemap.xml`)).text();
  check(
    "sitemap.xml lists both pages",
    sitemap.includes(`${SITE_BASE}</loc>`) && sitemap.includes("/about</loc>"),
    sitemap,
  );
  const robots = await fetch(`${SITE_BASE}/robots.txt`);
  check("robots.txt responds 200", robots.status === 200);

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
