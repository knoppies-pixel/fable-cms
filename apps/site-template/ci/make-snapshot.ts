/**
 * Generates the CI content fixture: a content-API-shaped snapshot composed
 * from the live registry's meta.defaults (the contract guarantees every
 * section renders acceptably with them) plus deterministic placeholder
 * images, written to:
 *
 *   ci/content-snapshot.json        (CONTENT_SNAPSHOT_FILE for the CI build)
 *   public/cms-media/ci-*.png       (referenced media)
 *
 * Two pages: "/" is a realistic composition (image-bearing hero is the LCP,
 * like a real site); "/sections" renders every registry type once, so a
 * section that stops rendering acceptably with defaults fails the quality
 * gate. No CMS, database or network involved — this is what lets GitHub
 * Actions build the site at all.
 *
 * Run: pnpm ci:snapshot   (tsx ci/make-snapshot.ts)
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registry, type SectionType } from "@fable/sections";

const APP = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// --- tiny dependency-free PNG writer (truecolor, gradient + stripes) --------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Deterministic decorative PNG: diagonal two-tone gradient + soft stripes. */
function makePng(width: number, height: number, hue: number): Buffer {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const t = (x / width + y / height) / 2;
      const stripe = Math.sin((x + y) / 24) * 12;
      raw[offset] = Math.max(0, Math.min(255, 40 + hue * 30 + t * 120 + stripe));
      raw[offset + 1] = Math.max(0, Math.min(255, 90 + t * 90 - hue * 10 + stripe));
      raw[offset + 2] = Math.max(0, Math.min(255, 110 - hue * 15 + t * 100 + stripe));
      offset += 3;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- fixture composition ----------------------------------------------------

const MEDIA = [
  { id: "00000000-0000-4000-8000-00000000c100", file: "ci-hero.png", width: 1600, height: 1000, alt: "Placeholder hero image", hue: 0 },
  { id: "00000000-0000-4000-8000-00000000c101", file: "ci-a.png", width: 800, height: 600, alt: "Placeholder image A", hue: 1 },
  { id: "00000000-0000-4000-8000-00000000c102", file: "ci-b.png", width: 800, height: 600, alt: "Placeholder image B", hue: 2 },
  { id: "00000000-0000-4000-8000-00000000c103", file: "ci-c.png", width: 800, height: 600, alt: "Placeholder image C", hue: 3 },
] as const;

const img = (index: number, alt: string) => ({ mediaId: MEDIA[index]!.id, alt });

/** Per-type overrides on top of meta.defaults, only where defaults reference
 * placeholder uuids or CI wants image weight (hero = a realistic LCP). */
const OVERRIDES: Partial<Record<SectionType, Record<string, unknown>>> = {
  hero: {
    image: img(0, "Placeholder hero image"),
    cta: { label: "Get in touch", href: "/sections" },
    variant: "split",
  },
  image_text_split: { image: img(1, "Placeholder image A") },
  gallery: {
    images: [img(1, "Placeholder image A"), img(2, "Placeholder image B"), img(3, "Placeholder image C")],
  },
  logo_strip: { logos: [img(2, "Placeholder logo"), img(3, "Placeholder logo")] },
};

let sectionCounter = 0;
function section(type: SectionType) {
  const entry = registry[type];
  const props = { ...(entry.meta.defaults as Record<string, unknown>), ...OVERRIDES[type] };
  const parsed = entry.schema.safeParse(props);
  if (!parsed.success) {
    throw new Error(`fixture props for ${type} are invalid: ${parsed.error.message}`);
  }
  sectionCounter += 1;
  return {
    id: `00000000-0000-4000-8000-0000000000${String(sectionCounter).padStart(2, "0")}`,
    section_type: type,
    props: parsed.data,
    sort_order: sectionCounter,
    status: "published" as const,
  };
}

const HOME_TYPES: SectionType[] = ["hero", "feature_grid", "image_text_split", "testimonials", "cta_banner"];
const CONTACT_TYPES: SectionType[] = ["rich_text", "contact_form"];
const ALL_TYPES = Object.keys(registry) as SectionType[];

const snapshot = {
  site: {
    slug: "ci-fixture",
    name: "CI Fixture Site",
    domain: null,
    tokens: {},
    settings: {},
  },
  pages: [
    {
      slug: "/",
      title: "Home",
      seo: { description: "CI fixture home page — quality gate for the site template." },
      status: "published",
      published_at: "2026-01-01T00:00:00.000Z",
      sort_order: 0,
      sections: HOME_TYPES.map(section),
    },
    {
      slug: "/sections",
      title: "All sections",
      seo: { description: "Every registry section rendered with its defaults." },
      status: "published",
      published_at: "2026-01-01T00:00:00.000Z",
      sort_order: 1,
      sections: ALL_TYPES.map(section),
    },
    {
      // Section defaults link to /contact (cta_banner et al.) — the fixture
      // must satisfy its own internal links or the link checker rightly fails.
      slug: "/contact",
      title: "Contact",
      seo: { description: "CI fixture contact page." },
      status: "published",
      published_at: "2026-01-01T00:00:00.000Z",
      sort_order: 2,
      sections: CONTACT_TYPES.map(section),
    },
  ],
  media: MEDIA.map((m) => ({
    id: m.id,
    url: `/cms-media/${m.file}`,
    alt: m.alt,
    width: m.width,
    height: m.height,
  })),
};

const mediaDir = join(APP, "public", "cms-media");
mkdirSync(mediaDir, { recursive: true });
for (const m of MEDIA) {
  writeFileSync(join(mediaDir, m.file), makePng(m.width, m.height, m.hue));
}
writeFileSync(
  join(APP, "ci", "content-snapshot.json"),
  `${JSON.stringify(snapshot, null, 2)}\n`,
);
console.log(
  `ci fixture written: ${snapshot.pages.length} pages, ${ALL_TYPES.length + HOME_TYPES.length} sections, ${MEDIA.length} images`,
);
