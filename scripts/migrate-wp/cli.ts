/**
 * Phase 6: WordPress/Elementor → Fable CMS migration CLI (spec §9 Phase 6).
 *
 *   pnpm migrate-wp extract --site <slug> --url https://old-site.example [--max-pages 12] [--include <url>]...
 *   pnpm migrate-wp extract --site <slug> --wxr path/to/export.xml
 *   pnpm migrate-wp plan    --site <slug>
 *   pnpm migrate-wp import  --site <slug> [--plan <path>]
 *
 * Artifacts live in migrations/{site}/: extract.json (stage 1), plan.json
 * (stage 2 — REVIEW AND EDIT THIS, then set approved:true), media/ (stage 3
 * downloads; gitignored). Import refuses unapproved plans, then seeds through
 * the site's typed seeding helper — pages are replaced wholesale, so review
 * before pointing it at a site with hand-edited content.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crawlSite, extractFromWxr } from "./extract";
import { buildPlan } from "./plan";
import { runImport } from "./import";
import type { ExtractedSite } from "./types";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function fail(message: string): never {
  console.error(`\nmigrate-wp: ${message}`);
  process.exit(1);
}

function parseFlags(argv: string[]): Map<string, string[]> {
  const values = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--" || arg === undefined) continue;
    if (!arg.startsWith("--")) fail(`unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) fail(`missing value for ${arg}`);
    const list = values.get(arg) ?? [];
    list.push(value);
    values.set(arg, list);
    i += 1;
  }
  return values;
}

function single(flags: Map<string, string[]>, flag: string): string | undefined {
  const list = flags.get(flag);
  if (list && list.length > 1) fail(`${flag} given more than once`);
  return list?.[0];
}

function migrationDir(site: string): string {
  const dir = join(ROOT, "migrations", site);
  mkdirSync(dir, { recursive: true });
  return dir;
}

async function main(): Promise<void> {
  const [command, ...restArgs] = process.argv.slice(2).filter((a) => a !== "--");
  const flags = parseFlags(restArgs);
  const site = single(flags, "--site") ?? fail("--site <slug> is required");
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(site)) {
    fail(`invalid site slug "${site}"`);
  }

  switch (command) {
    case "extract": {
      const url = single(flags, "--url");
      const wxr = single(flags, "--wxr");
      if (!url === !wxr) fail("exactly one of --url or --wxr is required");

      let extracted: ExtractedSite;
      if (url) {
        console.log(`Crawling ${url}…`);
        extracted = await crawlSite(url, {
          maxPages: Number(single(flags, "--max-pages") ?? "12"),
          include: flags.get("--include") ?? [],
        });
      } else {
        const wxrPath = resolve(wxr as string);
        if (!existsSync(wxrPath)) fail(`no such file: ${wxrPath}`);
        console.log(`Parsing WXR export ${wxrPath}…`);
        extracted = extractFromWxr(readFileSync(wxrPath, "utf8"), wxrPath);
      }

      const outPath = join(migrationDir(site), "extract.json");
      writeFileSync(outPath, `${JSON.stringify(extracted, null, 2)}\n`);
      const blockCount = extracted.pages.reduce((n, p) => n + p.blocks.length, 0);
      console.log(
        `\nExtracted ${extracted.pages.length} page(s), ${blockCount} content block(s) → ${outPath}`,
      );
      for (const note of extracted.notes) console.log(`  note: ${note}`);
      console.log(`\nNext: pnpm migrate-wp plan --site ${site}`);
      break;
    }

    case "plan": {
      const extractPath = join(ROOT, "migrations", site, "extract.json");
      if (!existsSync(extractPath)) {
        fail(`no extraction found at ${extractPath} — run extract first`);
      }
      const extracted = JSON.parse(readFileSync(extractPath, "utf8")) as ExtractedSite;
      const plan = buildPlan(extracted, site);
      const outPath = join(migrationDir(site), "plan.json");
      writeFileSync(outPath, `${JSON.stringify(plan, null, 2)}\n`);

      const sectionCount = plan.pages.reduce((n, p) => n + p.sections.length, 0);
      const reviewCount = plan.pages.reduce(
        (n, p) => n + p.sections.filter((s) => s.confidence === "review").length,
        0,
      );
      console.log(`\nProposed plan → ${outPath}`);
      console.log(
        `  ${plan.pages.length} page(s), ${sectionCount} section(s) (${reviewCount} marked for review), ${plan.media.length} media file(s)`,
      );
      console.log(`  ${plan.warnings.length} warning(s):`);
      for (const warning of plan.warnings) console.log(`    - ${warning}`);
      console.log(
        [
          "",
          "THIS PLAN IS A PROPOSAL. Review and edit it before importing:",
          '  - check every section marked confidence:"review"',
          "  - fix nav titles, drop junk pages/sections, adjust media alts",
          '  - describe your changes in "reviewNotes", set "approved": true',
          `Then: pnpm migrate-wp import --site ${site}`,
        ].join("\n"),
      );
      break;
    }

    case "import": {
      const planPath = resolve(
        single(flags, "--plan") ?? join(ROOT, "migrations", site, "plan.json"),
      );
      if (!existsSync(planPath)) fail(`no plan at ${planPath} — run plan first`);
      await runImport(ROOT, planPath);
      break;
    }

    default:
      fail(
        `unknown command "${command ?? ""}" — expected extract | plan | import (see header of scripts/migrate-wp/cli.ts)`,
      );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
