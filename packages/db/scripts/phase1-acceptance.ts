/**
 * Phase 1 acceptance tests (spec §9, Phase 1):
 *   1. A client_editor cannot read another site's rows.
 *   2. A client_editor cannot change section_type (or other layout columns).
 *   3. The content API returns the seeded site as JSON, published rows only.
 *
 * Requires: seeded database (pnpm db:seed) and the admin dev server running
 * for the content API checks (CONTENT_API_BASE overrides http://localhost:3000).
 * Run with: pnpm db:test
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types";
import {
  ANON_KEY,
  DEMO_SITE_API_KEY,
  SEED_USERS,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "./local-env";

const CONTENT_API_BASE =
  process.env.CONTENT_API_BASE ?? "http://localhost:3000";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) {
    failures++;
    if (detail !== undefined) console.log(`      ${JSON.stringify(detail)}`);
  }
}

async function main() {
  const service = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Fixture lookups (service role, bypasses RLS).
  const { data: sites } = await service
    .from("sites")
    .select("id, slug")
    .in("slug", ["demo-site", "other-site"]);
  const demoSite = sites?.find((s) => s.slug === "demo-site");
  const otherSite = sites?.find((s) => s.slug === "other-site");
  if (!demoSite || !otherSite) {
    throw new Error("Seed data missing — run `pnpm db:seed` first.");
  }

  const { data: allSections } = await service
    .from("sections")
    .select("id, section_type, props, pages!inner(site_id)")
    .in("pages.site_id", [demoSite.id, otherSite.id]);
  const demoHero = allSections?.find(
    (s) => s.pages.site_id === demoSite.id && s.section_type === "hero",
  );
  const otherHero = allSections?.find(
    (s) => s.pages.site_id === otherSite.id && s.section_type === "hero",
  );
  const { data: demoPages } = await service
    .from("pages")
    .select("id, slug")
    .eq("site_id", demoSite.id);
  const demoHomePage = demoPages?.find((p) => p.slug === "/");
  if (!demoHero || !otherHero || !demoHomePage) {
    throw new Error("Seeded sections/pages missing — rerun `pnpm db:seed`.");
  }

  // Authenticate as the demo site's client_editor.
  const editor = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await editor.auth.signInWithPassword({
    email: SEED_USERS.demoEditor.email,
    password: SEED_USERS.demoEditor.password,
  });
  if (signInError) throw new Error(`sign-in failed: ${signInError.message}`);

  console.log("\n--- RLS: cross-site isolation (client_editor) ---");

  const { data: visibleSites } = await editor.from("sites").select("slug");
  check(
    "sites: sees only demo-site",
    visibleSites?.length === 1 && visibleSites[0].slug === "demo-site",
    visibleSites,
  );

  const { error: hashColumnError } = await editor
    .from("sites")
    .select("api_key_hash");
  check(
    "sites: api_key_hash column is not selectable",
    hashColumnError !== null,
    hashColumnError ?? "no error raised",
  );

  const { data: otherPages } = await editor
    .from("pages")
    .select("id")
    .eq("site_id", otherSite.id);
  check("pages: other site's pages invisible", otherPages?.length === 0, otherPages);

  const { data: ownPages } = await editor.from("pages").select("id");
  check("pages: own site's pages visible", (ownPages?.length ?? 0) === 2, ownPages);

  const { data: otherSections } = await editor
    .from("sections")
    .select("id")
    .eq("id", otherHero.id);
  check(
    "sections: other site's sections invisible",
    otherSections?.length === 0,
    otherSections,
  );

  const { data: otherMembers } = await editor
    .from("site_members")
    .select("user_id")
    .eq("site_id", otherSite.id);
  check(
    "site_members: other site's members invisible",
    otherMembers?.length === 0,
    otherMembers,
  );

  const { data: crossUpdate } = await editor
    .from("sections")
    .update({ props: { heading: "hijacked" } })
    .eq("id", otherHero.id)
    .select("id");
  check(
    "sections: update on other site's row affects 0 rows",
    crossUpdate?.length === 0,
    crossUpdate,
  );

  console.log("\n--- RLS: column restrictions (client_editor) ---");

  const { error: typeChangeError } = await editor
    .from("sections")
    .update({ section_type: "gallery" })
    .eq("id", demoHero.id);
  check(
    "sections: changing section_type is rejected",
    typeChangeError !== null,
    typeChangeError ?? "no error raised",
  );

  // Keep the seeded props intact (the demo site renders them) — only prove
  // that an editor can write the props column.
  const newProps = {
    ...(demoHero.props as Record<string, unknown>),
    heading: "Plumbing done right, the first time",
  };
  const { data: propsUpdate, error: propsError } = await editor
    .from("sections")
    .update({ props: newProps })
    .eq("id", demoHero.id)
    .select("props");
  check(
    "sections: updating props succeeds",
    propsError === null &&
      (propsUpdate?.[0]?.props as { heading?: string })?.heading ===
        newProps.heading,
    propsError ?? propsUpdate,
  );

  const { error: pageTitleError } = await editor
    .from("pages")
    .update({ title: "Renamed Home" })
    .eq("id", demoHomePage.id);
  check(
    "pages: changing title is rejected",
    pageTitleError !== null,
    pageTitleError ?? "no error raised",
  );

  const { data: seoUpdate, error: seoError } = await editor
    .from("pages")
    .update({ seo: { description: "Updated by the client editor." } })
    .eq("id", demoHomePage.id)
    .select("seo");
  check(
    "pages: updating seo succeeds",
    seoError === null && seoUpdate?.length === 1,
    seoError ?? seoUpdate,
  );

  const { error: insertPageError } = await editor.from("pages").insert({
    site_id: demoSite.id,
    slug: "/rogue",
    title: "Rogue page",
  });
  check(
    "pages: insert is rejected",
    insertPageError !== null,
    insertPageError ?? "no error raised",
  );

  const { data: deletedPages } = await editor
    .from("pages")
    .delete()
    .eq("id", demoHomePage.id)
    .select("id");
  check("pages: delete affects 0 rows", deletedPages?.length === 0, deletedPages);

  await editor.auth.signOut();

  const anon = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: anonRpcError } = await anon.rpc("page_site_id", {
    p_page_id: demoHomePage.id,
  });
  check(
    "anon cannot execute page_site_id()",
    anonRpcError !== null,
    anonRpcError ?? "no error raised",
  );

  console.log("\n--- Content API ---");

  const url = `${CONTENT_API_BASE}/api/content/demo-site`;
  const okResponse = await fetch(url, {
    headers: { "x-api-key": DEMO_SITE_API_KEY },
  });
  check("returns 200 with valid API key", okResponse.status === 200);
  const body = (await okResponse.json()) as {
    site?: { slug?: string; api_key_hash?: string };
    pages?: Array<{
      slug: string;
      sections: Array<{ id: string; section_type: string }>;
    }>;
  };
  check("site.slug is demo-site", body.site?.slug === "demo-site", body.site);
  check(
    "api_key_hash is not exposed",
    body.site !== undefined && !("api_key_hash" in body.site),
  );
  check("returns both published pages", body.pages?.length === 2, body.pages);
  const homeSections =
    body.pages
      ?.find((p) => p.slug === "/")
      ?.sections.map((s) => s.section_type) ?? [];
  check(
    "home has the 6 published section types in order",
    JSON.stringify(homeSections) ===
      JSON.stringify([
        "hero",
        "logo_strip",
        "feature_grid",
        "image_text_split",
        "testimonials",
        "cta_banner",
      ]),
    homeSections,
  );
  const { data: draftSections } = await service
    .from("sections")
    .select("id, pages!inner(site_id)")
    .eq("status", "draft")
    .eq("pages.site_id", demoSite.id);
  const returnedIds = new Set(
    body.pages?.flatMap((p) => p.sections.map((s) => s.id)) ?? [],
  );
  check(
    "draft sections are excluded",
    (draftSections?.length ?? 0) > 0 &&
      !draftSections?.some((s) => returnedIds.has(s.id)),
    draftSections,
  );

  const badKeyResponse = await fetch(url, {
    headers: { "x-api-key": "wrong-key" },
  });
  check("returns 401 with wrong API key", badKeyResponse.status === 401);
  const noKeyResponse = await fetch(url);
  check("returns 401 with missing API key", noKeyResponse.status === 401);
  const wrongSiteResponse = await fetch(
    `${CONTENT_API_BASE}/api/content/other-site`,
    { headers: { "x-api-key": DEMO_SITE_API_KEY } },
  );
  check(
    "demo key does not unlock other-site",
    wrongSiteResponse.status === 401,
  );

  console.log("\n--- Content API response summary ---");
  console.log(
    JSON.stringify(
      {
        site: body.site,
        pages: body.pages?.map((p) => ({
          slug: p.slug,
          sections: p.sections.map((s) => s.section_type),
        })),
      },
      null,
      2,
    ),
  );

  console.log(
    `\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
