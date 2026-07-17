/**
 * Phase 1 seed: one demo site (two pages, four placeholder section types,
 * one draft section to prove publish filtering), plus a second site used by
 * the acceptance tests to prove cross-site RLS isolation.
 *
 * Idempotent: deletes and recreates the seeded sites and users on every run.
 * Run with: pnpm db:seed
 */
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
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

async function main() {
  const db = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Wipe previous seed runs. sites cascades to pages/sections/media/members.
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
        colors: { primary: "#0e7490", surface: "#f8fafc" },
        typeScale: { base: "1rem", ratio: 1.25 },
      },
      settings: { social: { instagram: "@demoplumbing" } },
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

  const now = new Date().toISOString();
  const { data: pages, error: pagesError } = await db
    .from("pages")
    .insert([
      {
        site_id: demoSite.id,
        slug: "/",
        title: "Home",
        seo: { description: "Reliable plumbing for the whole metro." },
        status: "published",
        published_at: now,
        sort_order: 0,
      },
      {
        site_id: demoSite.id,
        slug: "/about",
        title: "About Us",
        seo: { description: "Two decades of honest plumbing work." },
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
    const page = pages.find((p) => p.site_id === siteId && p.slug === slug);
    if (!page) throw new Error(`seeded page not found: ${slug}`);
    return page.id;
  };
  const demoHome = pageId(demoSite.id, "/");
  const demoAbout = pageId(demoSite.id, "/about");
  const otherHome = pageId(otherSite.id, "/");

  // Placeholder section types — the real registry lands in Phase 2.
  const { error: sectionsError } = await db.from("sections").insert([
    {
      page_id: demoHome,
      section_type: "hero",
      props: {
        heading: "Plumbing done right, the first time",
        subheading: "24/7 call-outs across the metro.",
      },
      sort_order: 0,
      status: "published",
    },
    {
      page_id: demoHome,
      section_type: "rich_text",
      props: {
        body: "Family-owned since 2004. Licensed, insured, and on time.",
      },
      sort_order: 1,
      status: "published",
    },
    {
      page_id: demoHome,
      section_type: "feature_grid",
      props: {
        items: [
          { title: "Emergency repairs", description: "There in under an hour." },
          { title: "Geyser installs", description: "Certified installers." },
          { title: "Leak detection", description: "Non-invasive tracing." },
        ],
      },
      sort_order: 2,
      status: "published",
    },
    {
      // Draft on purpose: the content API must not return this one.
      page_id: demoHome,
      section_type: "cta_banner",
      props: { heading: "Winter special — 10% off geyser services" },
      sort_order: 3,
      status: "draft",
    },
    {
      page_id: demoAbout,
      section_type: "rich_text",
      props: { body: "We started with one van and a promise: no callout fees." },
      sort_order: 0,
      status: "published",
    },
    {
      page_id: demoAbout,
      section_type: "cta_banner",
      props: { heading: "Get a free quote today" },
      sort_order: 1,
      status: "published",
    },
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
  console.log(`  demo-site  ${demoSite.id} (2 pages, 6 sections, 1 draft)`);
  console.log(`  other-site ${otherSite.id} (RLS isolation fixture)`);
  console.log(`  users: ${seedEmails.join(", ")} (password: local-dev-password)`);
  console.log(`  demo-site content API key: ${DEMO_SITE_API_KEY}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
