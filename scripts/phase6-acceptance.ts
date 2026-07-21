/**
 * Phase 6 acceptance (spec §9 Phase 6): the WordPress migration pipeline,
 * end-to-end and offline. A fixture "WordPress" site is served in-process,
 * then the REAL CLI runs against it:
 *
 *   extract → plan → import (must REFUSE: unapproved) → review/override →
 *   import → rows verified in the database (incl. the seo.title split).
 *
 * Also parses a fixture WXR export (classic + Elementor + Yoast postmeta).
 * Requires local Supabase only — no dev servers. Run: pnpm test:phase6
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../packages/db/src/types";
import { SERVICE_ROLE_KEY, SUPABASE_URL } from "../packages/db/scripts/local-env";
import type { ExtractedSite, MigrationPlan } from "./migrate-wp/types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 41731;
const BASE = `http://127.0.0.1:${PORT}`;
const SITE = "wp-fixture";
const WXR_SITE = "wp-fixture-wxr";
const TEST_API_KEY = "local-test-wp-fixture-key";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)?.slice(0, 3000)}`);
  }
}

// --- fixture site -----------------------------------------------------------

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const chrome = (body: string, title: string, description: string): string => `<!doctype html>
<html><head>
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:site_name" content="Acme Gardens">
</head><body>
<header><nav>
  <a href="/">Home</a>
  <a href="/about">About</a>
  <a href="/services">Our Professional Landscaping Services</a>
  <a href="/faq">FAQ</a>
  <a href="/contact">Contact</a>
</nav></header>
<main>${body}</main>
<footer><p>© Acme Gardens</p></footer>
</body></html>`;

const FIXTURE_PAGES: Record<string, string> = {
  "/": chrome(
    `
    <div class="cookie-consent"><p>We use cookies to spy on you. Accept?</p></div>
    <h1>Beautiful gardens, built to last</h1>
    <p>Award-winning landscaping across the metro since 2004.</p>
    <a class="elementor-button" href="/contact">Get a quote</a>
    <img src="data:image/svg+xml,placeholder" data-src="/wp-content/uploads/hero-1024x683.png" alt="A lush garden">
    <img src="/wp-content/uploads/icon.png" width="24" height="24" alt="leaf icon">
    <h2>What we do</h2>
    <ul><li>Garden design</li><li>Irrigation systems</li><li>Tree care</li><li>Maintenance plans</li></ul>
    <h2>Why choose us</h2>
    <p>We are fully insured and certified by the landscaping guild.</p>
    <p>Every project comes with a two-year plant guarantee.</p>
    <blockquote>They transformed our yard completely.<cite>Jane from Parkhurst</cite></blockquote>
    <h2>Ready to transform your garden?</h2>
    <p>Book a free site visit this month.</p>
    <a class="wp-block-button" href="/contact">Start today</a>`,
    "Landscaping & Garden Design Metro-Wide | Acme Gardens",
    "Award-winning landscaping, irrigation and garden care.",
  ),
  "/about": chrome(
    `
    <h1>About us</h1>
    <p>Family-run since 2004.</p>
    <h2>Our story</h2>
    <p>What began as a single bakkie and a lawnmower is now a team of twelve.</p>
    <p>We believe gardens should work with the local climate, not against it.</p>
    <img src="/wp-content/uploads/team.png" alt="The Acme Gardens team">
    <p>Today we maintain over 200 gardens across the city.</p>`,
    "About Acme Gardens | Two Decades of Growing",
    "Meet the family-run team behind Acme Gardens.",
  ),
  "/services": chrome(
    `
    <h1>Our services</h1>
    <p>From once-off makeovers to year-round care.</p>
    <img src="/wp-content/uploads/service-hero.png" alt="Planting a bed">
    <h2>Recent projects</h2>
    <img src="/wp-content/uploads/garden1.png" alt="Courtyard project">
    <img src="/wp-content/uploads/garden2-300x200.png" alt="Water-wise garden">
    <img src="/wp-content/uploads/garden3.png" alt="Rooftop terrace">
    <p>Every project is designed around your soil, sun and budget.</p>`,
    "Landscaping Services, Irrigation & Garden Maintenance | Acme Gardens",
    "Full-service landscaping: design, irrigation, maintenance.",
  ),
  "/faq": chrome(
    `
    <h1>Frequently asked questions</h1>
    <h3>Do you work outside the metro?</h3>
    <p>Yes, within 100km for design projects.</p>
    <h3>Are you water-wise?</h3>
    <p>Indigenous planting and drip irrigation are our defaults.</p>
    <h3>Do you offer maintenance contracts?</h3>
    <p>Monthly and quarterly plans are available.</p>`,
    "FAQ | Acme Gardens",
    "Answers about service areas, water-wise planting and contracts.",
  ),
  "/contact": chrome(
    `
    <h1>Contact us</h1>
    <p>Call, mail, or use the form — we reply within one working day.</p>`,
    "Contact Acme Gardens | Free Quotes",
    "Get in touch for a free garden consultation.",
  ),
  "/privacy-policy": chrome(
    `
    <h1>Privacy policy</h1>
    <p>We only keep what the contact form sends us.</p>`,
    "Privacy Policy | Acme Gardens",
    "How we handle your data.",
  ),
};

const FIXTURE_IMAGES = new Set([
  "/wp-content/uploads/hero.png", // full-size exists → suffix-strip succeeds
  "/wp-content/uploads/hero-1024x683.png",
  "/wp-content/uploads/icon.png",
  "/wp-content/uploads/team.png",
  "/wp-content/uploads/service-hero.png",
  "/wp-content/uploads/garden1.png",
  "/wp-content/uploads/garden2-300x200.png", // full-size 404s → fallback path
  "/wp-content/uploads/garden3.png",
]);

const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset>${[...Object.keys(FIXTURE_PAGES)]
  .map((path) => `<url><loc>${BASE}${path === "/" ? "/" : path}</loc></url>`)
  .join("")}</urlset>`;

function startFixtureServer(): Promise<Server> {
  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0] ?? "/";
    const page = FIXTURE_PAGES[path.replace(/\/$/, "") || "/"];
    if (page) {
      res.writeHead(200, { "content-type": "text/html" }).end(page);
    } else if (FIXTURE_IMAGES.has(path)) {
      res.writeHead(200, { "content-type": "image/png" }).end(PNG_1PX);
    } else if (path === "/sitemap.xml") {
      res.writeHead(200, { "content-type": "application/xml" }).end(SITEMAP);
    } else {
      res.writeHead(404).end("not found");
    }
  });
  return new Promise((resolveServer) => {
    server.listen(PORT, "127.0.0.1", () => resolveServer(server));
  });
}

const WXR_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss><channel>
<title>Fixture WXR Site</title>
<item>
  <title>Classic Page</title>
  <link>https://old.example/classic/</link>
  <wp:post_type>page</wp:post_type>
  <wp:status>publish</wp:status>
  <wp:post_name>classic</wp:post_name>
  <content:encoded><![CDATA[First classic paragraph.

Second classic paragraph.]]></content:encoded>
</item>
<item>
  <title>Elementor Page</title>
  <link>https://old.example/elementor/</link>
  <wp:post_type>page</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[]]></content:encoded>
  <wp:postmeta><wp:meta_key><![CDATA[_yoast_wpseo_title]]></wp:meta_key><wp:meta_value><![CDATA[Elementor Landing | Old Brand Keywords]]></wp:meta_value></wp:postmeta>
  <wp:postmeta><wp:meta_key><![CDATA[_yoast_wpseo_metadesc]]></wp:meta_key><wp:meta_value><![CDATA[A migrated meta description.]]></wp:meta_value></wp:postmeta>
  <wp:postmeta><wp:meta_key><![CDATA[_elementor_data]]></wp:meta_key><wp:meta_value><![CDATA[[{"elements":[{"widgetType":"heading","settings":{"title":"Built with Elementor","header_size":"h2"}},{"widgetType":"text-editor","settings":{"editor":"<p>Elementor body copy.</p>"}},{"widgetType":"image","settings":{"image":{"url":"https://old.example/wp-content/uploads/photo-768x512.jpg","alt":"A photo"}}},{"widgetType":"button","settings":{"text":"Call now","link":{"url":"https://old.example/contact/"}}}]}]]]></wp:meta_value></wp:postmeta>
</item>
<item>
  <title>A Blog Post</title>
  <link>https://old.example/2024/01/a-post/</link>
  <wp:post_type>post</wp:post_type>
  <wp:status>publish</wp:status>
  <content:encoded><![CDATA[<p>post content, out of scope</p>]]></content:encoded>
</item>
</channel></rss>`;

// --- CLI runner -------------------------------------------------------------

// MUST be async: the fixture server runs on THIS event loop — a spawnSync
// would block it and deadlock the child's fetches against our own server.
function cli(...args: string[]): Promise<{ status: number; output: string }> {
  return new Promise((resolveRun) => {
    const child = spawn("pnpm", ["migrate-wp", "--", ...args], {
      cwd: ROOT,
      shell: true,
      timeout: 180_000,
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.on("close", (code) => resolveRun({ status: code ?? -1, output }));
  });
}

// --- main -------------------------------------------------------------------

async function main(): Promise<void> {
  const service = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Clean slate (previous runs, failed or not).
  const cleanup = async (): Promise<void> => {
    const { data: leftover } = await service
      .from("sites")
      .select("id")
      .eq("slug", SITE)
      .maybeSingle();
    if (leftover) {
      const bucket = `media-${leftover.id}`;
      const { data: objects } = await service.storage.from(bucket).list();
      if (objects && objects.length > 0) {
        await service.storage.from(bucket).remove(objects.map((o) => o.name));
      }
      await service.storage.deleteBucket(bucket).catch(() => undefined);
      await service.from("sites").delete().eq("id", leftover.id);
    }
  };
  await cleanup();
  for (const dir of [join(ROOT, "migrations", SITE), join(ROOT, "migrations", WXR_SITE)]) {
    rmSync(dir, { recursive: true, force: true });
  }

  const server = await startFixtureServer();
  try {
    // --- extract (crawl) ----------------------------------------------------
    const extractRun = await cli("extract", "--site", SITE, "--url", `${BASE}/`);
    check("extract: CLI exits 0", extractRun.status === 0, extractRun.output);
    const extractPath = join(ROOT, "migrations", SITE, "extract.json");
    check("extract: writes extract.json", existsSync(extractPath));
    const extracted = JSON.parse(readFileSync(extractPath, "utf8")) as ExtractedSite;

    check(
      "extract: all 6 fixture pages found (5 nav + 1 sitemap-only)",
      extracted.pages.length === 6,
      extracted.pages.map((p) => p.slug),
    );
    const home = extracted.pages.find((p) => p.slug === "/");
    check(
      "extract: home h1 captured",
      home?.blocks.some((b) => b.kind === "heading" && b.text === "Beautiful gardens, built to last"),
    );
    check(
      "extract: cookie-consent chrome excluded",
      !JSON.stringify(extracted).includes("cookies"),
    );
    check(
      "extract: lazy-load data-src resolved and WP size suffix stripped",
      home?.blocks.some(
        (b) => b.kind === "image" && b.src === `${BASE}/wp-content/uploads/hero.png`,
      ),
      home?.blocks.filter((b) => b.kind === "image"),
    );
    check(
      "extract: 24px icon image skipped",
      !home?.blocks.some((b) => b.kind === "image" && b.src.includes("icon")),
    );
    check(
      "extract: meta description captured",
      home?.metaDescription === "Award-winning landscaping, irrigation and garden care.",
    );
    const services = extracted.pages.find((p) => p.slug === "/services");
    check(
      "extract: SEO-length <title> captured verbatim",
      services?.seoTitle === "Landscaping Services, Irrigation & Garden Maintenance | Acme Gardens",
    );
    check(
      "extract: sitemap-only page marked not-in-nav",
      extracted.pages.find((p) => p.slug === "/privacy-policy")?.inNav === false,
    );

    // --- plan ---------------------------------------------------------------
    const planRun = await cli("plan", "--site", SITE);
    check("plan: CLI exits 0", planRun.status === 0, planRun.output);
    const planPath = join(ROOT, "migrations", SITE, "plan.json");
    const plan = JSON.parse(readFileSync(planPath, "utf8")) as MigrationPlan;

    check("plan: starts unapproved with empty reviewNotes", plan.approved === false && plan.reviewNotes === "");
    const planHome = plan.pages.find((p) => p.slug === "/");
    const hero = planHome?.sections[0];
    const heroProps = hero?.props as {
      heading?: string;
      subheading?: string;
      cta?: { label: string; href: string };
      image?: { $media: string };
      variant?: string;
    };
    check("plan: home starts with a hero", hero?.type === "hero");
    check(
      "plan: hero absorbed h1 + intro + button + image",
      heroProps?.heading === "Beautiful gardens, built to last" &&
        heroProps?.subheading === "Award-winning landscaping across the metro since 2004." &&
        heroProps?.cta?.label === "Get a quote" &&
        heroProps?.cta?.href === "/contact" &&
        heroProps?.image?.$media === "hero.png" &&
        heroProps?.variant === "split",
      heroProps,
    );
    const homeTypes = planHome?.sections.map((s) => s.type) ?? [];
    check(
      "plan: feature_grid proposed (review) from heading + short list",
      planHome?.sections.some((s) => s.type === "feature_grid" && s.confidence === "review"),
      homeTypes,
    );
    const cta = planHome?.sections.find((s) => s.type === "cta_banner");
    const ctaProps = cta?.props as { heading?: string; body?: string } | undefined;
    check(
      "plan: closing heading + button proposed as cta_banner",
      ctaProps?.heading === "Ready to transform your garden?" &&
        ctaProps?.body === "Book a free site visit this month.",
      ctaProps,
    );
    check(
      "plan: cta_banner did not swallow earlier copy (flushed as rich_text)",
      planHome?.sections.some(
        (s) => s.type === "rich_text" && JSON.stringify(s.props).includes("Why choose us"),
      ),
      homeTypes,
    );
    const testimonials = planHome?.sections.find((s) => s.type === "testimonials");
    check(
      "plan: blockquote+cite proposed as testimonials (review)",
      testimonials?.confidence === "review" &&
        JSON.stringify(testimonials?.props).includes("Jane from Parkhurst"),
    );
    const planFaq = plan.pages.find((p) => p.slug === "/faq");
    const faqSection = planFaq?.sections.find((s) => s.type === "faq_accordion");
    const faqItems = (faqSection?.props as { items?: unknown[] })?.items;
    check("plan: FAQ page mapped to faq_accordion with 3 items", faqItems?.length === 3);
    const planContact = plan.pages.find((p) => p.slug === "/contact");
    check(
      "plan: contact page proposes contact_form + warning about the WP form",
      planContact?.sections.some((s) => s.type === "contact_form") &&
        plan.warnings.some((w) => w.includes("contact_form")),
    );
    const planServices = plan.pages.find((p) => p.slug === "/services");
    const gallery = planServices?.sections.find((s) => s.type === "gallery");
    check(
      "plan: 3 consecutive images mapped to a gallery",
      ((gallery?.props as { images?: unknown[] })?.images ?? []).length === 3,
      planServices?.sections.map((s) => s.type),
    );
    check(
      "plan: long nav label shortened with a warning, original kept in seo.title",
      planServices !== undefined &&
        planServices.title.length <= 24 &&
        planServices.seo.title === "Landscaping Services, Irrigation & Garden Maintenance | Acme Gardens" &&
        plan.warnings.some((w) => w.includes("nav label shortened")),
      { title: planServices?.title, seoTitle: planServices?.seo.title },
    );
    check(
      "plan: sitemap-only page defaults to draft with a warning",
      plan.pages.find((p) => p.slug === "/privacy-policy")?.status === "draft" &&
        plan.warnings.some((w) => w.includes("not linked from the source site's nav")),
    );
    const garden2 = plan.media.find((m) => m.file.startsWith("garden2"));
    check(
      "plan: media dedupe carries full-size + rendered fallback URLs",
      garden2?.sourceUrl === `${BASE}/wp-content/uploads/garden2.png` &&
        garden2?.fallbackUrl === `${BASE}/wp-content/uploads/garden2-300x200.png`,
      garden2,
    );
    check(
      "plan: every proposed section dry-validates against the registry",
      !JSON.stringify(plan).includes("DOES NOT VALIDATE"),
      plan.warnings,
    );

    // --- import refuses the unapproved plan (the human gate) ----------------
    const refusal = await cli("import", "--site", SITE);
    check(
      "import: REFUSES an unapproved plan (non-zero exit + explanation)",
      refusal.status !== 0 && refusal.output.includes("REFUSING TO IMPORT"),
      refusal.output.slice(0, 300),
    );

    // --- human review simulation: override a mapping, approve ---------------
    // (In a real migration this is the studio editing the file by hand.)
    const servicesPage = plan.pages.find((p) => p.slug === "/services");
    if (servicesPage) servicesPage.title = "Services"; // the human override
    plan.approved = true;
    plan.reviewNotes =
      "(phase6 suite) Overrode auto-shortened services nav label with 'Services'; approved for import.";
    writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`);

    // Register the target site (what create-site.ts does, minus the clone).
    const { data: site, error: siteError } = await service
      .from("sites")
      .insert({
        slug: SITE,
        name: "WP Fixture",
        tokens: {},
        settings: {},
        api_key_hash: createHash("sha256").update(TEST_API_KEY).digest("hex"),
      })
      .select("id")
      .single();
    if (siteError || !site) throw new Error(`creating test site: ${siteError?.message}`);
    const bucket = `media-${site.id}`;
    const { error: bucketError } = await service.storage.createBucket(bucket, { public: true });
    if (bucketError) throw new Error(`creating bucket: ${bucketError.message}`);

    const importRun = await cli("import", "--site", SITE);
    check("import: approved plan imports cleanly", importRun.status === 0, importRun.output.slice(-1500));

    // --- verify the rows ----------------------------------------------------
    const { data: pages } = await service
      .from("pages")
      .select("slug, title, seo, status, sort_order, sections(section_type, props, sort_order)")
      .eq("site_id", site.id)
      .order("sort_order");
    check("import: all 6 pages inserted", pages?.length === 6, pages?.map((p) => p.slug));
    const dbServices = pages?.find((p) => p.slug === "/services");
    check(
      "import: the human override (nav title 'Services') landed",
      dbServices?.title === "Services",
      dbServices?.title,
    );
    check(
      "import: seo.title preserved separately from the short nav label",
      (dbServices?.seo as { title?: string })?.title ===
        "Landscaping Services, Irrigation & Garden Maintenance | Acme Gardens",
      dbServices?.seo,
    );
    check(
      "import: draft status honored for the non-nav page",
      pages?.find((p) => p.slug === "/privacy-policy")?.status === "draft",
    );
    const dbHome = pages?.find((p) => p.slug === "/");
    const dbHero = dbHome?.sections.find((s) => s.section_type === "hero");
    const heroImage = (dbHero?.props as { image?: { mediaId?: string } })?.image;
    const { data: mediaRows } = await service
      .from("media")
      .select("id, path, width, height")
      .eq("site_id", site.id);
    check(
      "import: hero image $media resolved to a real media row",
      typeof heroImage?.mediaId === "string" &&
        mediaRows?.some((m) => m.id === heroImage.mediaId && m.path === "hero.png"),
      { heroImage, media: mediaRows?.map((m) => m.path) },
    );
    check(
      "import: media rows carry probed dimensions",
      (mediaRows ?? []).length >= 5 && (mediaRows ?? []).every((m) => m.width === 1 && m.height === 1),
      mediaRows,
    );
    const { data: objects } = await service.storage.from(bucket).list();
    check(
      "import: files uploaded to the site's storage bucket",
      (objects ?? []).some((o) => o.name === "hero.png") &&
        (objects ?? []).some((o) => o.name.startsWith("garden2")),
      objects?.map((o) => o.name),
    );

    // --- WXR mode -----------------------------------------------------------
    const wxrDir = join(ROOT, "migrations", WXR_SITE);
    mkdirSync(wxrDir, { recursive: true });
    const wxrPath = join(wxrDir, "fixture.xml");
    writeFileSync(wxrPath, WXR_FIXTURE);
    const wxrRun = await cli("extract", "--site", WXR_SITE, "--wxr", wxrPath);
    check("wxr: CLI exits 0", wxrRun.status === 0, wxrRun.output);
    const wxrExtract = JSON.parse(
      readFileSync(join(wxrDir, "extract.json"), "utf8"),
    ) as ExtractedSite;
    check(
      "wxr: pages parsed, posts skipped",
      wxrExtract.pages.length === 2 &&
        wxrExtract.pages.every((p) => ["/classic", "/elementor"].includes(p.slug)),
      wxrExtract.pages.map((p) => p.slug),
    );
    const classic = wxrExtract.pages.find((p) => p.slug === "/classic");
    check(
      "wxr: classic wpautop content split into paragraphs",
      classic?.blocks.filter((b) => b.kind === "paragraph").length === 2,
      classic?.blocks,
    );
    const elementor = wxrExtract.pages.find((p) => p.slug === "/elementor");
    check(
      "wxr: Elementor page rebuilt from _elementor_data (heading/copy/image/button)",
      elementor?.blocks.some((b) => b.kind === "heading" && b.text === "Built with Elementor") === true &&
        elementor?.blocks.some((b) => b.kind === "paragraph" && b.text === "Elementor body copy.") === true &&
        elementor?.blocks.some(
          (b) => b.kind === "image" && b.src === "https://old.example/wp-content/uploads/photo.jpg",
        ) === true &&
        elementor?.blocks.some((b) => b.kind === "link" && b.text === "Call now") === true,
      elementor?.blocks,
    );
    check(
      "wxr: Yoast SEO title + meta description recovered from postmeta",
      elementor?.seoTitle === "Elementor Landing | Old Brand Keywords" &&
        elementor?.metaDescription === "A migrated meta description.",
    );
  } finally {
    server.close();
    await cleanup();
  }

  console.log(failures === 0 ? "\nPhase 6 acceptance: all checks passed." : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
