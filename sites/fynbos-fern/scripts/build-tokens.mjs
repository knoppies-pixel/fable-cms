/**
 * Generates app/tokens.generated.css from theme/tokens.json.
 * The generated :root block overrides the neutral defaults declared in
 * @fable/config/tailwind/theme.css (import order in globals.css matters).
 * Run with: pnpm tokens:build (also runs automatically before dev/build).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(root, "theme", "tokens.json"), "utf8"));

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// Ink bands remap these four; "-base" duplicates let light islands inside an
// ink band reset them (see @fable/config theme.css).
const remappable = new Set(["primary", "muted", "accent", "accentContrast"]);

const lines = [];
for (const [name, value] of Object.entries(tokens.colors ?? {})) {
  lines.push(`  --color-${kebab(name)}: ${value};`);
  if (remappable.has(name)) {
    lines.push(`  --color-${kebab(name)}-base: ${value};`);
  }
}
for (const [name, value] of Object.entries(tokens.radius ?? {})) {
  lines.push(`  --radius-${kebab(name)}: ${value};`);
}

const css = [
  "/* AUTO-GENERATED from theme/tokens.json by scripts/build-tokens.mjs — do not edit. */",
  ":root {",
  ...lines,
  "}",
  "",
].join("\n");

writeFileSync(join(root, "app", "tokens.generated.css"), css);
console.log(`tokens.generated.css written (${lines.length} variables)`);
