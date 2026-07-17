# Decisions

Running log of implementation choices and their tradeoffs (see CMS_SYSTEM_SPEC.md §10).

## Phase 0

- **TypeScript pinned to ~5.9 instead of 7.x.** TS 7 (the Go-based compiler) is current on npm,
  but editor tooling and the Next.js TS plugin ecosystem still target 5.x. Revisit once Next
  officially supports 7.
- **Workspace packages ship raw TypeScript** (`main: src/index.ts`) and apps consume them via
  `transpilePackages` — no per-package build step, so `pnpm build` only builds the two apps.
  Simplest setup for a private monorepo; add a bundler only if a package ever needs publishing.
- **Tailwind v4** (CSS-first config). Shared semantic tokens live in
  `packages/config/tailwind/theme.css` as `@theme` variables; the per-site `tokens.json` →
  theme generation pipeline lands in Phase 2.
