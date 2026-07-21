/**
 * Typed content-seeding helper (spec §9 Phase 5): the bridge from a
 * kb/{client} brief to CMS rows. scripts/seed-content.ts declares the site's
 * content as a SiteSeedSpec and calls seedSite(); this module does the writes.
 *
 * Guarantees:
 *  - Section props are TYPED against the live registry (z.input per section
 *    type — the compiler rejects a typo'd prop) and VALIDATED at runtime with
 *    each schema before any row is written. A spec that doesn't parse writes
 *    nothing.
 *  - Idempotent: media upserts by storage path; pages + sections are replaced
 *    wholesale from the spec. Two consecutive runs produce identical content.
 *  - The spec is the source of truth for PAGES: re-seeding overwrites admin
 *    edits to the seeded pages (media uploaded via the admin is left alone).
 *    Stop re-seeding once content ownership moves to the client's editors.
 *
 * This is a STUDIO-SIDE AUTHORING TOOL — the sanctioned exception to the
 * "site code never talks to Supabase" rule, which binds the site's runtime
 * (renderer, routes), not this script. It authenticates with the service
 * role: SUPABASE_SERVICE_ROLE_KEY from the environment (local dev falls back
 * to the well-known local key). SITE_SLUG etc. come from .env.local.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServiceRoleClient, type Json } from "@fable/db";
import { registry, type RichTextDoc, type SectionType } from "@fable/sections";
import type { z } from "zod";

// --- rich text builders (Tiptap JSON, the subset the site renderer knows) ---

type RichNode = RichTextDoc["content"][number];

const p = (text: string): RichNode => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

/** Builders for `rich_text` bodies: rt.doc(rt.h(2, "…"), rt.p("…"), rt.bullets("…")). */
export const rt = {
  doc: (...content: RichNode[]): RichTextDoc => ({ type: "doc", content }),
  p,
  h: (level: 1 | 2 | 3 | 4, text: string): RichNode => ({
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  }),
  bullets: (...items: string[]): RichNode => ({
    type: "bulletList",
    content: items.map((text) => ({ type: "listItem", content: [p(text)] })),
  }),
};

// --- spec types ---------------------------------------------------------

type Registry = typeof registry;

/** One section, typed by its registry entry — `props` is checked per `type`. */
export type SectionSpec = {
  [K in SectionType]: {
    type: K;
    props: z.input<Registry[K]["schema"]>;
    /** default "published" */
    status?: "draft" | "published";
  };
}[SectionType];

export interface PageSpec {
  /** '/', '/about', '/services/gutters' */
  slug: string;
  title: string;
  seo: { description?: string; ogImage?: string; noindex?: boolean };
  /** default "published" */
  status?: "draft" | "published";
  sections: SectionSpec[];
}

export interface AssetSpec {
  /** File inside `assetsDir`, e.g. "hero.jpg". Also the storage path. */
  file: string;
  /** Media-library alt text (per-placement overrides go in section props). */
  alt: string;
  /** Required for formats other than JPEG/PNG (dimension probe covers those). */
  width?: number;
  height?: number;
}

/** Resolves an asset file name to a typed image ref, after media upsert. */
export type Img = (file: string, alt?: string) => { mediaId: string; alt: string };

export interface SiteSeedSpec {
  /** Absolute path holding the files named by `assets` (usually kb/{client}/assets). */
  assetsDir: string;
  assets: AssetSpec[];
  /** Pages receive `img` to reference assets by file name. */
  pages: (img: Img) => PageSpec[];
}

// --- env ------------------------------------------------------------------

/** Local Supabase demo keys — not secrets. Real environments set the env vars. */
const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function loadEnv(): { slug: string; url: string; serviceRoleKey: string } {
  try {
    // Loads SITE_SLUG (and SITE_URL/REVALIDATE_SECRET for the post-seed ping).
    process.loadEnvFile(join(process.cwd(), ".env.local"));
  } catch {
    // No .env.local (CI) — everything must already be in the environment.
  }
  const slug = process.env.SITE_SLUG;
  if (!slug) throw new Error("SITE_SLUG is not set (expected in .env.local)");
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    LOCAL_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    (url === LOCAL_SUPABASE_URL
      ? LOCAL_SERVICE_ROLE_KEY
      : (() => {
          throw new Error(
            "SUPABASE_SERVICE_ROLE_KEY must be set to seed a non-local CMS",
          );
        })());
  return { slug, url, serviceRoleKey };
}

// --- image dimension probe (JPEG SOF / PNG IHDR — no image dependency) -----

function probeDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length > 4 && buffer.readUInt16BE(0) === 0xffd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      if (marker === undefined) return null;
      // SOF0–SOF15 minus DHT/JPG/DAC carry dimensions.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  return null;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
};

// --- seeding ----------------------------------------------------------------

export async function seedSite(spec: SiteSeedSpec): Promise<void> {
  const env = loadEnv();
  const db = createServiceRoleClient({
    url: env.url,
    serviceRoleKey: env.serviceRoleKey,
  });

  const { data: site, error: siteError } = await db
    .from("sites")
    .select("id, slug, name")
    .eq("slug", env.slug)
    .maybeSingle();
  if (siteError) throw new Error(`loading site: ${siteError.message}`);
  if (!site) {
    throw new Error(
      `site "${env.slug}" is not registered — run \`pnpm create-site\` at the monorepo root first`,
    );
  }

  // -- media: upload (upsert) + upsert rows by path --------------------------
  const bucket = `media-${site.id}`;
  const { data: existingMedia, error: mediaListError } = await db
    .from("media")
    .select("id, path")
    .eq("site_id", site.id);
  if (mediaListError) throw new Error(`listing media: ${mediaListError.message}`);
  const mediaIdByPath = new Map(existingMedia.map((m) => [m.path, m.id]));

  for (const asset of spec.assets) {
    const buffer = readFileSync(join(spec.assetsDir, asset.file));
    const ext = asset.file.split(".").pop()?.toLowerCase() ?? "";
    const contentType = CONTENT_TYPES[ext];
    if (!contentType) throw new Error(`unsupported asset type: ${asset.file}`);
    const dims = probeDimensions(buffer);
    const width = asset.width ?? dims?.width;
    const height = asset.height ?? dims?.height;
    if (!width || !height) {
      throw new Error(
        `cannot determine dimensions of ${asset.file} — add width/height to its AssetSpec`,
      );
    }

    const { error: uploadError } = await db.storage
      .from(bucket)
      .upload(asset.file, buffer, { contentType, upsert: true });
    if (uploadError) {
      throw new Error(`uploading ${asset.file}: ${uploadError.message}`);
    }

    const existingId = mediaIdByPath.get(asset.file);
    if (existingId) {
      const { error } = await db
        .from("media")
        .update({ alt: asset.alt, width, height })
        .eq("id", existingId);
      if (error) throw new Error(`updating media ${asset.file}: ${error.message}`);
    } else {
      const { data: row, error } = await db
        .from("media")
        .insert({ site_id: site.id, path: asset.file, alt: asset.alt, width, height })
        .select("id")
        .single();
      if (error) throw new Error(`inserting media ${asset.file}: ${error.message}`);
      mediaIdByPath.set(asset.file, row.id);
    }
  }

  const img: Img = (file, alt = "") => {
    const mediaId = mediaIdByPath.get(file);
    if (!mediaId) {
      throw new Error(`img("${file}"): not in this spec's assets list`);
    }
    return { mediaId, alt };
  };

  // -- pages + sections: validate everything, then replace wholesale ---------
  const pages = spec.pages(img);
  const slugs = new Set<string>();
  for (const page of pages) {
    if (!page.slug.startsWith("/")) {
      throw new Error(`page slug must start with '/': "${page.slug}"`);
    }
    if (slugs.has(page.slug)) throw new Error(`duplicate page slug ${page.slug}`);
    slugs.add(page.slug);
    page.sections.forEach((section, index) => {
      const parsed = registry[section.type].schema.safeParse(section.props);
      if (!parsed.success) {
        throw new Error(
          `invalid props for ${page.slug} section ${index} (${section.type}):\n${parsed.error.message}`,
        );
      }
    });
  }

  const { error: wipeError } = await db
    .from("pages")
    .delete()
    .eq("site_id", site.id);
  if (wipeError) throw new Error(`clearing pages: ${wipeError.message}`);

  const now = new Date().toISOString();
  let sectionCount = 0;
  for (const [pageIndex, page] of pages.entries()) {
    const status = page.status ?? "published";
    const { data: pageRow, error: pageError } = await db
      .from("pages")
      .insert({
        site_id: site.id,
        slug: page.slug,
        title: page.title,
        seo: page.seo,
        status,
        published_at: status === "published" ? now : null,
        sort_order: pageIndex,
      })
      .select("id")
      .single();
    if (pageError) throw new Error(`page ${page.slug}: ${pageError.message}`);

    if (page.sections.length > 0) {
      const { error: sectionsError } = await db.from("sections").insert(
        page.sections.map((section, index) => ({
          page_id: pageRow.id,
          section_type: section.type,
          // Store the schema-parsed value so rows are normalized with defaults
          // filled — the same convention as the admin's save action. The parse
          // output is plain JSON by construction (schemas hold only JSON kinds).
          props: registry[section.type].schema.parse(section.props) as unknown as Json,
          sort_order: index,
          status: section.status ?? "published",
        })),
      );
      if (sectionsError) {
        throw new Error(`sections for ${page.slug}: ${sectionsError.message}`);
      }
      sectionCount += page.sections.length;
    }
  }

  // Best-effort revalidate ping so a running site picks the content up now.
  const siteUrl = process.env.SITE_URL;
  const revalidateSecret = process.env.REVALIDATE_SECRET;
  if (siteUrl && revalidateSecret) {
    try {
      await fetch(`${siteUrl}/api/revalidate`, {
        method: "POST",
        headers: { "x-revalidate-secret": revalidateSecret },
      });
    } catch {
      // Site not running — fine; it fetches fresh content on next start.
    }
  }

  console.log(
    `Seeded ${site.slug}: ${pages.length} pages, ${sectionCount} sections, ${spec.assets.length} media assets.`,
  );
}
