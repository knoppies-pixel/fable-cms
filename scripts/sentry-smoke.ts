/**
 * Sentry pipeline smoke test (Phase 7): proves error monitoring actually
 * ships events, not just that config files exist.
 *
 * Boots a fake Sentry ingest server locally, builds + starts the site
 * template (snapshot mode) with a DSN pointing at it and SENTRY_SMOKE=1,
 * triggers the deliberate /api/debug-sentry server error, and asserts a
 * Sentry envelope containing the error arrives.
 *
 * Run with: pnpm sentry:smoke
 * (Same wiring shape is deployed in the admin app; this exercises the whole
 * capture → transport → ingest path once, locally, with zero accounts.)
 */
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const APP = join(ROOT, "apps", "site-template");
const INGEST_PORT = 9099;
const SITE_PORT = 3902;
const SHELL = process.platform === "win32";

let passed = 0;
function ok(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
  passed += 1;
  console.log(`  ok - ${message}`);
}

async function main() {
  console.log("# Sentry smoke test");

  // --- fake ingest ----------------------------------------------------------
  const envelopes: string[] = [];
  const ingest = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      let body = Buffer.concat(chunks);
      if (request.headers["content-encoding"] === "gzip") {
        try {
          body = gunzipSync(body);
        } catch {
          /* keep raw */
        }
      }
      envelopes.push(`${request.url}\n${body.toString("utf8")}`);
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
  });
  await new Promise<void>((resolveListen) =>
    ingest.listen(INGEST_PORT, "127.0.0.1", resolveListen),
  );

  const smokeEnv = {
    ...process.env,
    CONTENT_SNAPSHOT_FILE: join(APP, "ci", "content-snapshot.json"),
    SITE_URL: `http://127.0.0.1:${SITE_PORT}`,
    SENTRY_DSN: `http://smokekey@127.0.0.1:${INGEST_PORT}/1`,
    SENTRY_SMOKE: "1",
  };

  // --- build + serve --------------------------------------------------------
  console.log("\n## Build (snapshot mode, DSN set)");
  const fixture = spawnSync("pnpm", ["exec", "tsx", "ci/make-snapshot.ts"], {
    cwd: APP,
    shell: SHELL,
    stdio: "inherit",
  });
  if (fixture.status !== 0) throw new Error("fixture generation failed");
  const build = spawnSync("pnpm", ["run", "build"], {
    cwd: APP,
    shell: SHELL,
    stdio: "inherit",
    env: smokeEnv,
  });
  if (build.status !== 0) throw new Error("build failed");

  const require = createRequire(join(APP, "package.json"));
  const nextBin = require.resolve("next/dist/bin/next");
  const server = spawn(
    process.execPath,
    [nextBin, "start", "--port", String(SITE_PORT)],
    { cwd: APP, env: smokeEnv, stdio: "ignore" },
  );

  try {
    let up = false;
    for (let i = 0; i < 60 && !up; i += 1) {
      try {
        up = (await fetch(`http://127.0.0.1:${SITE_PORT}/`)).ok;
      } catch {
        await new Promise((sleep) => setTimeout(sleep, 1000));
      }
    }
    ok(up, "site serves in snapshot mode with the smoke DSN");

    // --- trigger + assert ---------------------------------------------------
    const debugResponse = await fetch(
      `http://127.0.0.1:${SITE_PORT}/api/debug-sentry`,
    );
    ok(debugResponse.status === 500, "debug route throws a server error (500)");

    let hit: string | undefined;
    for (let i = 0; i < 30 && !hit; i += 1) {
      hit = envelopes.find((envelope) => envelope.includes("sentry-smoke"));
      if (!hit) await new Promise((sleep) => setTimeout(sleep, 1000));
    }
    ok(hit, "ingest received a Sentry envelope containing the error");
    ok(
      hit.includes("/api/1/envelope/"),
      "envelope was addressed to the DSN's project endpoint",
    );
    ok(
      hit.includes("intentional server error"),
      "the captured event carries the real error message",
    );
  } finally {
    server.kill();
    ingest.close();
  }

  console.log(`\nAll ${passed} checks passed.`);
}

main().catch((error) => {
  console.error(`\nFAILED after ${passed} passing checks:\n${error.message ?? error}`);
  process.exit(1);
});
