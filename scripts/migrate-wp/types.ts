/**
 * Phase 6 migration tool — shared shapes for the three stages:
 *
 *   extract  (site crawl / WP export XML)  → migrations/{site}/extract.json
 *   plan     (heuristic section mapping)   → migrations/{site}/plan.json
 *   import   (media download + typed seed) → CMS rows
 *
 * The PLAN FILE IS THE PRODUCT of the first two stages: a human reviews and
 * edits it (fix mappings, drop junk, rewrite nav labels), then flips
 * `approved` to true. `import` refuses to run until that happens.
 */

// --- stage 1: extraction ----------------------------------------------------

export type ExtractedBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string; cite: string }
  | { kind: "link"; text: string; href: string }
  | { kind: "image"; src: string; srcOriginal: string; alt: string };

export interface ExtractedPage {
  /** Source URL (crawl) or WXR <link>. */
  url: string;
  /** Proposed CMS slug derived from the URL path ('/'-rooted). */
  slug: string;
  /** Anchor text of the site-nav link pointing at this page, if any. */
  navLabel: string | null;
  /** Whether the source site's own navigation links to this page. */
  inNav: boolean;
  /** The page's <title> tag (crawl) or Yoast SEO title (WXR), verbatim. */
  seoTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
  blocks: ExtractedBlock[];
}

export interface ExtractedSite {
  source: string;
  mode: "crawl" | "wxr";
  extractedAt: string;
  siteName: string | null;
  pages: ExtractedPage[];
  /** Extraction-time observations worth carrying into the plan. */
  notes: string[];
}

// --- stage 2: the reviewable plan -------------------------------------------

export interface PlanMediaItem {
  /** Storage path / local file name under migrations/{site}/media/. */
  file: string;
  /** Full-size URL to download (WP size suffix stripped). */
  sourceUrl: string;
  /** Original URL as found in the markup — download fallback. */
  fallbackUrl: string;
  alt: string;
  /** Only needed when the downloaded file is not JPEG/PNG/WebP/GIF. */
  width?: number;
  height?: number;
}

/** Image placeholder inside section props, resolved to a mediaId at import. */
export interface MediaRef {
  $media: string;
  alt: string;
}

export interface PlanSection {
  /** A registry section type. */
  type: string;
  /** JSON props; image fields carry { $media, alt } placeholders. */
  props: unknown;
  /** "review" = the mapper wasn't sure — look at this one specifically. */
  confidence: "high" | "review";
  note?: string;
}

export interface PlanPage {
  slug: string;
  /** Nav label — kept short; the original SEO-length title goes in seo.title. */
  title: string;
  seo: { title?: string; description?: string; noindex?: boolean };
  status: "draft" | "published";
  sections: PlanSection[];
  sourceUrl: string;
}

export interface MigrationPlan {
  /** Target site slug — must already exist (create-site.ts). */
  site: string;
  source: string;
  generatedAt: string;
  /**
   * HUMAN GATE: import refuses while this is false. Review every "review"
   * section and every warning, edit the plan, then set it to true.
   */
  approved: boolean;
  /** What the reviewer changed/decided — becomes part of the audit trail. */
  reviewNotes: string;
  warnings: string[];
  media: PlanMediaItem[];
  pages: PlanPage[];
}
