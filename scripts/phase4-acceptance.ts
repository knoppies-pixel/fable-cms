/**
 * Phase 4 acceptance (spec §9): the full publish flow through the UI —
 * reorder sections (dnd-kit), edit the hero heading, publish a draft
 * section — and the PRODUCTION site shows every change within 10 seconds
 * without a redeploy (on-demand revalidation). Plus: preview iframe renders
 * drafts, page-level publish toggles, revalidate endpoint auth.
 *
 * Requires: local Supabase running, admin server on :3000, and the site
 * running a PRODUCTION build on :3001:
 *   pnpm --filter site-template build && pnpm --filter site-template start
 * (A dev server on :3001 would pass trivially — always fresh — so run prod.)
 * Run with: pnpm test:phase4
 */
import { chromium, type Locator, type Page } from "playwright";
import { seed } from "../packages/db/scripts/seed";

const ADMIN_BASE = "http://localhost:3000";
const SITE_BASE = "http://localhost:3001";
const API_KEY = "local-dev-demo-content-key";
const REVALIDATE_SECRET = "local-revalidate-secret";
const ADMIN = { email: "admin@studio.local", password: "local-dev-password" };

const HERO_SEEDED = "Plumbing done right, the first time";
const HERO_EDITED = "Phase 4: hero edited and republished";
const LOGO_STRIP = "Trusted by local businesses";
const DRAFT_CTA = "Winter special";

let passed = 0;
function ok(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
  passed += 1;
  console.log(`  ok - ${message}`);
}

interface ApiSection {
  section_type: string;
  props: Record<string, unknown>;
  sort_order: number;
  status: string;
}

async function fetchContent(): Promise<{
  pages: Array<{ slug: string; sections: ApiSection[] }>;
}> {
  const res = await fetch(`${ADMIN_BASE}/api/content/demo-site?drafts=1`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`content API ${res.status}`);
  return (await res.json()) as never;
}

async function prodHtml(path: string): Promise<{ status: number; html: string }> {
  const res = await fetch(`${SITE_BASE}${path}`, {
    headers: { "cache-control": "no-cache" },
  });
  return { status: res.status, html: await res.text() };
}

/** Poll the production site until `predicate` holds; returns elapsed ms. */
async function pollProd(
  path: string,
  predicate: (r: { status: number; html: string }) => boolean,
  timeoutMs: number,
  label: string,
): Promise<number> {
  const started = Date.now();
  for (;;) {
    if (predicate(await prodHtml(path))) return Date.now() - started;
    if (Date.now() - started > timeoutMs) {
      throw new Error(`TIMEOUT after ${timeoutMs}ms waiting for: ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

function sectionRows(page: Page): Locator {
  return page.locator('[data-testid="section-list"] > li');
}

async function main() {
  await seed(); // fresh fixtures every run — suites are order-independent

  // --- Revalidate endpoint: auth + baseline sync ---------------------------
  const badSecret = await fetch(`${SITE_BASE}/api/revalidate`, {
    method: "POST",
    headers: { "x-revalidate-secret": "nope" },
  });
  ok(badSecret.status === 401, "revalidate endpoint rejects a wrong secret (401)");

  const revalidated = await fetch(`${SITE_BASE}/api/revalidate`, {
    method: "POST",
    headers: { "x-revalidate-secret": REVALIDATE_SECRET },
  });
  ok(revalidated.status === 200, "revalidate endpoint accepts the secret");
  ok(
    ((await revalidated.json()) as { revalidated: boolean }).revalidated === true,
    "revalidate endpoint reports revalidated: true",
  );

  await pollProd(
    "/",
    ({ html }) =>
      html.includes(HERO_SEEDED) &&
      !html.includes(HERO_EDITED) &&
      !html.includes(DRAFT_CTA),
    15_000,
    "production home resynced to the fresh seed",
  );
  const baseline = await prodHtml("/");
  ok(
    baseline.html.indexOf(HERO_SEEDED) < baseline.html.indexOf(LOGO_STRIP),
    "baseline: hero renders before the logo strip on production home",
  );

  // --- Admin UI flow -------------------------------------------------------
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("dialog", (dialog) => void dialog.accept());
  page.setDefaultTimeout(30_000);

  await page.goto(`${ADMIN_BASE}/login`, { timeout: 120_000 });
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/sites\/[0-9a-f-]+\/pages$/, { timeout: 120_000 });
  ok(true, "logged in as studio admin");

  // Open the seeded Home page.
  await page
    .getByRole("link")
    .filter({ has: page.locator('span:text-is("Home")') })
    .click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/, { timeout: 60_000 });
  const homeUrl = page.url();
  await sectionRows(page).first().waitFor({ timeout: 60_000 });

  // --- Preview iframe (draft mode) beside the hero form --------------------
  await sectionRows(page)
    .filter({ has: page.locator('p:text-is("Hero")') })
    .getByRole("link", { name: "Edit" })
    .click();
  await page.waitForURL(/\/sections\/[0-9a-f-]+$/, { timeout: 60_000 });
  const preview = page.frameLocator('iframe[title="Site preview"]');
  await preview.locator("text=Preview mode").waitFor({ timeout: 60_000 });
  ok(true, "section editor embeds the site's draft-mode preview iframe");
  await preview.locator(`text=${DRAFT_CTA}`).waitFor({ timeout: 30_000 });
  ok(true, "preview iframe renders the draft section (invisible in production)");

  // --- Edit the hero heading (saves + auto-revalidates) --------------------
  await page.fill('[id="heading"]', HERO_EDITED);
  await page.getByRole("button", { name: /Save section/ }).click();
  await page.getByText("Saved ✓").waitFor({ timeout: 30_000 });
  ok(true, "hero heading edited and saved through the form");
  await preview.locator(`text=${HERO_EDITED}`).first().waitFor({ timeout: 60_000 });
  ok(true, "preview iframe reloaded and shows the new heading after save");

  // --- Reorder: move Hero below the logo strip (dnd-kit, keyboard) ---------
  await page.goto(homeUrl);
  await sectionRows(page).first().waitFor({ timeout: 60_000 });
  const handle = page.getByRole("button", { name: "Reorder Hero" });
  await handle.focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await page
    .locator('[data-testid="section-list"] > li:first-child p:text-is("Logo strip")')
    .waitFor({ timeout: 5_000 });
  ok(true, "section list reordered optimistically (hero moved below logo strip)");

  // Persistence: the content API must reflect the new sort_order.
  const deadline = Date.now() + 15_000;
  for (;;) {
    const api = await fetchContent();
    const home = api.pages.find((p) => p.slug === "/");
    if (!home) throw new Error("home page missing from API");
    const hero = home.sections.find((s) => s.section_type === "hero");
    const logos = home.sections.find((s) => s.section_type === "logo_strip");
    if (hero && logos && logos.sort_order === 0 && hero.sort_order === 1) break;
    if (Date.now() > deadline) throw new Error("sort_order not persisted");
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  ok(true, "new sort_order persisted (content API: logo_strip=0, hero=1)");

  // --- Publish the draft CTA section, then the 10-second clock -------------
  const draftCta = sectionRows(page)
    .filter({ has: page.locator('p:text-is("CTA banner")') })
    .filter({ has: page.locator('span:text-is("draft")') });
  await draftCta.waitFor({ timeout: 30_000 });
  const publishedAt = Date.now();
  await draftCta.getByRole("button", { name: "Publish section" }).click();
  await draftCta.waitFor({ state: "detached", timeout: 30_000 });
  ok(true, "draft CTA section published via the section publish toggle");

  await pollProd(
    "/",
    ({ html }) =>
      html.includes(HERO_EDITED) &&
      html.includes(DRAFT_CTA) &&
      html.indexOf(LOGO_STRIP) < html.indexOf(HERO_EDITED),
    10_000 - (Date.now() - publishedAt),
    "production home shows reorder + heading edit + published draft",
  );
  const elapsed = Date.now() - publishedAt;
  ok(
    elapsed <= 10_000,
    `production site shows all changes ${Math.round(elapsed / 100) / 10}s after publish (≤ 10s, no redeploy)`,
  );
  const finalHome = await prodHtml("/");
  ok(
    !finalHome.html.includes("data-draft-section"),
    "published section renders without draft markers in production",
  );

  // --- Page-level publish toggle -------------------------------------------
  await page.goto(page.url().replace(/\/pages\/.*$/, "/pages"));
  await page
    .getByRole("link")
    .filter({ has: page.locator('span:text-is("About Us")') })
    .click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/, { timeout: 60_000 });

  const unpublishedAt = Date.now();
  await page.getByRole("button", { name: "Unpublish page" }).click();
  await page.getByRole("button", { name: "Publish page" }).waitFor({ timeout: 30_000 });
  const gone = await pollProd(
    "/about",
    ({ status }) => status === 404,
    10_000,
    "production /about returns 404 after unpublish",
  );
  ok(true, `unpublished page returns 404 on production within ${Math.round((Date.now() - unpublishedAt) / 100) / 10}s (poll: ${gone}ms)`);

  await page.getByRole("button", { name: "Publish page" }).click();
  await page.getByRole("button", { name: "Unpublish page" }).waitFor({ timeout: 30_000 });
  await pollProd(
    "/about",
    ({ status, html }) => status === 200 && html.includes("About Demo Plumbing Co"),
    10_000,
    "production /about back after republish",
  );
  ok(true, "republished page serves again on production within 10s");

  await browser.close();
  console.log(`\nPhase 4 acceptance: all ${passed} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
