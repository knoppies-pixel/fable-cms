/**
 * Site content seed — REPLACE THIS SPEC when building a client site.
 *
 * This file is the worked example that ships with the template: a minimal
 * one-page spec proving the flow. When building from a kb/{client} brief,
 * rewrite `spec` so it expresses the ENTIRE brief (every page, every section,
 * SEO per page, assets from kb/{client}/assets) — see CLAUDE.md §"Building a
 * site from a brief".
 *
 * Run with: pnpm seed   (idempotent; targets SITE_SLUG from .env.local)
 * Re-seeding replaces the seeded pages wholesale — stop re-seeding once the
 * client edits content in the admin.
 */
import { join } from "node:path";
import { rt, seedSite, type SiteSeedSpec } from "./seed-lib";

const spec: SiteSeedSpec = {
  // Point at kb/{client}/assets when building a real site.
  assetsDir: join(process.cwd(), "..", "..", "kb", "example", "assets"),
  assets: [],
  pages: (img) => [
    {
      slug: "/",
      title: "Home",
      seo: { description: "Template example page — replace with brief-driven content." },
      sections: [
        {
          type: "hero",
          props: {
            heading: "A new site,",
            headingAccent: "ready to seed.",
            subheading: "Replace scripts/seed-content.ts with the brief's content plan.",
            cta: { label: "Read the conventions", href: "/" },
            variant: "centered",
            edge: "tide",
          },
        },
        {
          type: "rich_text",
          props: {
            body: rt.doc(
              rt.h(2, "How this works"),
              rt.p(
                "Every page of the client site is declared in seed-content.ts, typed against the registry schemas and validated before a single row is written.",
              ),
              rt.bullets(
                "Assets come from kb/{client}/assets and are referenced with img(file, alt)",
                "Section props are compile-time checked per section type",
                "Re-running the seed is safe: pages are replaced, media upserts",
              ),
            ),
            width: "narrow",
          },
        },
        {
          type: "cta_banner",
          props: {
            heading: "Now build the real thing.",
            body: "Map the brief to pages and registry sections, then reseed.",
            cta: null,
            variant: "subtle",
          },
        },
      ],
    },
  ],
};

seedSite(spec).catch((error) => {
  console.error(error);
  process.exit(1);
});
