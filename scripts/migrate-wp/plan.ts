/**
 * Stage 2 — map extracted blocks onto registry sections and emit the
 * REVIEWABLE plan. Heuristics are deliberately conservative: anything the
 * mapper isn't sure about is marked `confidence: "review"` with a note, and
 * summarized in `warnings`. The human edits the plan file, then sets
 * `approved: true` — import refuses to run before that.
 */
import { registry } from "../../packages/sections/src/index";
import type {
  ExtractedBlock,
  ExtractedPage,
  ExtractedSite,
  MediaRef,
  MigrationPlan,
  PlanMediaItem,
  PlanPage,
  PlanSection,
} from "./types";

type ImageBlock = Extract<ExtractedBlock, { kind: "image" }>;

const MAX_NAV_LABEL = 24;

const lastHeadingIndex = (blocks: ExtractedBlock[]): number => {
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    if (blocks[i]?.kind === "heading") return i;
  }
  return -1;
};

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

const titleCase = (slugSegment: string): string =>
  slugSegment
    .split("-")
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");

// --- media registry ---------------------------------------------------------

class MediaRegistry {
  readonly items: PlanMediaItem[] = [];
  private readonly bySource = new Map<string, PlanMediaItem>();
  private readonly usedNames = new Set<string>();

  ref(image: ImageBlock): MediaRef {
    const existing = this.bySource.get(image.src);
    if (existing) {
      if (!existing.alt && image.alt) existing.alt = image.alt;
      return { $media: existing.file, alt: image.alt };
    }
    const base = decodeURIComponent(
      new URL(image.src).pathname.split("/").pop() ?? "image",
    )
      .toLowerCase()
      .replace(/[^a-z0-9.-]/g, "-")
      .replace(/^-+|-+$/g, "") || "image.jpg";
    let file = base;
    for (let n = 2; this.usedNames.has(file); n += 1) {
      file = base.replace(/(\.\w+)?$/, (ext) => `-${n}${ext}`);
    }
    this.usedNames.add(file);
    const item: PlanMediaItem = {
      file,
      sourceUrl: image.src,
      fallbackUrl: image.srcOriginal,
      alt: image.alt,
    };
    this.items.push(item);
    this.bySource.set(image.src, item);
    return { $media: file, alt: image.alt };
  }
}

// --- rich text assembly -----------------------------------------------------

interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
  content?: RichNode[];
}

const textNode = (text: string): RichNode => ({ type: "text", text });
const paragraph = (text: string): RichNode => ({
  type: "paragraph",
  content: [textNode(text)],
});

function richDocFromBlocks(blocks: ExtractedBlock[]): { type: "doc"; content: RichNode[] } {
  const content: RichNode[] = [];
  for (const block of blocks) {
    switch (block.kind) {
      case "heading":
        content.push({
          type: "heading",
          // Body copy starts under the section h1/h2 rhythm — clamp to 2–4.
          attrs: { level: Math.min(Math.max(block.level, 2), 4) },
          content: [textNode(block.text)],
        });
        break;
      case "paragraph":
        content.push(paragraph(block.text));
        break;
      case "list":
        content.push({
          type: block.ordered ? "orderedList" : "bulletList",
          content: block.items.map((item) => ({
            type: "listItem",
            content: [paragraph(item)],
          })),
        });
        break;
      case "quote":
        content.push({
          type: "blockquote",
          content: [
            paragraph(block.text),
            ...(block.cite ? [paragraph(`— ${block.cite}`)] : []),
          ],
        });
        break;
      case "link":
        content.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: block.text,
              marks: [{ type: "link", attrs: { href: block.href } }],
            },
          ],
        });
        break;
      case "image":
        break; // images never land in rich_text — the renderer has no image node
    }
  }
  return { type: "doc", content };
}

// --- per-page mapping -------------------------------------------------------

interface MapContext {
  media: MediaRegistry;
  warnings: string[];
  origin: string | null;
}

/** Internal links become site-relative so they survive the domain move. */
function relativizeHref(href: string, origin: string | null): string {
  if (!origin) return href;
  try {
    const url = new URL(href);
    if (url.origin === origin) return url.pathname.replace(/\/+$/, "") || "/";
  } catch {
    /* keep as-is */
  }
  return href;
}

function isFaqLike(page: ExtractedPage): boolean {
  const haystack = `${page.slug} ${page.seoTitle ?? ""} ${page.navLabel ?? ""}`.toLowerCase();
  return /faq|frequently.asked|questions/.test(haystack);
}

function isContactLike(page: ExtractedPage): boolean {
  const haystack = `${page.slug} ${page.seoTitle ?? ""} ${page.navLabel ?? ""}`.toLowerCase();
  return /contact|get.in.touch|kontak/.test(haystack);
}

function mapFaqSections(
  blocks: ExtractedBlock[],
  heading: string,
  warn: (note: string) => void,
): PlanSection[] | null {
  // Pattern: repeated (heading level>=3 → paragraph(s)) pairs.
  const items: Array<{ question: string; answer: string }> = [];
  let current: { question: string; answers: string[] } | null = null;
  const leftovers: ExtractedBlock[] = [];
  for (const block of blocks) {
    if (block.kind === "heading" && block.level >= 3) {
      if (current && current.answers.length > 0) {
        items.push({
          question: truncate(current.question, 200),
          answer: truncate(current.answers.join("\n\n"), 2000),
        });
      }
      current = { question: block.text, answers: [] };
    } else if (current && (block.kind === "paragraph" || block.kind === "list")) {
      current.answers.push(
        block.kind === "paragraph" ? block.text : block.items.map((i) => `• ${i}`).join("\n"),
      );
    } else {
      leftovers.push(block);
    }
  }
  if (current && current.answers.length > 0) {
    items.push({
      question: truncate(current.question, 200),
      answer: truncate(current.answers.join("\n\n"), 2000),
    });
  }
  if (items.length < 3) return null;

  const sections: PlanSection[] = [];
  if (leftovers.length > 0) {
    sections.push({
      type: "rich_text",
      props: { body: richDocFromBlocks(leftovers) },
      confidence: "high",
    });
  }
  sections.push({
    type: "faq_accordion",
    props: { heading: heading || "Frequently asked questions", items: items.slice(0, 20) },
    confidence: "review",
    note: "Q&A pairs were pattern-matched from heading/paragraph rhythm — check pairings.",
  });
  if (items.length > 20) warn("FAQ had more than 20 Q&A pairs; extras were dropped (schema max).");
  return sections;
}

function mapPageSections(page: ExtractedPage, ctx: MapContext): PlanSection[] {
  const warn = (note: string): void => {
    ctx.warnings.push(`${page.slug}: ${note}`);
  };
  const sections: PlanSection[] = [];
  const blocks = [...page.blocks];

  if (blocks.length === 0) {
    warn("No content blocks extracted — page left empty; add sections by hand or drop it.");
    return sections;
  }

  // --- hero: first heading in the opening run + nearby paragraph/image/cta --
  const headIndex = blocks.findIndex((b) => b.kind === "heading");
  const heroSource = headIndex >= 0 && headIndex <= 4 ? blocks[headIndex] : null;
  let heroHeading =
    (heroSource?.kind === "heading" ? heroSource.text : null) ??
    page.navLabel ??
    (page.seoTitle ? page.seoTitle.split(/[|–—-]/)[0]?.trim() ?? "" : "") ??
    "";
  if (!heroHeading) heroHeading = titleCase(page.slug.split("/").pop() ?? "") || "Welcome";
  if (heroHeading.length > 120) {
    warn(`Hero heading truncated to 120 chars ("${truncate(heroHeading, 40)}").`);
    heroHeading = truncate(heroHeading, 120);
  }

  const opening = blocks.slice(0, Math.max(headIndex + 4, 6));
  // Subheading: the first short paragraph after the hero heading — but never
  // past the NEXT heading (that paragraph belongs to the next section, e.g.
  // an FAQ answer).
  let subIndex = -1;
  for (let i = headIndex + 1; i < Math.min(blocks.length, headIndex + 4); i += 1) {
    const candidate = blocks[i];
    if (!candidate || candidate.kind === "heading") break;
    if (candidate.kind === "paragraph" && candidate.text.length <= 240) {
      subIndex = i;
      break;
    }
  }
  const ctaIndex = opening.findIndex((b) => b.kind === "link");
  const imgIndex = opening.findIndex((b) => b.kind === "image");

  const heroProps: Record<string, unknown> = {
    heading: heroHeading,
    variant: imgIndex >= 0 ? "split" : "centered",
  };
  const consumed = new Set<number>();
  if (headIndex >= 0 && headIndex <= 4) {
    consumed.add(headIndex);
    // Junk regularly precedes the h1 (skip-links, taglines) — drop it loudly.
    for (let i = 0; i < headIndex; i += 1) {
      const pre = blocks[i];
      if (pre && pre.kind === "paragraph") {
        consumed.add(i);
        warn(`Dropped pre-heading paragraph "${truncate(pre.text, 60)}" — usually chrome; restore it into a section if it's a real tagline.`);
      }
    }
  }
  if (subIndex >= 0) {
    const sub = blocks[subIndex];
    if (sub?.kind === "paragraph") {
      heroProps.subheading = truncate(sub.text, 240);
      consumed.add(subIndex);
    }
  }
  if (ctaIndex >= 0) {
    const cta = opening[ctaIndex];
    if (cta?.kind === "link") {
      heroProps.cta = {
        label: truncate(cta.text, 60),
        href: relativizeHref(cta.href, ctx.origin),
      };
      consumed.add(ctaIndex);
    }
  }
  if (imgIndex >= 0) {
    const img = opening[imgIndex];
    if (img?.kind === "image") {
      heroProps.image = ctx.media.ref(img);
      consumed.add(imgIndex);
    }
  }
  sections.push({ type: "hero", props: heroProps, confidence: "high" });

  const rest = blocks.filter((_, i) => !consumed.has(i));

  // --- FAQ pages get the dedicated mapper -----------------------------------
  if (isFaqLike(page)) {
    const faq = mapFaqSections(rest, "", warn);
    if (faq) {
      sections.push(...faq);
      if (isContactLike(page)) appendContactForm(sections, warn);
      return sections;
    }
  }

  // --- main loop: buffer text, flush at image runs / grids / quotes ---------
  let buffer: ExtractedBlock[] = [];
  const flushRichText = (): void => {
    if (buffer.length === 0) return;
    sections.push({
      type: "rich_text",
      props: { body: richDocFromBlocks(buffer), width: "normal" },
      confidence: "high",
    });
    buffer = [];
  };

  const quotes: Array<{ quote: string; author: string }> = [];
  let index = 0;
  while (index < rest.length) {
    const block = rest[index];
    if (!block) break;

    if (block.kind === "image") {
      let runEnd = index;
      while (runEnd < rest.length && rest[runEnd]?.kind === "image") runEnd += 1;
      const run = rest.slice(index, runEnd) as ImageBlock[];
      if (run.length >= 3) {
        flushRichText();
        sections.push({
          type: "gallery",
          props: { images: run.slice(0, 24).map((img) => ctx.media.ref(img)) },
          confidence: "high",
        });
        if (run.length > 24) warn("Gallery capped at 24 images (schema max).");
      } else {
        // 1–2 images: pair with the buffered copy as an image+text split.
        const img = run[0];
        if (img) {
          // Pair the image with the copy since the LAST heading; anything
          // before that heading is unrelated and flushes as rich_text first.
          const headingIdx = lastHeadingIndex(buffer);
          const lastHeading = headingIdx >= 0 ? buffer[headingIdx] : undefined;
          const body = headingIdx >= 0 ? buffer.slice(headingIdx + 1) : [...buffer];
          const heading =
            lastHeading?.kind === "heading" ? truncate(lastHeading.text, 120) : "";
          if (heading || body.length > 0) {
            buffer = headingIdx >= 0 ? buffer.slice(0, headingIdx) : [];
            flushRichText();
            sections.push({
              type: "image_text_split",
              props: {
                heading: heading || "About this",
                body: richDocFromBlocks(body),
                image: ctx.media.ref(img),
                imagePosition: sections.length % 2 === 0 ? "left" : "right",
              },
              confidence: "review",
              note: "Single inline image paired with adjacent copy — check the pairing reads right.",
            });
            for (const extra of run.slice(1)) buffer.push(extra);
          } else {
            // No copy to pair with — hold it for the next text run.
            buffer.push(img);
          }
        }
      }
      index = runEnd;
      continue;
    }

    if (block.kind === "quote") {
      quotes.push({
        quote: truncate(block.text, 500),
        author: truncate(block.cite || "—", 80),
      });
      index += 1;
      continue;
    }

    // heading + list of 3–9 short items → feature grid proposal
    if (
      block.kind === "list" &&
      !block.ordered &&
      block.items.length >= 3 &&
      block.items.length <= 9 &&
      block.items.every((item) => item.length <= 80) &&
      buffer[buffer.length - 1]?.kind === "heading"
    ) {
      const heading = buffer.pop();
      flushRichText();
      sections.push({
        type: "feature_grid",
        props: {
          heading: heading?.kind === "heading" ? truncate(heading.text, 120) : "",
          items: block.items.map((item) => ({ title: truncate(item, 80) })),
          columns: 3,
        },
        confidence: "review",
        note: "Short list under a heading read like services/features — revert to rich_text if it's just a list.",
      });
      index += 1;
      continue;
    }

    // A trailing button after copy → CTA banner (from the last heading on;
    // earlier buffered copy flushes as its own rich_text).
    if (block.kind === "link" && index >= rest.length - 3) {
      const headingIdx = lastHeadingIndex(buffer);
      const lastHeading = headingIdx >= 0 ? buffer[headingIdx] : undefined;
      if (lastHeading?.kind === "heading") {
        const body = buffer
          .slice(headingIdx + 1)
          .filter((b): b is Extract<ExtractedBlock, { kind: "paragraph" }> => b.kind === "paragraph")
          .map((b) => b.text)
          .join(" ");
        buffer = buffer.slice(0, headingIdx);
        flushRichText();
        sections.push({
          type: "cta_banner",
          props: {
            heading: truncate(lastHeading.text, 120),
            body: truncate(body, 300),
            cta: {
              label: truncate(block.text, 60),
              href: relativizeHref(block.href, ctx.origin),
            },
          },
          confidence: "review",
          note: "Closing heading + button read like a call-to-action band.",
        });
        index += 1;
        continue;
      }
    }

    buffer.push(block);
    index += 1;
  }

  // Leftover unpaired images in the buffer become a small gallery.
  const strayImages = buffer.filter((b): b is ImageBlock => b.kind === "image");
  buffer = buffer.filter((b) => b.kind !== "image");
  flushRichText();
  if (strayImages.length > 0) {
    sections.push({
      type: "gallery",
      props: { images: strayImages.map((img) => ctx.media.ref(img)), columns: 2 },
      confidence: "review",
      note: "Stray images with no adjacent copy — decide where these belong.",
    });
  }

  if (quotes.length > 0) {
    sections.push({
      type: "testimonials",
      props: { items: quotes.slice(0, 9) },
      confidence: "review",
      note: "Blockquotes mapped to testimonials — verify they're actually client quotes.",
    });
  }

  if (isContactLike(page)) appendContactForm(sections, warn);
  return sections;
}

function appendContactForm(sections: PlanSection[], warn: (note: string) => void): void {
  sections.push({
    type: "contact_form",
    props: {},
    confidence: "review",
    note: "Contact-like page: WP form plugins can't be migrated — this is our native form. Wire the notification address in site settings.",
  });
  warn("Added a contact_form section — the original WP form (fields, recipients) does not migrate.");
}

// --- plan assembly ----------------------------------------------------------

const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

/** Replace {$media} placeholders with a dummy ref so schemas can dry-run. */
function withDummyMedia(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withDummyMedia);
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.$media === "string") return { mediaId: DUMMY_UUID, alt: obj.alt ?? "" };
    return Object.fromEntries(
      Object.entries(obj).map(([key, child]) => [key, withDummyMedia(child)]),
    );
  }
  return value;
}

export function buildPlan(extract: ExtractedSite, siteSlug: string): MigrationPlan {
  const warnings: string[] = [...extract.notes];
  const media = new MediaRegistry();
  let origin: string | null = null;
  try {
    origin = new URL(extract.source).origin;
  } catch {
    origin = null; // WXR from a file — hrefs stay absolute
  }
  const ctx: MapContext = { media, warnings, origin };

  // Home first, then nav order as discovered, then everything else as drafts.
  const ordered = [...extract.pages].sort((a, b) => {
    const rank = (p: ExtractedPage): number => (p.slug === "/" ? 0 : p.inNav ? 1 : 2);
    return rank(a) - rank(b);
  });

  const pages: PlanPage[] = [];
  const seenSlugs = new Set<string>();
  for (const page of ordered) {
    if (seenSlugs.has(page.slug)) {
      warnings.push(`Duplicate slug ${page.slug} (${page.url}) — second occurrence skipped.`);
      continue;
    }
    seenSlugs.add(page.slug);

    let title =
      page.navLabel ??
      (page.slug === "/"
        ? "Home"
        : titleCase(page.slug.split("/").pop() ?? "") ||
          page.seoTitle?.split(/[|–—-]/)[0]?.trim() ||
          "Untitled");
    if (title.length > MAX_NAV_LABEL) {
      const short = truncate(title, MAX_NAV_LABEL);
      warnings.push(
        `${page.slug}: nav label shortened "${title}" → "${short}" — the original stays in seo.title.`,
      );
      title = short;
    }

    const seo: PlanPage["seo"] = {};
    // The Phase 6 seo.title split: migrated SEO titles are kept verbatim
    // without polluting the nav.
    if (page.seoTitle && page.seoTitle !== title) seo.title = page.seoTitle;
    if (page.metaDescription) seo.description = truncate(page.metaDescription, 300);

    const status: PlanPage["status"] = page.inNav ? "published" : "draft";
    if (!page.inNav) {
      warnings.push(
        `${page.slug}: not linked from the source site's nav — imported as a draft.`,
      );
    }

    pages.push({
      slug: page.slug,
      title,
      seo,
      status,
      sections: mapPageSections(page, ctx),
      sourceUrl: page.url,
    });
  }

  // Dry-validate every proposed section against the live registry schemas.
  for (const page of pages) {
    for (const section of page.sections) {
      const entry = registry[section.type as keyof typeof registry];
      if (!entry) {
        warnings.push(`${page.slug}: unknown section type "${section.type}".`);
        continue;
      }
      const result = entry.schema.safeParse(withDummyMedia(section.props));
      if (!result.success) {
        section.confidence = "review";
        section.note = `${section.note ? `${section.note} ` : ""}DOES NOT VALIDATE: ${result.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`;
        warnings.push(`${page.slug}: proposed ${section.type} does not validate — fix before approving.`);
      }
    }
  }

  const reviewCount = pages.reduce(
    (count, page) => count + page.sections.filter((s) => s.confidence === "review").length,
    0,
  );

  return {
    site: siteSlug,
    source: extract.source,
    generatedAt: new Date().toISOString(),
    approved: false,
    reviewNotes: "",
    warnings: [
      `REVIEW REQUIRED: ${reviewCount} section(s) are marked confidence:"review". Edit this file, write what you changed in reviewNotes, then set approved:true.`,
      ...warnings,
    ],
    media: media.items,
    pages,
  };
}
