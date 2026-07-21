/**
 * Compiles the site-template Tailwind v4 stylesheet for design-sync.
 *
 * Uses the site app's own globals.css (which @imports the shared
 * @fable/config theme + per-site tokens.generated.css and @sources
 * packages/sections/src), through the site app's own installed
 * @tailwindcss/postcss — so the output is exactly the CSS a real site ships.
 *
 * Output: packages/sections/.ds-css/sections.css (gitignored; cfg.cssEntry).
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDir = path.join(root, "apps", "site-template");
const require = createRequire(path.join(siteDir, "package.json"));
const postcss = require("postcss");
const tailwind = require("@tailwindcss/postcss");

const input = path.join(siteDir, "app", "globals.css");
const out = path.join(root, "packages", "sections", ".ds-css", "sections.css");

const css = readFileSync(input, "utf8");
const result = await postcss([tailwind({ base: siteDir })]).process(css, {
  from: input,
  to: out,
});
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, result.css);
console.log(`wrote ${path.relative(root, out)} (${result.css.length} bytes)`);
