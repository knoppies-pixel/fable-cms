/**
 * Browser-environment shim for the design-sync bundle (claude.ai/design).
 *
 * The bundle runs in a plain browser with no Next.js runtime. next/image
 * reads `process.env.*` at module scope (throws without a `process` global)
 * and derives its loader config from `__NEXT_IMAGE_OPTS` — Next's build
 * normally injects both. Outside Next there is no /_next/image optimizer
 * endpoint, so `unoptimized: true` makes next/image render a plain <img>
 * with the original URL. Imported first by design-sync.entry.ts; never part
 * of the published package entry, so real sites are unaffected.
 */
const g = globalThis as { process?: { env: Record<string, unknown> } };
if (typeof g.process === "undefined") {
  g.process = { env: {} };
}
if (!g.process.env.__NEXT_IMAGE_OPTS) {
  g.process.env.__NEXT_IMAGE_OPTS = {
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    path: "/_next/image",
    loader: "default",
    unoptimized: true,
  };
}

export {};
