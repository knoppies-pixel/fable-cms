/**
 * Phase 2 seed: one demo site with two pages composed from real registry
 * sections (all 10 v1 types), placeholder media generated with sharp and
 * uploaded to the site's public Storage bucket, plus a second site used by
 * the acceptance tests to prove cross-site RLS isolation.
 *
 * Deliberate fixtures for acceptance tests:
 *  - one DRAFT section on the home page (excluded from published output),
 *  - one published section with INVALID props and one with an UNKNOWN type
 *    on /about (error cards in preview, nothing in production).
 *
 * Idempotent: deletes and recreates the seeded sites, their Storage buckets,
 * and users on every run. Run with: pnpm db:seed
 */
import { createHash, randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Database } from "../src/types";
import {
  DEMO_SITE_API_KEY,
  SEED_USERS,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./local-env";

const SEED_SITE_SLUGS = ["demo-site", "other-site"];

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// --- Rich text helpers (Tiptap JSON, matching @fable/sections richTextDoc) --

type Node = Record<string, unknown>;
const text = (t: string): Node => ({ type: "text", text: t });
const p = (t: string): Node => ({ type: "paragraph", content: [text(t)] });
const h = (level: number, t: string): Node => ({
  type: "heading",
  attrs: { level },
  content: [text(t)],
});
const bullets = (...items: string[]): Node => ({
  type: "bulletList",
  content: items.map((t) => ({ type: "listItem", content: [p(t)] })),
});
const doc = (...content: Node[]): Node => ({ type: "doc", content });

// --- Placeholder image generation (sharp) --------------------------------

interface Asset {
  path: string;
  alt: string;
  width: number;
  height: number;
  buffer: Buffer;
  contentType: string;
}

const xmlEscape = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function sceneSvg(
  width: number,
  height: number,
  from: string,
  to: string,
  label: string,
): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#g)"/>
  <circle cx="${width * 0.78}" cy="${height * 0.28}" r="${height * 0.3}" fill="#ffffff" opacity="0.12"/>
  <circle cx="${width * 0.16}" cy="${height * 0.8}" r="${height * 0.42}" fill="#ffffff" opacity="0.08"/>
  <text x="${width / 2}" y="${height / 2}" font-family="sans-serif" font-size="${Math.round(height / 14)}" font-weight="bold" fill="#ffffff" opacity="0.85" text-anchor="middle" dominant-baseline="middle">${xmlEscape(label)}</text>
</svg>`;
}

function logoSvg(width: number, height: number, name: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="4" y="${height / 2 - 14}" width="28" height="28" rx="8" fill="${color}"/>
  <text x="44" y="${height / 2}" font-family="sans-serif" font-size="24" font-weight="bold" fill="#334155" dominant-baseline="central">${xmlEscape(name)}</text>
</svg>`;
}

async function jpegAsset(
  path: string,
  alt: string,
  width: number,
  height: number,
  from: string,
  to: string,
  label: string,
): Promise<Asset> {
  const buffer = await sharp(Buffer.from(sceneSvg(width, height, from, to, label)))
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();
  return { path, alt, width, height, buffer, contentType: "image/jpeg" };
}

async function pngLogoAsset(
  path: string,
  alt: string,
  name: string,
  color: string,
): Promise<Asset> {
  const width = 320;
  const height = 96;
  const buffer = await sharp(Buffer.from(logoSvg(width, height, name, color)))
    .png()
    .toBuffer();
  return { path, alt, width, height, buffer, contentType: "image/png" };
}

async function buildAssets(): Promise<Asset[]> {
  const teal = ["#0e7490", "#155e75"] as const;
  const gallery: Array<[string, string, string, string]> = [
    ["gallery-1.jpg", "Full bathroom renovation in Parkhurst", "#0e7490", "#164e63"],
    ["gallery-2.jpg", "New geyser installation with drip tray", "#0f766e", "#134e4a"],
    ["gallery-3.jpg", "Kitchen sink and mixer replacement", "#155e75", "#1e3a5f"],
    ["gallery-4.jpg", "Trenchless pipe repair in progress", "#0369a1", "#0c4a6e"],
    ["gallery-5.jpg", "Solar water heater rooftop install", "#0d9488", "#115e59"],
    ["gallery-6.jpg", "Commercial bathroom fit-out", "#0891b2", "#155e75"],
  ];
  const logos: Array<[string, string, string, string]> = [
    ["logo-1.png", "Harbourview Café logo", "Harbourview", "#0e7490"],
    ["logo-2.png", "Northside Property Group logo", "Northside", "#0f766e"],
    ["logo-3.png", "Fairfield Estates logo", "Fairfield", "#0369a1"],
    ["logo-4.png", "Metro Fitness Clubs logo", "Metro Fitness", "#155e75"],
    ["logo-5.png", "Oak & Iron Brewhouse logo", "Oak & Iron", "#0d9488"],
  ];
  const portraits: Array<[string, string, string, string]> = [
    ["portrait-sarah.jpg", "Sarah M.", "#0d7789", "#0c272e"],
    ["portrait-luca.jpg", "Luca B.", "#0f766e", "#134e4a"],
    ["portrait-thandi.jpg", "Thandi N.", "#155e75", "#0c272e"],
    ["portrait-margaret.jpg", "Margaret V.", "#0891b2", "#155e75"],
  ];
  return Promise.all([
    jpegAsset("hero.jpg", "Plumber repairing a kitchen sink", 1600, 1000, teal[0], teal[1], "Demo Plumbing Co"),
    ...portraits.map(([path, name, from, to]) =>
      jpegAsset(path, `Portrait of ${name}`, 480, 480, from, to, name.split(" ")[0] ?? name),
    ),
    jpegAsset("workshop.jpg", "Our fully stocked service van", 1200, 900, "#155e75", "#0f2e35", "Workshop on wheels"),
    jpegAsset("team.jpg", "The Demo Plumbing team at the workshop", 1200, 900, "#0f766e", "#0f2e35", "The team"),
    ...gallery.map(([path, alt, from, to]) =>
      jpegAsset(path, alt, 800, 600, from, to, alt.split(" ").slice(0, 2).join(" ")),
    ),
    ...logos.map(([path, alt, name, color]) => pngLogoAsset(path, alt, name, color)),
  ]);
}

// --- Storage bucket helpers ----------------------------------------------

const bucketName = (siteId: string) => `media-${siteId}`;

async function deleteSiteBucket(db: SupabaseClient<Database>, siteId: string) {
  const bucket = bucketName(siteId);
  const { error: emptyError } = await db.storage.emptyBucket(bucket);
  if (emptyError && !/not found/i.test(emptyError.message)) {
    throw new Error(`emptying bucket ${bucket}: ${emptyError.message}`);
  }
  const { error: deleteError } = await db.storage.deleteBucket(bucket);
  if (deleteError && !/not found/i.test(deleteError.message)) {
    throw new Error(`deleting bucket ${bucket}: ${deleteError.message}`);
  }
}

export async function seed() {
  const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Wipe previous seed runs: buckets first (their names embed the old site
  // ids), then sites (cascades to pages/sections/media/members), then users.
  const { data: staleSites, error: staleError } = await db
    .from("sites")
    .select("id")
    .in("slug", SEED_SITE_SLUGS);
  if (staleError) throw new Error(`listing stale sites: ${staleError.message}`);
  for (const stale of staleSites ?? []) {
    await deleteSiteBucket(db, stale.id);
  }

  const { error: wipeError } = await db
    .from("sites")
    .delete()
    .in("slug", SEED_SITE_SLUGS);
  if (wipeError) throw new Error(`wiping sites: ${wipeError.message}`);

  const seedEmails = Object.values(SEED_USERS).map((u) => u.email);
  const { data: userList, error: listError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw new Error(`listing users: ${listError.message}`);
  for (const user of userList.users) {
    if (user.email && seedEmails.includes(user.email)) {
      const { error } = await db.auth.admin.deleteUser(user.id);
      if (error) throw new Error(`deleting user ${user.email}: ${error.message}`);
    }
  }

  const userIds: Record<string, string> = {};
  for (const [key, { email, password }] of Object.entries(SEED_USERS)) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw new Error(`creating user ${email}: ${error.message}`);
    userIds[key] = data.user.id;
  }

  const { data: demoSite, error: demoSiteError } = await db
    .from("sites")
    .insert({
      slug: "demo-site",
      name: "Demo Plumbing Co",
      domain: "demo-plumbing.example",
      tokens: {
        colors: {
          surface: "#ffffff",
          surfaceAlt: "#f0f7f9",
          primary: "#0f2e35",
          muted: "#48606b",
          accent: "#0e7490",
          accentContrast: "#ffffff",
        },
        radius: { card: "0.75rem", btn: "0.5rem" },
      },
      settings: {
        social: { instagram: "@demoplumbing" },
        // Where this site is deployed + how the admin talks to it (preview
        // iframe, on-demand revalidation). Mirrors site-template/.env.local.
        delivery: {
          siteUrl: "http://localhost:3001",
          previewSecret: "local-preview-secret",
          revalidateSecret: "local-revalidate-secret",
        },
      },
      api_key_hash: sha256Hex(DEMO_SITE_API_KEY),
    })
    .select("id")
    .single();
  if (demoSiteError) throw new Error(`demo site: ${demoSiteError.message}`);

  // Random throwaway key: this site exists only to test RLS isolation.
  const { data: otherSite, error: otherSiteError } = await db
    .from("sites")
    .insert({
      slug: "other-site",
      name: "Other Client",
      api_key_hash: sha256Hex(randomBytes(32).toString("hex")),
    })
    .select("id")
    .single();
  if (otherSiteError) throw new Error(`other site: ${otherSiteError.message}`);

  const { error: membersError } = await db.from("site_members").insert([
    { site_id: demoSite.id, user_id: userIds.studioAdmin, role: "studio_admin" },
    { site_id: otherSite.id, user_id: userIds.studioAdmin, role: "studio_admin" },
    { site_id: demoSite.id, user_id: userIds.demoEditor, role: "client_editor" },
  ]);
  if (membersError) throw new Error(`memberships: ${membersError.message}`);

  // --- Media: public bucket + placeholder uploads + rows -----------------
  const bucket = bucketName(demoSite.id);
  const { error: bucketError } = await db.storage.createBucket(bucket, {
    public: true,
  });
  if (bucketError) throw new Error(`creating bucket ${bucket}: ${bucketError.message}`);

  const assets = await buildAssets();
  for (const asset of assets) {
    const { error } = await db.storage
      .from(bucket)
      .upload(asset.path, asset.buffer, {
        contentType: asset.contentType,
        upsert: true,
      });
    if (error) throw new Error(`uploading ${asset.path}: ${error.message}`);
  }

  const { data: mediaRows, error: mediaError } = await db
    .from("media")
    .insert(
      assets.map((asset) => ({
        site_id: demoSite.id,
        path: asset.path,
        alt: asset.alt,
        width: asset.width,
        height: asset.height,
      })),
    )
    .select("id, path");
  if (mediaError) throw new Error(`media rows: ${mediaError.message}`);

  const mediaId = (path: string) => {
    const row = mediaRows.find((m) => m.path === path);
    if (!row) throw new Error(`seeded media not found: ${path}`);
    return row.id;
  };
  const img = (path: string, alt = "") => ({ mediaId: mediaId(path), alt });

  // --- Pages -------------------------------------------------------------
  const now = new Date().toISOString();
  const { data: pages, error: pagesError } = await db
    .from("pages")
    .insert([
      {
        site_id: demoSite.id,
        slug: "/",
        title: "Home",
        seo: {
          description:
            "Reliable plumbing for the whole metro — 24/7 call-outs, honest pricing, certified installers.",
        },
        status: "published",
        published_at: now,
        sort_order: 0,
      },
      {
        site_id: demoSite.id,
        slug: "/about",
        title: "About Us",
        seo: {
          // seo.title overrides the derived tab/search title; the nav keeps
          // the short "About Us" label (Phase 6 additive fix).
          title: "About Acme Plumbing — 20 Years of Certified Metro Plumbers",
          description:
            "Two decades of honest plumbing work: meet the team, browse recent projects, get in touch.",
        },
        status: "published",
        published_at: now,
        sort_order: 1,
      },
      {
        site_id: otherSite.id,
        slug: "/",
        title: "Other Home",
        seo: {},
        status: "published",
        published_at: now,
        sort_order: 0,
      },
    ])
    .select("id, site_id, slug");
  if (pagesError) throw new Error(`pages: ${pagesError.message}`);

  const pageId = (siteId: string, slug: string) => {
    const page = pages.find((pg) => pg.site_id === siteId && pg.slug === slug);
    if (!page) throw new Error(`seeded page not found: ${slug}`);
    return page.id;
  };
  const demoHome = pageId(demoSite.id, "/");
  const demoAbout = pageId(demoSite.id, "/about");
  const otherHome = pageId(otherSite.id, "/");

  // --- Sections: all 10 v1 registry types --------------------------------
  const { error: sectionsError } = await db.from("sections").insert([
    // Home
    {
      page_id: demoHome,
      section_type: "hero",
      props: {
        heading: "Plumbing done right,",
        headingAccent: "the first time.",
        subheading:
          "Licensed, insured and on time — 24/7 call-outs across the metro.",
        cta: { label: "Get a free quote", href: "/about" },
        image: img("hero.jpg"),
        variant: "split",
        edge: "tide",
      },
      sort_order: 0,
      status: "published",
    },
    {
      page_id: demoHome,
      section_type: "feature_grid",
      props: {
        eyebrow: "Services",
        heading: "What we do",
        intro: "From burst pipes to full bathroom renovations, one call covers it.",
        items: [
          { title: "Emergency repairs", description: "There in under an hour, day or night." },
          { title: "Geyser installs", description: "Certified installers, all major brands." },
          { title: "Leak detection", description: "Non-invasive tracing, no broken walls." },
          { title: "Bathroom renovations", description: "Design to done in three weeks." },
          { title: "Drain cleaning", description: "Camera inspections and jet cleaning." },
          { title: "Solar geysers", description: "Cut your water-heating bill in half." },
        ],
        columns: 3,
        ornament: true,
      },
      sort_order: 1,
      status: "published",
    },
    {
      page_id: demoHome,
      section_type: "image_text_split",
      props: {
        heading: "A workshop on wheels",
        body: doc(
          p(
            "Every van carries the full catalogue of fittings, valves and geyser spares, so ninety percent of jobs are finished on the first visit.",
          ),
          p("No quotes-then-disappear. We price on site and start immediately."),
        ),
        image: img("workshop.jpg"),
        imagePosition: "right",
        depth: "escape",
      },
      sort_order: 2,
      status: "published",
    },
    {
      page_id: demoHome,
      section_type: "testimonials",
      props: {
        heading: "What clients say",
        items: [
          {
            quote: "They found a slab leak two other companies missed — and fixed it the same day.",
            author: "Sarah M.",
            role: "Homeowner, Parkhurst",
            image: img("portrait-sarah.jpg"),
          },
          {
            quote: "Our restaurant can't afford downtime. Demo Plumbing has kept us running for six years.",
            author: "Luca B.",
            role: "Owner, Harbourview Café",
            image: img("portrait-luca.jpg"),
          },
          {
            quote: "Punctual, tidy, and the invoice matched the quote to the cent.",
            author: "Thandi N.",
            role: "Property manager",
            image: img("portrait-thandi.jpg"),
          },
        ],
        background: "ink",
        edge: "foam",
      },
      sort_order: 3,
      status: "published",
    },
    {
      page_id: demoHome,
      section_type: "logo_strip",
      props: {
        heading: "Trusted by local businesses",
        logos: [
          img("logo-1.png"),
          img("logo-2.png"),
          img("logo-3.png"),
          img("logo-4.png"),
          img("logo-5.png"),
        ],
      },
      sort_order: 4,
      status: "published",
    },
    {
      page_id: demoHome,
      section_type: "cta_banner",
      props: {
        heading: "Burst geyser at 2 a.m.?",
        body: "Our emergency line is answered by a plumber, not a call centre.",
        cta: { label: "Call us 24/7", href: "tel:+27115550123" },
        variant: "accent",
        ornament: true,
      },
      sort_order: 5,
      status: "published",
    },
    {
      // Draft on purpose: must not appear in published output.
      page_id: demoHome,
      section_type: "cta_banner",
      props: {
        heading: "Winter special — 10% off geyser services",
        body: "Book before the end of August and save on any geyser call-out.",
        cta: { label: "Book a service", href: "/about" },
        variant: "subtle",
      },
      sort_order: 6,
      status: "draft",
    },

    // About
    {
      page_id: demoAbout,
      section_type: "rich_text",
      props: {
        body: doc(
          h(1, "About Demo Plumbing Co"),
          p(
            "We started in 2004 with one van and a promise: no callout fees, no surprises on the invoice.",
          ),
          p(
            "Today a team of twelve certified plumbers covers the whole metro, but the promise hasn't changed.",
          ),
          h(2, "Our promise"),
          bullets(
            "Answered by a plumber, not a call centre",
            "Priced on site before work starts",
            "Workmanship guaranteed for 24 months",
          ),
        ),
        width: "narrow",
      },
      sort_order: 0,
      status: "published",
    },
    {
      page_id: demoAbout,
      section_type: "image_text_split",
      props: {
        heading: "Meet the team",
        body: doc(
          p(
            "Every plumber on our books is PIRB-registered and background-checked, and apprentices always work alongside a master plumber.",
          ),
        ),
        image: img("team.jpg"),
        imagePosition: "left",
      },
      sort_order: 1,
      status: "published",
    },
    {
      page_id: demoAbout,
      section_type: "gallery",
      props: {
        heading: "Recent projects",
        images: [
          img("gallery-1.jpg"),
          img("gallery-2.jpg"),
          img("gallery-3.jpg"),
          img("gallery-4.jpg"),
          img("gallery-5.jpg"),
          img("gallery-6.jpg"),
        ],
        columns: 3,
      },
      sort_order: 2,
      status: "published",
    },
    {
      // Single-item testimonials render as the pull-quote variant — the
      // depth-chord showcase (design/DIRECTION.md).
      page_id: demoAbout,
      section_type: "testimonials",
      props: {
        heading: "",
        items: [
          {
            quote:
              "Twenty-two years, three houses, one plumber. When you find people this reliable, you keep their number.",
            author: "Margaret V.",
            role: "Client since 2004",
            image: img("portrait-margaret.jpg"),
          },
        ],
        background: "ink",
        edge: "foam",
      },
      sort_order: 3,
      status: "published",
    },
    {
      page_id: demoAbout,
      section_type: "faq_accordion",
      props: {
        heading: "Frequently asked questions",
        items: [
          {
            question: "Do you charge a callout fee?",
            answer: "No. You pay for work done, not for us arriving.",
          },
          {
            question: "Are you available on weekends?",
            answer:
              "Yes — the emergency line runs 24/7, every day of the year.\n\nScheduled (non-emergency) work is booked Monday to Saturday.",
          },
          {
            question: "Is your work guaranteed?",
            answer: "All workmanship carries a 24-month guarantee, on top of manufacturer warranties.",
          },
          {
            question: "Which areas do you cover?",
            answer: "The full metro area. For large projects we travel further — ask us.",
          },
        ],
      },
      sort_order: 4,
      status: "published",
    },
    {
      page_id: demoAbout,
      section_type: "contact_form",
      props: {
        heading: "Get in touch",
        intro: "Tell us what's leaking, dripping or blocked and we'll come prepared.",
        showPhone: true,
        submitLabel: "Send message",
        successMessage: "Thanks — we'll get back to you within one working day.",
      },
      sort_order: 5,
      status: "published",
    },
    {
      page_id: demoAbout,
      section_type: "cta_banner",
      props: {
        heading: "Prefer to talk?",
        body: "Weekdays 7:00–18:00 you'll reach the workshop directly.",
        cta: { label: "011 555 0123", href: "tel:+27115550123" },
        variant: "subtle",
      },
      sort_order: 6,
      status: "published",
    },
    {
      // INVALID PROPS on purpose (published): heading fails min(1), variant
      // not in enum. Production renders nothing; preview shows an error card.
      page_id: demoAbout,
      section_type: "hero",
      props: { heading: "", variant: "diagonal" },
      sort_order: 7,
      status: "published",
    },
    {
      // UNKNOWN TYPE on purpose (published): not in the registry.
      // Production renders nothing; preview shows an error card.
      page_id: demoAbout,
      section_type: "legacy_widget",
      props: { html: "<marquee>Welcome to our homepage!</marquee>" },
      sort_order: 8,
      status: "published",
    },

    // Other site (RLS isolation fixture)
    {
      page_id: otherHome,
      section_type: "hero",
      props: { heading: "Other client's hero" },
      sort_order: 0,
      status: "published",
    },
  ]);
  if (sectionsError) throw new Error(`sections: ${sectionsError.message}`);

  console.log("Seed complete.");
  console.log(
    `  demo-site  ${demoSite.id} (2 pages, 15 sections: 12 valid published, 1 draft, 1 invalid-props, 1 unknown-type)`,
  );
  console.log(`  media      ${assets.length} placeholder assets in bucket ${bucket}`);
  console.log(`  other-site ${otherSite.id} (RLS isolation fixture)`);
  console.log(`  users: ${seedEmails.join(", ")} (password: local-dev-password)`);
  console.log(`  demo-site content API key: ${DEMO_SITE_API_KEY}`);
}

// Runs as a CLI via `pnpm db:seed`; acceptance suites import { seed } and
// await it as their first step instead, so a stray suite-created row can
// never fail a later suite. (Case-normalized compare: Windows drive letters.)
const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href.toLowerCase() ===
    import.meta.url.toLowerCase();
if (invokedDirectly) {
  seed().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
