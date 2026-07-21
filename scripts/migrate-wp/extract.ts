/**
 * Stage 1 — extract pages, headings, copy and images from a WordPress site,
 * either by crawling the rendered site (handles Elementor, since we read the
 * final HTML) or by parsing a WP export XML (WXR). Output is a neutral
 * block list per page; no CMS decisions happen here (that's plan.ts).
 */
import { parse, type HTMLElement, type Node } from "node-html-parser";
import type { ExtractedBlock, ExtractedPage, ExtractedSite } from "./types";

const USER_AGENT = "FableCMS-Migrator/0.1 (studio content-migration tool)";
const FETCH_TIMEOUT_MS = 20_000;
const FETCH_DELAY_MS = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

// --- block extraction from rendered HTML ------------------------------------

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "FORM", "BUTTON", "INPUT",
  "SELECT", "TEXTAREA", "NAV", "HEADER", "FOOTER", "ASIDE", "TEMPLATE", "DIALOG",
]);

/** Chrome/noise containers we never want content from. */
const SKIP_CLASS_RE =
  /cookie|consent|gdpr|breadcrumb|pagination|share|social|comment|sidebar|widget-area|screen-reader|skip-link|admin-bar|popup|modal|lightbox|slick-dots|swiper-pagination/i;

/** Tags that mean "this element is a container, not a text leaf". */
const BLOCKISH = new Set([
  "P", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "DIV", "SECTION",
  "ARTICLE", "BLOCKQUOTE", "FIGURE", "TABLE", "IMG", "MAIN",
]);

const BUTTON_CLASS_RE = /\bbtn\b|button|elementor-button|wp-block-button/i;

function isElement(node: Node): node is HTMLElement {
  return node.nodeType === 1;
}

function shouldSkip(el: HTMLElement): boolean {
  if (SKIP_TAGS.has(el.tagName ?? "")) return true;
  const idClass = `${el.getAttribute("class") ?? ""} ${el.getAttribute("id") ?? ""}`;
  return SKIP_CLASS_RE.test(idClass);
}

function resolveUrl(src: string, baseUrl: string): string | null {
  try {
    return new URL(src, baseUrl).toString();
  } catch {
    return null;
  }
}

/** WP media size suffix (photo-1024x683.jpg) → full-size original. */
export function stripSizeSuffix(url: string): string {
  return url.replace(/-\d{2,4}x\d{2,4}(?=\.(?:jpe?g|png|webp|gif)(?:$|\?))/i, "");
}

function imageBlock(el: HTMLElement, baseUrl: string): ExtractedBlock | null {
  const rawSrc =
    el.getAttribute("data-src") ??
    el.getAttribute("data-lazy-src") ??
    el.getAttribute("src") ??
    "";
  if (!rawSrc || rawSrc.startsWith("data:")) return null;
  const resolved = resolveUrl(rawSrc, baseUrl);
  if (!resolved) return null;
  if (/\.svg(\?|$)/i.test(resolved)) return null; // icons/ornaments, not photos
  if (/emoji|gravatar|spinner|loading/i.test(resolved)) return null;
  const width = Number(el.getAttribute("width") ?? "0");
  const height = Number(el.getAttribute("height") ?? "0");
  if ((width > 0 && width < 80) || (height > 0 && height < 80)) return null; // icons
  return {
    kind: "image",
    src: stripSizeSuffix(resolved),
    srcOriginal: resolved,
    alt: collapse(el.getAttribute("alt") ?? ""),
  };
}

function walk(el: HTMLElement, baseUrl: string, out: ExtractedBlock[]): void {
  if (shouldSkip(el)) return;
  const tag = el.tagName ?? "";

  const headingMatch = /^H([1-6])$/.exec(tag);
  if (headingMatch) {
    const text = collapse(el.text);
    if (text) out.push({ kind: "heading", level: Number(headingMatch[1]), text });
    return;
  }

  if (tag === "IMG") {
    const block = imageBlock(el, baseUrl);
    if (block) out.push(block);
    return;
  }

  if (tag === "P" || tag === "FIGCAPTION") {
    for (const img of el.querySelectorAll("img")) {
      const block = imageBlock(img, baseUrl);
      if (block) out.push(block);
    }
    const text = collapse(el.text);
    if (text.length > 1) out.push({ kind: "paragraph", text });
    return;
  }

  if (tag === "UL" || tag === "OL") {
    const items = el.childNodes
      .filter(isElement)
      .filter((child) => child.tagName === "LI")
      .map((li) => collapse(li.text))
      .filter(Boolean);
    if (items.length > 0) out.push({ kind: "list", ordered: tag === "OL", items });
    return;
  }

  if (tag === "BLOCKQUOTE") {
    const cite = collapse(
      el.querySelector("cite")?.text ?? el.querySelector("footer")?.text ?? "",
    );
    let text = collapse(el.text);
    if (cite && text.endsWith(cite)) text = collapse(text.slice(0, -cite.length));
    if (text) out.push({ kind: "quote", text, cite });
    return;
  }

  if (tag === "A") {
    const cls = el.getAttribute("class") ?? "";
    const href = el.getAttribute("href") ?? "";
    const text = collapse(el.text);
    if (BUTTON_CLASS_RE.test(cls) && href && text) {
      const resolved = resolveUrl(href, baseUrl);
      if (resolved) out.push({ kind: "link", text, href: resolved });
      return;
    }
    // Non-button anchors: fall through so images inside them are found.
  }

  if (tag === "TABLE") {
    for (const row of el.querySelectorAll("tr")) {
      const cells = row
        .querySelectorAll("td, th")
        .map((cell) => collapse(cell.text))
        .filter(Boolean);
      if (cells.length > 0) out.push({ kind: "paragraph", text: cells.join(" — ") });
    }
    return;
  }

  // Elementor and friends put copy in plain divs. A container with no
  // block-level descendants and real text is a paragraph.
  if ((tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "SPAN") &&
      !el.querySelectorAll("*").some((child) => BLOCKISH.has(child.tagName ?? ""))) {
    const text = collapse(el.text);
    if (text.length > 1) out.push({ kind: "paragraph", text });
    // An inline-only container may still hold a button-styled anchor.
    for (const anchor of el.querySelectorAll("a")) {
      const cls = anchor.getAttribute("class") ?? "";
      const href = anchor.getAttribute("href") ?? "";
      const label = collapse(anchor.text);
      if (BUTTON_CLASS_RE.test(cls) && href && label) {
        const resolved = resolveUrl(href, baseUrl);
        if (resolved) out.push({ kind: "link", text: label, href: resolved });
      }
    }
    return;
  }

  for (const child of el.childNodes) {
    if (isElement(child)) walk(child, baseUrl, out);
  }
}

function dedupeBlocks(blocks: ExtractedBlock[]): ExtractedBlock[] {
  const out: ExtractedBlock[] = [];
  const seenImages = new Set<string>();
  for (const block of blocks) {
    if (block.kind === "image") {
      if (seenImages.has(block.src)) continue;
      seenImages.add(block.src);
    }
    const prev = out[out.length - 1];
    if (prev && JSON.stringify(prev) === JSON.stringify(block)) continue;
    out.push(block);
  }
  return out;
}

export function parseHtml(html: string): HTMLElement {
  return parse(html, {
    blockTextElements: { script: false, noscript: false, style: false, pre: true },
  });
}

/** Pick the main content root: <main> → WP/Elementor wrappers → <body>. */
function contentRoot(root: HTMLElement): HTMLElement {
  return (
    root.querySelector("main") ??
    root.querySelector("[role=main]") ??
    root.querySelector(".elementor[data-elementor-type=wp-page]") ??
    root.querySelector("#content") ??
    root.querySelector("article") ??
    root.querySelector("body") ??
    root
  );
}

export function blocksFromHtml(html: string, baseUrl: string): ExtractedBlock[] {
  const out: ExtractedBlock[] = [];
  walk(contentRoot(parseHtml(html)), baseUrl, out);
  return dedupeBlocks(out);
}

// --- crawl mode -------------------------------------------------------------

function meta(root: HTMLElement, selector: string): string | null {
  const value = root.querySelector(selector)?.getAttribute("content");
  return value ? collapse(value) : null;
}

export function slugFromUrl(url: string): string {
  const path = new URL(url).pathname.toLowerCase();
  const cleaned = path
    .replace(/\/+$/, "")
    .replace(/\.(html?|php)$/, "")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9\-/]/g, "");
  return cleaned === "" ? "/" : cleaned;
}

/** Paths that are never marketing pages worth migrating. */
const SKIP_PATH_RE =
  /\/(wp-admin|wp-content|wp-includes|wp-json|feed|tag|category|author|cart|checkout|my-account|wp-login)([/.]|$)|\/20\d{2}\/\d{2}(\/|$)|\/page\/\d+|\/#|\.(jpe?g|png|gif|webp|pdf|zip|xml)$/i;

function pageUrlCandidates(root: HTMLElement, baseUrl: string, origin: string): Map<string, string> {
  // Map of URL (no hash/query, no trailing slash variance) → anchor text.
  const found = new Map<string, string>();
  for (const anchor of root.querySelectorAll("nav a, header a, footer a")) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    const resolved = resolveUrl(href.split("#")[0] ?? "", baseUrl);
    if (!resolved) continue;
    const url = new URL(resolved);
    if (url.origin !== origin || url.search) continue;
    if (SKIP_PATH_RE.test(url.pathname)) continue;
    const key = `${url.origin}${url.pathname.replace(/\/+$/, "")}` || url.origin;
    const label = collapse(anchor.text);
    if (!found.has(key) && label && label.length <= 60) found.set(key, label);
  }
  return found;
}

async function sitemapUrls(origin: string): Promise<string[]> {
  const out: string[] = [];
  for (const path of ["/sitemap_index.xml", "/wp-sitemap.xml", "/sitemap.xml"]) {
    const xml = await fetchText(`${origin}${path}`);
    if (!xml || !xml.includes("<loc>")) continue;
    const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1] ?? "");
    const subSitemaps = locs.filter((loc) => loc.endsWith(".xml"));
    const pageUrls = locs.filter((loc) => !loc.endsWith(".xml"));
    out.push(...pageUrls);
    // Prefer the page sitemap; posts/products are out of scope for v1.
    for (const sub of subSitemaps.filter((s) => /page/i.test(s)).slice(0, 3)) {
      await sleep(FETCH_DELAY_MS);
      const subXml = await fetchText(sub);
      if (!subXml) continue;
      out.push(
        ...[...subXml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)]
          .map((m) => m[1] ?? "")
          .filter((loc) => !loc.endsWith(".xml")),
      );
    }
    break; // first sitemap that answered is enough
  }
  return out.filter((url) => {
    try {
      const parsed = new URL(url);
      return parsed.origin === origin && !SKIP_PATH_RE.test(parsed.pathname) && !parsed.search;
    } catch {
      return false;
    }
  });
}

function extractPage(
  url: string,
  html: string,
  navLabel: string | null,
  inNav: boolean,
): ExtractedPage {
  const root = parseHtml(html);
  const titleTag = root.querySelector("title")?.text;
  return {
    url,
    slug: slugFromUrl(url),
    navLabel,
    inNav,
    seoTitle: titleTag ? collapse(titleTag) : null,
    metaDescription:
      meta(root, "meta[name=description]") ?? meta(root, "meta[property='og:description']"),
    ogImage: meta(root, "meta[property='og:image']"),
    blocks: blocksFromHtml(html, url),
  };
}

export async function crawlSite(
  startUrl: string,
  options: { maxPages: number; include: string[] },
): Promise<ExtractedSite> {
  const start = new URL(startUrl);
  const origin = start.origin;
  const notes: string[] = [];

  const homeHtml = await fetchText(startUrl);
  if (!homeHtml) throw new Error(`could not fetch ${startUrl}`);
  const homeRoot = parseHtml(homeHtml);
  if (!/wp-content|wp-includes|wp-json/i.test(homeHtml)) {
    notes.push("No wp-content markers found — this may not be a WordPress site; extraction still works on any HTML.");
  }
  const siteName =
    meta(homeRoot, "meta[property='og:site_name']") ??
    (homeRoot.querySelector("title")?.text ?? "").split(/[|–—-]/)[0]?.trim() ??
    null;

  const navLinks = pageUrlCandidates(homeRoot, startUrl, origin);
  const queue: Array<{ url: string; navLabel: string | null; inNav: boolean }> = [];
  const seenSlugs = new Set<string>([slugFromUrl(startUrl)]);
  for (const [url, label] of navLinks) {
    if (seenSlugs.has(slugFromUrl(url))) continue;
    seenSlugs.add(slugFromUrl(url));
    queue.push({ url, navLabel: label, inNav: true });
  }
  for (const url of options.include) {
    if (seenSlugs.has(slugFromUrl(url))) continue;
    seenSlugs.add(slugFromUrl(url));
    queue.push({ url, navLabel: null, inNav: false });
  }
  for (const url of await sitemapUrls(origin)) {
    if (seenSlugs.has(slugFromUrl(url))) continue;
    seenSlugs.add(slugFromUrl(url));
    queue.push({ url, navLabel: null, inNav: false });
  }

  const budget = Math.max(1, options.maxPages);
  if (queue.length + 1 > budget) {
    notes.push(
      `Found ${queue.length + 1} candidate pages; crawling the first ${budget} (raise --max-pages to include more).`,
    );
  }

  const pages: ExtractedPage[] = [
    extractPage(startUrl, homeHtml, navLinks.get(`${origin}`) ?? "Home", true),
  ];
  for (const item of queue.slice(0, budget - 1)) {
    await sleep(FETCH_DELAY_MS);
    const html = await fetchText(item.url);
    if (!html) {
      notes.push(`Failed to fetch ${item.url} — skipped.`);
      continue;
    }
    pages.push(extractPage(item.url, html, item.navLabel, item.inNav));
    console.log(`  fetched ${item.url}`);
  }

  return {
    source: startUrl,
    mode: "crawl",
    extractedAt: new Date().toISOString(),
    siteName,
    pages,
    notes,
  };
}

// --- WXR (WordPress export XML) mode ----------------------------------------

/** <tag>value</tag> or <tag><![CDATA[value]]></tag> within a scoped chunk. */
function xmlTag(chunk: string, tag: string): string | null {
  const open = chunk.indexOf(`<${tag}>`);
  if (open === -1) return null;
  const close = chunk.indexOf(`</${tag}>`, open);
  if (close === -1) return null;
  let value = chunk.slice(open + tag.length + 2, close);
  if (value.startsWith("<![CDATA[")) {
    value = value.slice(9);
    if (value.endsWith("]]>")) value = value.slice(0, -3);
  }
  return value;
}

function yoastMeta(itemXml: string, key: string): string | null {
  let cursor = 0;
  for (;;) {
    const start = itemXml.indexOf("<wp:postmeta>", cursor);
    if (start === -1) return null;
    const end = itemXml.indexOf("</wp:postmeta>", start);
    if (end === -1) return null;
    const metaChunk = itemXml.slice(start, end);
    if (xmlTag(metaChunk, "wp:meta_key") === key) {
      const value = xmlTag(metaChunk, "wp:meta_value");
      // Yoast templates ("%%title%% %%sep%% %%sitename%%") aren't resolvable
      // from an export — treat them as absent.
      return value && !value.includes("%%") ? collapse(value) : null;
    }
    cursor = end;
  }
}

/** Elementor stores content as JSON in postmeta, not in content:encoded. */
function elementorBlocks(itemXml: string, baseUrl: string): ExtractedBlock[] | null {
  let cursor = 0;
  let dataJson: string | null = null;
  for (;;) {
    const start = itemXml.indexOf("<wp:postmeta>", cursor);
    if (start === -1) break;
    const end = itemXml.indexOf("</wp:postmeta>", start);
    if (end === -1) break;
    const metaChunk = itemXml.slice(start, end);
    if (xmlTag(metaChunk, "wp:meta_key") === "_elementor_data") {
      dataJson = xmlTag(metaChunk, "wp:meta_value");
      break;
    }
    cursor = end;
  }
  if (!dataJson) return null;
  let data: unknown;
  try {
    data = JSON.parse(dataJson);
  } catch {
    return null;
  }

  const out: ExtractedBlock[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const el = node as {
      widgetType?: string;
      settings?: Record<string, unknown>;
      elements?: unknown;
    };
    const settings = el.settings ?? {};
    const str = (key: string): string =>
      typeof settings[key] === "string" ? collapse(settings[key] as string) : "";
    switch (el.widgetType) {
      case "heading": {
        const level = Number(/h([1-6])/.exec(String(settings.header_size ?? "h2"))?.[1] ?? 2);
        if (str("title")) out.push({ kind: "heading", level, text: str("title") });
        break;
      }
      case "text-editor": {
        const html = typeof settings.editor === "string" ? settings.editor : "";
        if (html) out.push(...blocksFromHtml(html, baseUrl));
        break;
      }
      case "image": {
        const image = settings.image as { url?: string; alt?: string } | undefined;
        if (image?.url && !/\.svg(\?|$)/i.test(image.url)) {
          out.push({
            kind: "image",
            src: stripSizeSuffix(image.url),
            srcOriginal: image.url,
            alt: collapse(image.alt ?? ""),
          });
        }
        break;
      }
      case "button": {
        const link = settings.link as { url?: string } | undefined;
        if (str("text") && link?.url) {
          out.push({ kind: "link", text: str("text"), href: link.url });
        }
        break;
      }
      case "icon-box":
      case "image-box": {
        if (str("title_text")) out.push({ kind: "heading", level: 3, text: str("title_text") });
        if (str("description_text"))
          out.push({ kind: "paragraph", text: str("description_text") });
        break;
      }
      case "testimonial": {
        if (str("testimonial_content")) {
          out.push({
            kind: "quote",
            text: str("testimonial_content"),
            cite: str("testimonial_name"),
          });
        }
        break;
      }
      default:
        break;
    }
    visit(el.elements);
  };
  visit(data);
  return out.length > 0 ? out : null;
}

export function extractFromWxr(xml: string, sourceLabel: string): ExtractedSite {
  const notes: string[] = [];
  const siteName = xmlTag(xml.slice(0, xml.indexOf("<item>")), "title");
  const pages: ExtractedPage[] = [];
  let elementorPages = 0;

  let cursor = 0;
  for (;;) {
    const start = xml.indexOf("<item>", cursor);
    if (start === -1) break;
    const end = xml.indexOf("</item>", start);
    if (end === -1) break;
    const item = xml.slice(start, end);
    cursor = end;

    if (xmlTag(item, "wp:post_type") !== "page") continue;
    if (xmlTag(item, "wp:status") !== "publish") continue;

    const link = xmlTag(item, "link") ?? "";
    const title = collapse(xmlTag(item, "title") ?? "");
    let slug: string;
    try {
      slug = slugFromUrl(link);
    } catch {
      const postName = xmlTag(item, "wp:post_name") ?? "";
      slug = postName ? `/${postName}` : "/";
    }

    let content = xmlTag(item, "content:encoded") ?? "";
    // Classic-editor exports rely on wpautop: no block tags, paragraphs are
    // separated by blank lines. Wrap them so the HTML walker sees <p>s.
    if (content && !/<(p|h[1-6]|ul|ol|div|img|blockquote|figure)[\s>]/i.test(content)) {
      content = content
        .split(/\n\s*\n/)
        .map((chunk) => `<p>${chunk.trim()}</p>`)
        .join("\n");
    }
    let blocks = blocksFromHtml(content, link || "https://example.invalid/");
    const fromElementor = elementorBlocks(item, link || "https://example.invalid/");
    if (fromElementor && fromElementor.length > blocks.length) {
      blocks = fromElementor;
      elementorPages += 1;
    }

    pages.push({
      url: link,
      slug,
      navLabel: null, // WXR carries no rendered nav — plan derives labels.
      inNav: true, // No nav signal either; default everything to visible.
      seoTitle: yoastMeta(item, "_yoast_wpseo_title") ?? (title || null),
      metaDescription: yoastMeta(item, "_yoast_wpseo_metadesc"),
      ogImage: null,
      blocks,
    });
  }

  if (elementorPages > 0) {
    notes.push(
      `${elementorPages} page(s) were rebuilt from _elementor_data postmeta — Elementor exports keep almost nothing in content:encoded. Crawling the live site usually extracts more faithfully.`,
    );
  }
  notes.push("WXR mode: nav labels and nav membership aren't in the export — review plan titles and page order.");

  return {
    source: sourceLabel,
    mode: "wxr",
    extractedAt: new Date().toISOString(),
    siteName: siteName ? collapse(siteName) : null,
    pages,
    notes,
  };
}
