import "server-only";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MediaRecord } from "@fable/sections";

/**
 * Content API client. All site content comes through the studio CMS content
 * API (never straight from Supabase — see CLAUDE.md hard rules).
 *
 * Snapshot mode (CONTENT_SNAPSHOT_FILE): content is read from a local JSON
 * file shaped exactly like the content API response. Two consumers:
 *  - CI builds (no live CMS in GitHub Actions);
 *  - exported/offboarded sites, which keep building and deploying with zero
 *    studio infrastructure — the "you can always leave" promise.
 */

export interface CmsSection {
  id: string;
  section_type: string;
  props: unknown;
  sort_order: number;
  status: "draft" | "published";
}

export interface CmsPage {
  slug: string;
  title: string;
  seo: {
    /** Overrides the derived `<title>`; `title` (nav label) stays short. */
    title?: string;
    description?: string;
    ogImage?: string;
    noindex?: boolean;
  };
  status: "draft" | "published";
  published_at: string | null;
  sort_order: number;
  sections: CmsSection[];
}

export interface CmsSite {
  slug: string;
  name: string;
  domain: string | null;
  tokens: Record<string, unknown>;
  settings: Record<string, unknown>;
}

export interface SiteContent {
  site: CmsSite;
  pages: CmsPage[];
  media: MediaRecord[];
}

function requiredEnv(name: "SITE_SLUG" | "SITE_API_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

export function siteUrl(): string {
  return process.env.SITE_URL ?? "http://localhost:3001";
}

/**
 * Fetch the whole site's content. Published content is cached with ISR
 * (revalidated on demand by the admin in Phase 4); draft-mode requests
 * bypass the cache entirely.
 */
let snapshotCache: SiteContent | null = null;

export async function fetchSiteContent(
  { drafts = false }: { drafts?: boolean } = {},
): Promise<SiteContent> {
  const snapshotFile = process.env.CONTENT_SNAPSHOT_FILE;
  if (snapshotFile) {
    // Snapshots hold published content only; draft mode has nothing extra.
    if (!snapshotCache) {
      snapshotCache = JSON.parse(
        readFileSync(resolve(snapshotFile), "utf8"),
      ) as SiteContent;
    }
    return snapshotCache;
  }

  const base = process.env.CMS_API_URL ?? "http://127.0.0.1:3000";
  const slug = requiredEnv("SITE_SLUG");
  const url = `${base}/api/content/${slug}${drafts ? "?drafts=1" : ""}`;
  const response = await fetch(url, {
    headers: { "x-api-key": requiredEnv("SITE_API_KEY") },
    ...(drafts
      ? { cache: "no-store" as const }
      : { next: { revalidate: 300, tags: ["cms-content"] } }),
  });
  if (!response.ok) {
    throw new Error(`Content API request failed: ${response.status} ${url}`);
  }
  return (await response.json()) as SiteContent;
}

/** '/' → [], '/about' → ['about'], '/services/gutters' → ['services','gutters'] */
export function slugToSegments(slug: string): string[] {
  return slug.split("/").filter(Boolean);
}

export function segmentsToSlug(segments: string[] | undefined): string {
  return segments?.length ? `/${segments.join("/")}` : "/";
}
