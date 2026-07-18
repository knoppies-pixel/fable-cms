import "server-only";
import type { MediaRecord } from "@fable/sections";

/**
 * Content API client. All site content comes through the studio CMS content
 * API (never straight from Supabase — see CLAUDE.md hard rules).
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
export async function fetchSiteContent(
  { drafts = false }: { drafts?: boolean } = {},
): Promise<SiteContent> {
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
