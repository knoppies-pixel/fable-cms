/**
 * Stage 3 — run an APPROVED plan: download media into the migration folder,
 * then hand everything to the Phase 5 typed seeding helper (seed-lib.ts),
 * which uploads media to Storage, validates every section against the live
 * registry schemas, and inserts the rows. Nothing is written unless the
 * whole plan validates — the same guarantee brief-driven seeding has.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { MigrationPlan, PlanMediaItem } from "./types";

const USER_AGENT = "FableCMS-Migrator/0.1 (studio content-migration tool)";

// Structural mirror of seed-lib's SiteSeedSpec (imported dynamically, so the
// nominal types aren't available at compile time here).
interface SeedLib {
  seedSite(spec: {
    assetsDir: string;
    assets: Array<{ file: string; alt: string; width?: number; height?: number }>;
    pages: (img: (file: string, alt?: string) => { mediaId: string; alt: string }) => Array<{
      slug: string;
      title: string;
      seo: { title?: string; description?: string; noindex?: boolean };
      status?: "draft" | "published";
      sections: Array<{ type: never; props: never; status?: "draft" | "published" }>;
    }>;
  }): Promise<void>;
}

// --- oversized-original downscale -------------------------------------------
// WP media libraries are full of camera-roll originals (5–10MB, 4000px+).
// next/image resizes at request time, but making the optimizer chew a 10MB
// source on first hit is wasted latency and storage — cap the longest edge
// at import. 2560px comfortably covers the template's largest rendered size.

const MAX_EDGE_PX = 2560;
const REENCODE_QUALITY = 82;

type Sharp = typeof import("sharp").default;
let sharpModule: Sharp | null | undefined;
function loadSharp(): Sharp | null {
  if (sharpModule === undefined) {
    try {
      // createRequire, not import(): dynamic ESM import bypasses the CJS
      // resolution (pnpm hoist fallback) that makes sharp reachable here.
      sharpModule = createRequire(__filename)("sharp") as Sharp;
    } catch {
      console.warn("  media: sharp unavailable — oversized originals are kept as-is");
      sharpModule = null;
    }
  }
  return sharpModule;
}

async function downscaleIfOversized(
  buffer: Buffer,
  file: string,
): Promise<Buffer> {
  const sharp = loadSharp();
  if (!sharp) return buffer;
  try {
    // .rotate() bakes EXIF orientation in before it's lost by re-encoding.
    const image = sharp(buffer, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    const edge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (edge <= MAX_EDGE_PX) return buffer;
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) {
      console.warn(`  media: ${file} is ${edge}px ${meta.format ?? "?"} — format not downscaled, kept as-is`);
      return buffer;
    }
    const resized = image.resize({
      width: MAX_EDGE_PX,
      height: MAX_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    });
    const out =
      meta.format === "jpeg"
        ? await resized.jpeg({ quality: REENCODE_QUALITY, mozjpeg: true }).toBuffer()
        : meta.format === "png"
          ? await resized.png().toBuffer()
          : await resized.webp({ quality: REENCODE_QUALITY }).toBuffer();
    if (out.length >= buffer.length) return buffer;
    console.log(
      `  media: ${file} downscaled ${edge}px → ${MAX_EDGE_PX}px (${Math.round(buffer.length / 1024)} KB → ${Math.round(out.length / 1024)} KB)`,
    );
    return out;
  } catch (error) {
    console.warn(`  media: could not inspect ${file} (${String(error)}) — kept as-is`);
    return buffer;
  }
}

// --- extra dimension probes (seed-lib covers JPEG/PNG) ----------------------

function probeWebpGif(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length > 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (
    buffer.length > 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const format = buffer.toString("ascii", 12, 16);
    if (format === "VP8X") {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
    if (format === "VP8 ") {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (format === "VP8L") {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

// --- media download ---------------------------------------------------------

async function fetchImage(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "image/*,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

async function downloadMedia(
  items: PlanMediaItem[],
  mediaDir: string,
): Promise<void> {
  mkdirSync(mediaDir, { recursive: true });
  for (const item of items) {
    const target = join(mediaDir, item.file);
    if (existsSync(target)) {
      console.log(`  media: ${item.file} already downloaded`);
      continue;
    }
    let buffer = await fetchImage(item.sourceUrl);
    if (!buffer && item.fallbackUrl && item.fallbackUrl !== item.sourceUrl) {
      // Full-size guess (WP size suffix stripped) may not exist — take the
      // rendered size we actually saw.
      buffer = await fetchImage(item.fallbackUrl);
      if (buffer) console.log(`  media: ${item.file} fell back to the rendered size`);
    }
    if (!buffer) {
      throw new Error(
        `could not download ${item.file} from ${item.sourceUrl} — fix or remove this media entry (and its $media refs) in the plan`,
      );
    }
    buffer = await downscaleIfOversized(buffer, item.file);
    writeFileSync(target, buffer);
    console.log(`  media: downloaded ${item.file} (${Math.round(buffer.length / 1024)} KB)`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

// --- $media placeholder resolution ------------------------------------------

function resolveMediaRefs(
  value: unknown,
  img: (file: string, alt?: string) => { mediaId: string; alt: string },
): unknown {
  if (Array.isArray(value)) return value.map((item) => resolveMediaRefs(item, img));
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    if (typeof obj.$media === "string") {
      return img(obj.$media, typeof obj.alt === "string" ? obj.alt : "");
    }
    return Object.fromEntries(
      Object.entries(obj).map(([key, child]) => [key, resolveMediaRefs(child, img)]),
    );
  }
  return value;
}

// --- import -----------------------------------------------------------------

export async function runImport(root: string, planPath: string): Promise<void> {
  const plan = JSON.parse(readFileSync(planPath, "utf8")) as MigrationPlan;

  if (!plan.approved) {
    console.error(
      [
        "",
        "REFUSING TO IMPORT: the plan has not been approved.",
        "",
        `  ${planPath}`,
        "",
        "This step is human-in-the-loop by design. Open the plan, review every",
        'section marked confidence:"review" and every warning, edit what the',
        "mapper got wrong, describe your changes in reviewNotes, then set",
        '  "approved": true',
        "and re-run the import.",
        "",
      ].join("\n"),
    );
    process.exitCode = 1;
    return;
  }

  const siteDir = join(root, "sites", plan.site);
  const templateSeedLib = join(root, "apps", "site-template", "scripts", "seed-lib.ts");
  let seedLibPath: string;
  if (existsSync(join(siteDir, "scripts", "seed-lib.ts"))) {
    seedLibPath = join(siteDir, "scripts", "seed-lib.ts");
    // seed-lib reads .env.local from cwd — run inside the site clone.
    process.chdir(siteDir);
  } else {
    seedLibPath = templateSeedLib;
    process.env.SITE_SLUG = plan.site;
    console.warn(
      `warning: sites/${plan.site} not found — seeding via the template's seed-lib against SITE_SLUG=${plan.site}.\n` +
        `         Run create-site.ts first if this site should have its own repo/preview.`,
    );
  }

  const mediaDir = join(root, "migrations", plan.site, "media");
  console.log(`Downloading ${plan.media.length} media file(s)…`);
  await downloadMedia(plan.media, mediaDir);

  // Pre-probe formats seed-lib can't size (it probes JPEG/PNG itself).
  const assets = plan.media.map((item) => {
    let { width, height } = item;
    if (!width || !height) {
      const buffer = readFileSync(join(mediaDir, item.file));
      const probed = probeWebpGif(buffer);
      if (probed) ({ width, height } = probed);
    }
    return { file: item.file, alt: item.alt, width, height };
  });

  const { seedSite } = (await import(pathToFileURL(seedLibPath).href)) as SeedLib;

  console.log(`Seeding ${plan.pages.length} page(s) into site "${plan.site}"…`);
  console.log("(the seeding helper replaces the site's pages wholesale)");
  await seedSite({
    assetsDir: mediaDir,
    assets,
    pages: (img) =>
      plan.pages.map((page) => ({
        slug: page.slug,
        title: page.title,
        seo: page.seo,
        status: page.status,
        sections: page.sections.map((section) => ({
          // Runtime-validated by seed-lib against the registry schema; the
          // compile-time SectionSpec typing can't apply to reviewed JSON.
          type: section.type as never,
          props: resolveMediaRefs(section.props, img) as never,
        })),
      })),
  });

  console.log(
    [
      "",
      "Import complete. Next steps:",
      `  1. pnpm --filter site-${plan.site} dev      # eyeball every page (admin must run on :3000)`,
      `  2. pnpm --filter site-${plan.site} preview  # production build + serve`,
      "  3. Fix copy/section niggles in the admin, not by re-running the import",
      "     (a re-import replaces all pages again).",
      "",
    ].join("\n"),
  );
}
