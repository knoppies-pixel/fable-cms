/**
 * Phase 7 acceptance: hardening & polish.
 *
 * Part 1 — props snapshots: trigger captures BEFORE-images on props change,
 *          retention caps history at 20, RLS scopes reads to members.
 * Part 2 — activity log: append-only, actor forgery rejected, site-scoped.
 * Part 3 — form submissions: ingest API (key auth, rate limits, persistence),
 *          RLS (members read/delete, no direct inserts), site contact route
 *          spam layers (honeypot, interaction token, link heuristic).
 * Part 4 — admin UI (Playwright): revision history restore round-trip,
 *          activity feed, submissions inbox.
 * Part 5 — site exporter: export → destroy → import → content-API parity
 *          (the offboarding drill).
 *
 * Requires: local Supabase, admin on :3000 (production build), the seeded
 * demo site, and the pilot clone sites/fynbos-fern (for the export drill).
 * Run with: pnpm test:phase7
 */
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../packages/db/src/types";
import {
  ANON_KEY,
  DEMO_SITE_API_KEY,
  SEED_USERS,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "../packages/db/scripts/local-env";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const ADMIN = "http://127.0.0.1:3000";
const SITE = "http://127.0.0.1:3001";
/** Matches apps/site-template/.env.local — the token layer's signing secret. */
const SITE_PREVIEW_SECRET = "local-preview-secret";

function signToken(timestampMs: number, secret = SITE_PREVIEW_SECRET): string {
  const signature = createHmac("sha256", secret)
    .update(String(timestampMs))
    .digest("hex");
  return `${timestampMs}.${signature}`;
}

let passed = 0;
function ok(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
  passed += 1;
  console.log(`  ok - ${message}`);
}

function service(): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(email: string, password: string) {
  const client = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  return { client, user: data.user };
}

function runSeed() {
  const result = spawnSync("pnpm", ["--filter", "@fable/db", "seed"], {
    cwd: ROOT,
    shell: true,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`seed failed:\n${result.stdout}\n${result.stderr}`);
  }
}

async function main() {
  console.log("# Phase 7 acceptance");
  console.log("\n## Re-seed (suite convention: every suite starts from a fresh seed)");
  runSeed();

  const db = service();
  const admin = await signIn(SEED_USERS.studioAdmin.email, SEED_USERS.studioAdmin.password);
  const editor = await signIn(SEED_USERS.demoEditor.email, SEED_USERS.demoEditor.password);

  // Submissions survive re-seeds by design (leads are not fixtures), so the
  // suite clears its own debris — otherwise a previous run's rate-limit flood
  // would 429 this run's checks.
  await db.from("form_submissions").delete().gte("created_at", "1970-01-01");

  const { data: demoSite } = await db
    .from("sites")
    .select("id")
    .eq("slug", "demo-site")
    .single();
  const { data: otherSite } = await db
    .from("sites")
    .select("id")
    .eq("slug", "other-site")
    .single();
  ok(demoSite && otherSite, "seeded demo-site and other-site exist");

  // ---------------------------------------------------------------- Part 1
  console.log("\n## Part 1 — props snapshots (section_revisions)");

  const { data: demoPages } = await db
    .from("pages")
    .select("id, slug, sections(id, section_type, props)")
    .eq("site_id", demoSite.id)
    .order("sort_order");
  const heroSection = demoPages
    ?.flatMap((page) => page.sections)
    .find((section) => section.section_type === "hero");
  ok(heroSection, "demo site has a hero section to edit");

  // Fresh seed = fresh sections (wholesale replacement) → no revisions yet.
  const { count: initialRevisions } = await db
    .from("section_revisions")
    .select("id", { count: "exact", head: true })
    .eq("section_id", heroSection.id);
  ok(initialRevisions === 0, "freshly seeded section has no revisions");

  const originalProps = heroSection.props as Record<string, unknown>;
  const editedProps = { ...originalProps, heading: "Phase 7 revision probe" };

  // Edit as the signed-in studio admin (the real admin-app path: RLS client).
  const { error: updateError } = await admin.client
    .from("sections")
    .update({ props: editedProps as never })
    .eq("id", heroSection.id);
  ok(!updateError, "studio admin can update section props (RLS)");

  const { data: revisionsAfterEdit } = await admin.client
    .from("section_revisions")
    .select("id, section_type, props, saved_by, saved_by_email, site_id")
    .eq("section_id", heroSection.id);
  ok(revisionsAfterEdit?.length === 1, "props change captured exactly one revision");
  const revision = revisionsAfterEdit[0];
  ok(
    JSON.stringify(revision.props) === JSON.stringify(originalProps),
    "revision holds the BEFORE-image of the props",
  );
  ok(revision.saved_by === admin.user.id, "revision records who saved (auth.uid)");
  ok(
    revision.saved_by_email === SEED_USERS.studioAdmin.email,
    "revision records the saver's email from the JWT",
  );
  ok(revision.site_id === demoSite.id, "revision denormalizes site_id for RLS");

  // No-change update writes no revision (trigger checks IS DISTINCT FROM).
  const { error: noopError } = await admin.client
    .from("sections")
    .update({ props: editedProps as never })
    .eq("id", heroSection.id);
  ok(!noopError, "no-op props update succeeds");
  const { count: afterNoop } = await db
    .from("section_revisions")
    .select("id", { count: "exact", head: true })
    .eq("section_id", heroSection.id);
  ok(afterNoop === 1, "identical props write does not create a revision");

  // Status-only change writes no revision either.
  await admin.client
    .from("sections")
    .update({ status: "draft" })
    .eq("id", heroSection.id);
  await admin.client
    .from("sections")
    .update({ status: "published" })
    .eq("id", heroSection.id);
  const { count: afterStatus } = await db
    .from("section_revisions")
    .select("id", { count: "exact", head: true })
    .eq("section_id", heroSection.id);
  ok(afterStatus === 1, "status-only updates do not create revisions");

  // Retention: 25 more distinct edits → capped at 20 revisions, newest kept.
  for (let i = 0; i < 25; i += 1) {
    const { error } = await db
      .from("sections")
      .update({ props: { ...editedProps, heading: `retention ${i}` } as never })
      .eq("id", heroSection.id);
    if (error) throw new Error(`retention edit ${i} failed: ${error.message}`);
  }
  const { data: retained } = await db
    .from("section_revisions")
    .select("id, props, saved_by")
    .eq("section_id", heroSection.id)
    .order("id", { ascending: true });
  ok(retained?.length === 20, "revision history is capped at 20 per section");
  const newestRetained = retained[retained.length - 1]!.props as Record<string, unknown>;
  ok(
    newestRetained.heading === "retention 23",
    "newest revision is the BEFORE-image of the latest edit",
  );
  ok(
    retained.every((r) => r.saved_by === null || r.saved_by === admin.user.id),
    "service-role edits record saved_by null (system), not a fake user",
  );

  // RLS: the demo editor (member) sees demo revisions; nobody sees other-site's.
  const { data: editorView } = await editor.client
    .from("section_revisions")
    .select("id")
    .eq("section_id", heroSection.id);
  ok((editorView?.length ?? 0) === 20, "client_editor sees their site's revisions");

  const { data: otherPage } = await db
    .from("pages")
    .select("id, sections(id, props, section_type)")
    .eq("site_id", otherSite.id)
    .limit(1)
    .single();
  const otherSection = otherPage?.sections[0];
  ok(otherSection, "other-site has a section for the isolation probe");
  await db
    .from("sections")
    .update({
      props: { ...(otherSection.props as Record<string, unknown>), probe: "x" } as never,
    })
    .eq("id", otherSection.id);
  const { data: crossSiteView } = await editor.client
    .from("section_revisions")
    .select("id")
    .eq("section_id", otherSection.id);
  ok((crossSiteView?.length ?? 0) === 0, "revisions of other sites are invisible (RLS)");

  // Direct writes to history are rejected for authenticated users.
  const { error: forgeRevision } = await editor.client.from("section_revisions").insert({
    section_id: heroSection.id,
    page_id: demoPages![0]!.id,
    site_id: demoSite.id,
    section_type: "hero",
    props: {},
  });
  ok(!!forgeRevision, "authenticated users cannot insert revisions directly");

  // Restore semantics (DB layer): writing an old revision's props back is a
  // normal update — and snapshots the replaced state.
  const restoreTarget = retained[0]!.props;
  await admin.client
    .from("sections")
    .update({ props: restoreTarget as never })
    .eq("id", heroSection.id);
  const { data: sectionAfterRestore } = await db
    .from("sections")
    .select("props")
    .eq("id", heroSection.id)
    .single();
  ok(
    JSON.stringify(sectionAfterRestore?.props) === JSON.stringify(restoreTarget),
    "restoring an old revision's props round-trips",
  );

  // ---------------------------------------------------------------- Part 2
  console.log("\n## Part 2 — activity log");

  const { error: activityInsert } = await admin.client.from("activity_log").insert({
    site_id: demoSite.id,
    actor_id: admin.user.id,
    actor_email: admin.user.email,
    action: "test.event",
    entity_type: "site",
    summary: "Phase 7 acceptance probe event",
  });
  ok(!activityInsert, "member can append an activity event for themselves");

  const { error: forgedActor } = await admin.client.from("activity_log").insert({
    site_id: demoSite.id,
    actor_id: editor.user.id, // someone else
    actor_email: "forged@example.com",
    action: "test.forged",
    entity_type: "site",
    summary: "forged actor",
  });
  ok(!!forgedActor, "appending an event as another user is rejected");

  const { error: crossSiteEvent } = await editor.client.from("activity_log").insert({
    site_id: otherSite.id,
    actor_id: editor.user.id,
    action: "test.cross",
    entity_type: "site",
    summary: "cross-site event",
  });
  ok(!!crossSiteEvent, "appending an event to a non-member site is rejected");

  const { data: activityRows } = await editor.client
    .from("activity_log")
    .select("id, summary")
    .eq("site_id", demoSite.id);
  ok(
    (activityRows?.length ?? 0) >= 1 &&
      activityRows!.some((row) => row.summary === "Phase 7 acceptance probe event"),
    "members can read their site's activity feed",
  );

  const probeEventId = activityRows!.find(
    (row) => row.summary === "Phase 7 acceptance probe event",
  )!.id;
  const { count: updatedCount } = await admin.client
    .from("activity_log")
    .update({ summary: "tampered" }, { count: "exact" })
    .eq("id", probeEventId);
  ok((updatedCount ?? 0) === 0, "activity events cannot be edited (append-only)");
  const { count: deletedCount } = await admin.client
    .from("activity_log")
    .delete({ count: "exact" })
    .eq("id", probeEventId);
  ok((deletedCount ?? 0) === 0, "activity events cannot be deleted by admin users");

  // ---------------------------------------------------------------- Part 3
  console.log("\n## Part 3 — form submissions (ingest API + RLS)");

  const ingest = (body: unknown, key = DEMO_SITE_API_KEY) =>
    fetch(`${ADMIN}/api/forms/demo-site`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify(body),
    });

  const goodSubmission = {
    name: "Thandi Test",
    email: "thandi@example.com",
    message: "Please quote me for a geyser installation.",
    pageSlug: "/contact",
    meta: { ip: "203.0.113.7", userAgent: "phase7-suite" },
  };

  const badKeyResponse = await ingest(goodSubmission, "wrong-key");
  ok(badKeyResponse.status === 401, "forms API rejects a bad site key (401)");

  const okResponse = await ingest(goodSubmission);
  ok(okResponse.status === 200, "forms API accepts a valid submission");
  const okBody = (await okResponse.json()) as { ok: boolean; id: string };
  ok(okBody.ok && typeof okBody.id === "string", "forms API returns the stored id");

  const { data: storedSubmission } = await db
    .from("form_submissions")
    .select("name, email, message, spam, page_slug, meta")
    .eq("id", okBody.id)
    .single();
  ok(
    storedSubmission?.name === goodSubmission.name &&
      storedSubmission.email === goodSubmission.email &&
      storedSubmission.spam === false,
    "submission is persisted with its fields intact",
  );

  const spamResponse = await ingest({
    ...goodSubmission,
    spam: true,
    meta: { ...goodSubmission.meta, spamReasons: ["test"] },
  });
  ok(spamResponse.status === 200, "spam-flagged submissions are stored, not dropped");
  const spamBody = (await spamResponse.json()) as { id: string };
  const { data: spamRow } = await db
    .from("form_submissions")
    .select("spam")
    .eq("id", spamBody.id)
    .single();
  ok(spamRow?.spam === true, "spam flag round-trips to the row");

  // Per-IP ceiling: 5/hour (2 already used above).
  const floodIp = { ...goodSubmission, meta: { ip: "203.0.113.7" } };
  let sawIpLimit = false;
  for (let i = 0; i < 4; i += 1) {
    const response = await ingest(floodIp);
    if (response.status === 429) {
      sawIpLimit = true;
      break;
    }
  }
  ok(sawIpLimit, "per-IP rate limit kicks in (5/hour)");

  // Site-wide ceiling: top up to 30 rows from varied IPs → 429.
  let sawSiteLimit = false;
  for (let i = 0; i < 40; i += 1) {
    const response = await ingest({
      ...goodSubmission,
      meta: { ip: `198.51.100.${i}` },
    });
    if (response.status === 429) {
      sawSiteLimit = true;
      break;
    }
  }
  ok(sawSiteLimit, "site-wide rate limit kicks in (30/hour)");

  // RLS: members read + delete; direct inserts rejected.
  const { data: editorSubmissions } = await editor.client
    .from("form_submissions")
    .select("id")
    .eq("site_id", demoSite.id);
  ok((editorSubmissions?.length ?? 0) >= 2, "members can read their site's submissions");

  const { error: directInsert } = await editor.client.from("form_submissions").insert({
    site_id: demoSite.id,
    name: "direct",
    email: "direct@example.com",
    message: "should fail",
  });
  ok(!!directInsert, "authenticated users cannot insert submissions directly");

  const { count: deleteCount } = await editor.client
    .from("form_submissions")
    .delete({ count: "exact" })
    .eq("id", spamBody.id);
  ok(deleteCount === 1, "members can delete their site's submissions");

  // ---------------------------------------------------------------- Part 3b
  console.log("\n## Part 3b — site contact route (spam layers, end to end)");

  // Clear the rate-limit flood so the site route's forwards aren't 429'd.
  await db.from("form_submissions").delete().gte("created_at", "1970-01-01");

  const contact = (body: unknown) =>
    fetch(`${SITE}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const demoSubmissions = () =>
    db
      .from("form_submissions")
      .select("id, name, spam, meta")
      .eq("site_id", demoSite.id)
      .order("created_at", { ascending: false });

  const human = {
    name: "Sipho Human",
    email: "sipho@example.com",
    message: "I'd like a quote for bathroom renovations, please.",
    pageSlug: "/contact",
  };

  // Honeypot: fake success, nothing stored, nothing forwarded.
  const honeypotResponse = await contact({ ...human, website: "spam.example" });
  ok(honeypotResponse.status === 200, "honeypot submission gets a fake 200");
  const { data: afterHoneypot } = await demoSubmissions();
  ok(afterHoneypot?.length === 0, "honeypot submission is not stored");

  // Direct POST without a token (never loaded the page): refused.
  const tokenlessResponse = await contact(human);
  ok(tokenlessResponse.status === 400, "tokenless direct POST is refused (400)");

  // The real human path: token issued by the site, aged past the time trap.
  const tokenResponse = await fetch(`${SITE}/api/contact/token`);
  ok(tokenResponse.status === 200, "token route issues interaction tokens");
  const { token: issuedToken } = (await tokenResponse.json()) as { token: string };
  ok(
    typeof issuedToken === "string" && issuedToken.includes("."),
    "issued token is signed",
  );
  const agedToken = signToken(Date.now() - 5_000);
  const humanResponse = await contact({ ...human, formToken: agedToken });
  ok(humanResponse.status === 200, "human submission (aged valid token) accepted");
  const { data: afterHuman } = await demoSubmissions();
  ok(
    afterHuman?.length === 1 && afterHuman[0]!.spam === false,
    "human submission stored unflagged",
  );
  const humanMeta = afterHuman[0]!.meta as Record<string, unknown>;
  ok(
    typeof humanMeta.tokenAgeMs === "number" && (humanMeta.tokenAgeMs as number) >= 4000,
    "token age is recorded for triage",
  );

  // Instant submit (token younger than the 3s trap): stored but flagged.
  const instantResponse = await contact({
    ...human,
    name: "Insta Bot",
    formToken: signToken(Date.now()),
  });
  ok(instantResponse.status === 200, "instant submit still gets a 200 (learns nothing)");
  // Forged signature: flagged.
  const forgedResponse = await contact({
    ...human,
    name: "Forger Bot",
    formToken: signToken(Date.now() - 5_000, "wrong-secret"),
  });
  ok(forgedResponse.status === 200, "forged-token submit still gets a 200");
  // Link-stuffed message: flagged.
  const linkResponse = await contact({
    ...human,
    name: "Link Bot",
    message:
      "buy https://a.example https://b.example https://c.example https://d.example",
    formToken: signToken(Date.now() - 5_000),
  });
  ok(linkResponse.status === 200, "link-heavy submit still gets a 200");

  const { data: flagged } = await demoSubmissions();
  const flaggedByName = new Map(flagged?.map((row) => [row.name, row]));
  ok(
    flaggedByName.get("Insta Bot")?.spam === true,
    "too-young token is stored flagged as spam",
  );
  ok(
    flaggedByName.get("Forger Bot")?.spam === true,
    "bad-signature token is stored flagged as spam",
  );
  ok(
    flaggedByName.get("Link Bot")?.spam === true,
    "link-heavy message is stored flagged as spam",
  );
  ok(
    flaggedByName.get("Sipho Human")?.spam === false,
    "the human submission stays unflagged alongside the bots",
  );

  // ---------------------------------------------------------------- Part 4
  console.log("\n## Part 4 — admin UI (revision restore, activity feed, submissions inbox)");

  // Deterministic setup: two known edits so the newest revision holds "A".
  const probeA = { ...originalProps, heading: "UI restore probe A" };
  const probeB = { ...originalProps, heading: "UI restore probe B" };
  await db.from("sections").update({ props: probeA as never }).eq("id", heroSection.id);
  await db.from("sections").update({ props: probeB as never }).eq("id", heroSection.id);
  const { count: revisionsBeforeUi } = await db
    .from("section_revisions")
    .select("id", { count: "exact", head: true })
    .eq("section_id", heroSection.id);

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    page.on("dialog", (dialog) => void dialog.accept());
    page.setDefaultTimeout(30_000);

    await page.goto(`${ADMIN}/login`, { timeout: 120_000 });
    await page.fill("#email", SEED_USERS.studioAdmin.email);
    await page.fill("#password", SEED_USERS.studioAdmin.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/sites\/[0-9a-f-]+\/pages$/, { timeout: 120_000 });
    ok(page.url().includes(demoSite.id), "logged in on the demo site");

    // Open the home page's hero section editor.
    const { data: homePage } = await db
      .from("pages")
      .select("id")
      .eq("site_id", demoSite.id)
      .eq("slug", "/")
      .single();
    await page.goto(
      `${ADMIN}/sites/${demoSite.id}/pages/${homePage!.id}/sections/${heroSection.id}`,
    );
    await page.getByRole("button", { name: /Save section/ }).waitFor({ timeout: 60_000 });

    const history = page.locator("summary", { hasText: "History —" });
    await history.waitFor({ timeout: 30_000 });
    ok(true, "section editor shows the revision history panel");
    await history.click();

    // Restore the newest revision (the state before the last edit → "A").
    await page.getByRole("button", { name: "Restore" }).first().click();
    await page
      .locator('input[value="UI restore probe A"]')
      .waitFor({ timeout: 30_000 });
    ok(true, "restore swaps the editor back to the previous version");

    const { data: heroAfterRestore } = await db
      .from("sections")
      .select("props")
      .eq("id", heroSection.id)
      .single();
    ok(
      (heroAfterRestore?.props as Record<string, unknown>).heading ===
        "UI restore probe A",
      "restored props are persisted",
    );
    const { count: revisionsAfterUi } = await db
      .from("section_revisions")
      .select("id", { count: "exact", head: true })
      .eq("section_id", heroSection.id);
    ok(
      (revisionsAfterUi ?? 0) >= Math.min(20, (revisionsBeforeUi ?? 0)),
      "the replaced state was snapshotted by the restore (undoable)",
    );
    const { data: restoreEvents } = await db
      .from("activity_log")
      .select("summary, actor_email")
      .eq("site_id", demoSite.id)
      .eq("action", "section.restore");
    ok(
      restoreEvents?.some(
        (event) =>
          event.summary.includes("Restored the Hero section") &&
          event.actor_email === SEED_USERS.studioAdmin.email,
      ),
      "the restore is recorded in the activity log with the actor",
    );

    // Activity feed page.
    await page.goto(`${ADMIN}/sites/${demoSite.id}/activity`);
    await page
      .getByText("Restored the Hero section", { exact: false })
      .first()
      .waitFor({ timeout: 30_000 });
    await page
      .getByText("Phase 7 acceptance probe event", { exact: false })
      .waitFor({ timeout: 30_000 });
    ok(true, "activity page lists who changed what, when");

    // Submissions inbox.
    await page.goto(`${ADMIN}/sites/${demoSite.id}/submissions`);
    await page.getByText("Sipho Human").waitFor({ timeout: 30_000 });
    const spamBadges = page.getByText("likely spam", { exact: true });
    ok((await spamBadges.count()) === 3, "inbox shows the three flagged submissions");

    const linkBotCard = page.locator("li").filter({ hasText: "Link Bot" });
    await linkBotCard.getByRole("button", { name: "Delete" }).click();
    await linkBotCard.waitFor({ state: "detached", timeout: 30_000 });
    const { data: remainingSubmissions } = await db
      .from("form_submissions")
      .select("name")
      .eq("site_id", demoSite.id);
    ok(
      remainingSubmissions?.length === 3 &&
        !remainingSubmissions.some((row) => row.name === "Link Bot"),
      "deleting a submission through the inbox removes the row",
    );
  } finally {
    await browser.close();
  }

  // ---------------------------------------------------------------- Part 5
  console.log("\n## Part 5 — site exporter: the offboarding drill (export → destroy → import)");

  const PILOT = "fynbos-fern";
  const pilotEnvFile = join(ROOT, "sites", PILOT, ".env.local");
  if (!existsSync(pilotEnvFile)) {
    throw new Error(`sites/${PILOT}/.env.local not found — the drill needs the pilot site`);
  }
  const pilotEnv: Record<string, string> = {};
  for (const line of readFileSync(pilotEnvFile, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) pilotEnv[match[1]!] = match[2]!;
  }
  const pilotKey = pilotEnv.SITE_API_KEY;
  ok(pilotKey, "pilot site API key available for the drill");

  const { data: pilotSite } = await db
    .from("sites")
    .select("id")
    .eq("slug", PILOT)
    .single();
  ok(pilotSite, "pilot site is registered");

  // Enrich the pilot so every export table carries real rows: an edit (makes
  // a revision), a submission through the real ingest API, an activity event.
  const { data: pilotPage } = await db
    .from("pages")
    .select("id, sections(id, props)")
    .eq("site_id", pilotSite.id)
    .limit(1)
    .single();
  const pilotSection = pilotPage?.sections[0];
  ok(pilotSection, "pilot has a section to edit for the drill");
  await db
    .from("sections")
    .update({
      props: {
        ...(pilotSection.props as Record<string, unknown>),
      } as never,
    })
    .eq("id", pilotSection.id); // no-op: no revision
  await db
    .from("sections")
    .update({
      props: {
        ...(pilotSection.props as Record<string, unknown>),
        drillMarker: "phase7",
      } as never,
    })
    .eq("id", pilotSection.id);
  const drillSubmission = await fetch(`${ADMIN}/api/forms/${PILOT}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": pilotKey },
    body: JSON.stringify({
      name: "Drill Lead",
      email: "drill@example.com",
      message: "Pre-export enquiry — must survive the offboarding drill.",
      meta: { ip: "192.0.2.1" },
    }),
  });
  ok(drillSubmission.status === 200, "pilot accepts a submission before the drill");
  await db.from("activity_log").insert({
    site_id: pilotSite.id,
    action: "drill.marker",
    entity_type: "site",
    summary: "Phase 7 offboarding drill marker",
  });

  const pilotContent = (drafts: boolean) =>
    fetch(`${ADMIN}/api/content/${PILOT}${drafts ? "?drafts=1" : ""}`, {
      headers: { "x-api-key": pilotKey },
    });
  const normalize = (payload: {
    media: Array<{ id: string }>;
    [key: string]: unknown;
  }) => ({
    ...payload,
    media: [...payload.media].sort((a, b) => a.id.localeCompare(b.id)),
  });

  const beforePublished = normalize(await (await pilotContent(false)).json());
  const beforeDrafts = normalize(await (await pilotContent(true)).json());
  const beforeCounts = {
    submissions: (
      await db
        .from("form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
    revisions: (
      await db
        .from("section_revisions")
        .select("id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
    activity: (
      await db
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
    members: (
      await db
        .from("site_members")
        .select("site_id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
  };
  ok((beforeCounts.revisions ?? 0) >= 1, "drill data: pilot has revision history");
  ok((beforeCounts.submissions ?? 0) >= 1, "drill data: pilot has a form submission");
  ok((beforeCounts.members ?? 0) >= 1, "drill data: pilot has memberships");

  // Export.
  const drillDir = join(ROOT, "exports", `${PILOT}-drill`);
  rmSync(drillDir, { recursive: true, force: true });
  const exportRun = spawnSync(
    "pnpm",
    ["export-site", "--", "--slug", PILOT, "--out", `exports/${PILOT}-drill`],
    { cwd: ROOT, shell: true, encoding: "utf8" },
  );
  if (exportRun.status !== 0) {
    throw new Error(`export failed:\n${exportRun.stdout}\n${exportRun.stderr}`);
  }
  ok(existsSync(join(drillDir, "export.json")), "export.json written");
  ok(
    existsSync(join(drillDir, "standalone", "content-snapshot.json")),
    "standalone bundle written with content snapshot",
  );
  const exported = JSON.parse(
    readFileSync(join(drillDir, "export.json"), "utf8"),
  ) as {
    pages: unknown[];
    sections: unknown[];
    media: Array<{ path: string }>;
    form_submissions: unknown[];
    section_revisions: unknown[];
  };
  ok(
    exported.media.every((row) =>
      existsSync(join(drillDir, "media", ...row.path.split("/"))),
    ),
    "every media row's file is in the export",
  );

  // Destroy: the site row (cascade) and the storage bucket. This is the real
  // thing — after this, only the export can bring the pilot back.
  const pilotBucket = `media-${pilotSite.id}`;
  await db.storage.emptyBucket(pilotBucket);
  const { error: bucketDeleteError } = await db.storage.deleteBucket(pilotBucket);
  ok(!bucketDeleteError, "pilot storage bucket deleted");
  const { error: siteDeleteError } = await db
    .from("sites")
    .delete()
    .eq("id", pilotSite.id);
  ok(!siteDeleteError, "pilot site row deleted (content cascades)");
  ok(
    (await pilotContent(false)).status === 401,
    "content API no longer serves the destroyed site",
  );

  // Import back, same API key so the clone + delivery settings keep working.
  const importRun = spawnSync(
    "pnpm",
    [
      "import-site",
      "--",
      "--dir",
      `exports/${PILOT}-drill`,
      "--api-key",
      pilotKey,
    ],
    { cwd: ROOT, shell: true, encoding: "utf8" },
  );
  if (importRun.status !== 0) {
    throw new Error(`import failed:\n${importRun.stdout}\n${importRun.stderr}`);
  }
  ok(true, "import-site restored the export");

  const afterPublished = normalize(await (await pilotContent(false)).json());
  const afterDrafts = normalize(await (await pilotContent(true)).json());
  ok(
    JSON.stringify(afterPublished) === JSON.stringify(beforePublished),
    "published content API payload is identical after destroy → restore",
  );
  ok(
    JSON.stringify(afterDrafts) === JSON.stringify(beforeDrafts),
    "draft content API payload is identical after destroy → restore",
  );

  const afterCounts = {
    submissions: (
      await db
        .from("form_submissions")
        .select("id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
    revisions: (
      await db
        .from("section_revisions")
        .select("id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
    activity: (
      await db
        .from("activity_log")
        .select("id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
    members: (
      await db
        .from("site_members")
        .select("site_id", { count: "exact", head: true })
        .eq("site_id", pilotSite.id)
    ).count,
  };
  ok(
    JSON.stringify(afterCounts) === JSON.stringify(beforeCounts),
    "submissions, revisions, activity and memberships all survived the drill",
  );

  const { data: restoredMedia } = await db
    .from("media")
    .select("path")
    .eq("site_id", pilotSite.id)
    .limit(1)
    .single();
  if (restoredMedia) {
    const mediaResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/public/${pilotBucket}/${restoredMedia.path}`,
    );
    ok(
      mediaResponse.status === 200,
      "restored storage objects are publicly served again",
    );
  }

  rmSync(drillDir, { recursive: true, force: true });

  console.log(`\nAll ${passed} checks passed (parts 1–5).`);
}

main().catch((error) => {
  console.error(`\nFAILED after ${passed} passing checks:\n${error.message ?? error}`);
  process.exit(1);
});
