# design-sync notes — @fable/sections

Repo-specific gotchas for future syncs. Read before re-running.

## Build wiring

- No dist: `@fable/sections` ships raw TS (`main: src/index.ts`). The bundle entry is
  `packages/sections/design-sync.entry.ts` (cfg.entry) — it re-exports src/index plus the 10
  section components that are otherwise only reachable via `registry.<type>.Component`.
  A new section type must be added there AND to cfg.componentSrcMap AND get a doc in
  `.design-sync/docs/`.
- `--node-modules apps/site-template/node_modules` (NOT packages/sections/node_modules —
  sections has no react-dom devDep; site-template has react, react-dom, next, zod).
- CSS is compiled by `node .design-sync/build-css.mjs` (cfg.buildCmd) → packages/sections/.ds-css/sections.css
  (cfg.cssEntry, gitignored). It runs the site-template's own @tailwindcss/postcss over
  app/globals.css (theme from @fable/config + tokens.generated.css, @source packages/sections/src).
  Re-run it whenever section classes or the theme change.
- `packages/sections/design-sync.shim.ts` (imported first by the entry) provides a browser
  `process` global and sets `__NEXT_IMAGE_OPTS = {unoptimized: true, ...}` — next/image reads
  process.env at module scope and there is no /_next/image optimizer outside Next. Without it the
  bundle throws "process is not defined" at eval and every component vanishes from the window global.
- `next/image` CJS interop: sections is `"type": "module"`, so esbuild node-mode interop hands
  `import Image from "next/image"` the raw exports object ("Element type is invalid ... got: object"
  in CmsImage). Fixed via cfg.tsconfig → `.design-sync/tsconfig.bundle.json`, which paths-remaps
  `next/image` → `.design-sync/next-image-interop.ts` (unwraps the default export; imports the deep
  `next/dist/shared/lib/image-external.js` so the remap can't recurse).
- lib fork: `.design-sync/overrides/source-kit.mjs` (declared in cfg.libOverrides) — snake_case
  section dirs (contact_form, rich_text) must count as the component's own dir so the group falls
  through to the doc frontmatter category. Needs `.design-sync/node_modules` junction →
  `.ds-sync/node_modules` (recreate per clone: PowerShell `New-Item -ItemType Junction`).
- Render check/capture browser: no ms-playwright cache on this machine — set
  `DS_CHROMIUM_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"` (system Chrome) for
  package-validate.mjs and package-capture.mjs. Playwright itself resolves from the repo root devDep.
- Windows: transient EPERM clearing ds-bundle/ happens if a shell's cwd is inside it — retry from
  repo root. Never `cd ds-bundle` in the persistent shell.

## Repo source change made by the 2026-07-19 sync (flag to owner)

- `packages/sections/src/lib/media.ts`: mediaStore falls back to a module-singleton Map in the
  browser (client React's `cache()` is a passthrough — every call returned a fresh Map, so
  registerMedia/resolveMedia could never connect and CmsImage rendered null in any browser context,
  including claude.ai/design). Server behavior unchanged. Typecheck passes.

## Preview conventions (authored files)

- Exports are PascalCase function components; grade keys = export names.
- Media refs in previews use data-URI SVG gradients in the brand teal family and registerMedia at
  module top. Remote URLs would fail offline capture.
- Rich text bodies via `textDoc(...)` or hand-built doc nodes (see src/lib/richtext.tsx).

## Known render warns (triaged legitimate)

- (none yet — pre-authoring [RENDER_BLANK] on Hero/CtaBanner floor cards was expected: required
  props have no defaults; superseded by authored previews.)

## 2026-07-21 sync (completed the interrupted 2026-07-19 run)

- FeatureGrid fired [GRID_OVERFLOW] (FourColumnsCompact wider than grid cell) → cfg.overrides
  FeatureGrid + Gallery: {"cardMode": "column", "viewport": "1280x900"}. The viewport matters:
  3/4-column layouts only engage at lg: (>=1024px); the default capture width renders them 2-col,
  hiding the columns axis. Changing "viewport" trips [CONFIG_STALE] on preview-rebuild — needs a
  full package-build first (cardMode alone is presentation-only and doesn't).
- conventions.md authored (cfg.readmeHeader). Its load-bearing claim: the shipped CSS is a PURGED
  Tailwind build over sections src only — arbitrary utilities the design agent writes won't
  resolve; style via section props / listed token classes / var(--color-*) inline. If sections
  gain new utility classes, the conventions class list may need re-validating (grep the compiled
  _ds_bundle.css).
- All 10 sections authored + graded good; CmsImage/RichText/SectionShell floor cards (deliberate
  — primitives, authorable later). _ds_sync.json anchor uploaded, so next sync diffs incrementally.

## Re-sync risks

- `tokens.generated.css` + theme.css feed the compiled CSS: a site theme change silently changes
  every card — re-run buildCmd (the driver does a full build anyway).
- The next/image interop wrapper pins the deep path `next/dist/shared/lib/image-external.js`;
  a Next major upgrade may move it (symptom: "Element type is invalid" in CmsImage again).
- The `process`/`__NEXT_IMAGE_OPTS` shim assumes next/image keeps reading config from
  process.env at module scope.
- Groups come from `.design-sync/docs/*.md` frontmatter via the source-kit fork; upstream converter
  changes to grouping should be re-diffed against the fork (offer to merge on re-sync).
- Preview SVG data-URIs are stable; no network assets anywhere in previews.
