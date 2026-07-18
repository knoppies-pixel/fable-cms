/**
 * Phase 3 acceptance (spec §9): through the UI alone — create a page,
 * add/edit/delete a section of every one of the 10 registry types, upload
 * and select an image — and verify the content API reflects each change.
 *
 * Drives the real admin app in headless Chrome (Playwright, system Chrome
 * channel). Requires: local Supabase running, seed applied, admin dev
 * server on :3000. Run with:
 *   pnpm --filter @fable/db exec tsx ../../scripts/phase3-acceptance.ts
 */
import { chromium, type Locator, type Page } from "playwright";
import { seed } from "../packages/db/scripts/seed";

const BASE = "http://localhost:3000";
const API_KEY = "local-dev-demo-content-key";
const ADMIN = { email: "admin@studio.local", password: "local-dev-password" };

// 1x1 red PNG.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

let passed = 0;
function ok(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAILED: ${message}`);
  passed += 1;
  console.log(`  ok - ${message}`);
}

interface ApiSection {
  id: string;
  section_type: string;
  props: Record<string, unknown>;
  sort_order: number;
  status: string;
}
interface ApiPayload {
  pages: Array<{ slug: string; title: string; sections: ApiSection[] }>;
  media: Array<{ id: string; url: string; alt: string }>;
}

async function fetchContent(): Promise<ApiPayload> {
  const res = await fetch(`${BASE}/api/content/demo-site?drafts=1`, {
    headers: { "x-api-key": API_KEY },
  });
  if (!res.ok) throw new Error(`content API ${res.status}`);
  return (await res.json()) as ApiPayload;
}

function sectionRow(page: Page, label: string): Locator {
  return page
    .locator("li")
    .filter({ has: page.locator(`p:text-is("${label}")`) });
}

async function addSection(page: Page, label: string) {
  await page.getByRole("button", { name: "+ Add section" }).click();
  await page
    .locator("button", { has: page.locator(`span:text-is("${label}")`) })
    .click();
  await sectionRow(page, label).waitFor({ timeout: 30_000 });
}

async function openEditor(page: Page, label: string) {
  await sectionRow(page, label).getByRole("link", { name: "Edit" }).click();
  await page.waitForURL(/\/sections\/[0-9a-f-]+$/, { timeout: 60_000 });
  await page.getByRole("button", { name: /Save section/ }).waitFor({ timeout: 60_000 });
}

async function saveSection(page: Page) {
  await page.getByRole("button", { name: /Save section/ }).click();
  await page.getByText("Saved ✓").waitFor({ timeout: 30_000 });
}

async function backToPage(page: Page, pageUrl: string) {
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "+ Add section" }).waitFor({ timeout: 60_000 });
}

async function pickImage(page: Page, thumbTitle: string) {
  await page.locator(`button[title="${thumbTitle}"]`).first().click();
}

async function main() {
  await seed(); // fresh fixtures every run — suites are order-independent
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  page.on("dialog", (dialog) => void dialog.accept());
  page.setDefaultTimeout(30_000);

  // --- Login ---------------------------------------------------------------
  await page.goto(`${BASE}/login`, { timeout: 120_000 });
  await page.fill("#email", ADMIN.email);
  await page.fill("#password", ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/sites\/[0-9a-f-]+\/pages$/, { timeout: 120_000 });
  const siteId = /\/sites\/([0-9a-f-]+)\//.exec(page.url())?.[1];
  ok(siteId, "logged in and landed on the demo site's page list");

  // --- Create a page -------------------------------------------------------
  await page.fill("#page-title", "Phase 3 Test");
  await page.fill("#page-slug", "/phase3-test");
  await page.getByRole("button", { name: "Create page" }).click();
  await page.waitForURL(/\/pages\/[0-9a-f-]+$/, { timeout: 60_000 });
  const pageUrl = page.url();
  let api = await fetchContent();
  ok(
    api.pages.some((p) => p.slug === "/phase3-test" && p.title === "Phase 3 Test"),
    "content API shows the page created through the UI",
  );

  // --- Upload an image + edit its alt in the media library -----------------
  await page.goto(`${BASE}/sites/${siteId}/media`);
  await page.getByRole("button", { name: /Upload images/ }).waitFor({ timeout: 60_000 });
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "ui-upload.png", mimeType: "image/png", buffer: PNG_1PX });
  const card = page.locator("figure").filter({ has: page.locator('span[title*="ui-upload"]') });
  await card.waitFor({ timeout: 30_000 });
  ok(true, "image uploaded through the media library UI");

  const altInput = card.locator('input[type="text"]');
  await altInput.fill("Uploaded via UI");
  await altInput.press("Enter");
  await card.getByText("Saved ✓").waitFor({ timeout: 15_000 });
  api = await fetchContent();
  const uploaded = api.media.find((m) => m.url.includes("ui-upload"));
  ok(uploaded, "content API lists the uploaded image");
  ok(uploaded.alt === "Uploaded via UI", "content API shows the alt text edited in the UI");

  // --- Add all 10 section types --------------------------------------------
  const labels: Record<string, string> = {
    hero: "Hero",
    rich_text: "Rich text",
    feature_grid: "Feature grid",
    image_text_split: "Image + text",
    testimonials: "Testimonials",
    cta_banner: "CTA banner",
    faq_accordion: "FAQ accordion",
    contact_form: "Contact form",
    gallery: "Gallery",
    logo_strip: "Logo strip",
  };
  await backToPage(page, pageUrl);
  for (const label of Object.values(labels)) {
    await addSection(page, label);
  }
  api = await fetchContent();
  const testPage = () => {
    const found = api.pages.find((p) => p.slug === "/phase3-test");
    if (!found) throw new Error("phase3-test page missing from API");
    return found;
  };
  ok(
    Object.keys(labels).every((type) =>
      testPage().sections.some((s) => s.section_type === type),
    ),
    "content API shows all 10 section types added through the UI",
  );

  const section = (type: string) => {
    const found = testPage().sections.find((s) => s.section_type === type);
    if (!found) throw new Error(`section ${type} missing from API`);
    return found;
  };

  // --- Edit every type through its generated form --------------------------

  // hero: string, enum, image picker (uploaded image), link
  await openEditor(page, labels.hero);
  await page.fill('[id="heading"]', "Hero edited via UI");
  await page.selectOption('[id="variant"]', "split");
  await page.getByRole("button", { name: "Choose image…" }).click();
  await pickImage(page, "Uploaded via UI");
  await page.getByRole("button", { name: "+ Add cta" }).click();
  await page.getByLabel("Cta text").fill("Call now");
  await page.getByLabel("Cta URL").fill("/contact");
  await saveSection(page);

  // rich_text: Tiptap editor
  await backToPage(page, pageUrl);
  await openEditor(page, labels.rich_text);
  const prose = page.locator(".ProseMirror");
  await prose.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Rich text edited via UI");
  await saveSection(page);

  // feature_grid: number, array of objects (edit + add item), textarea
  await backToPage(page, pageUrl);
  await openEditor(page, labels.feature_grid);
  await page.fill('[id="items.0.title"]', "Feature edited via UI");
  await page.fill('[id="items.0.description"]', "Longer description typed into the textarea.");
  await page.getByRole("button", { name: "+ Add item" }).click();
  await page.fill('[id="items.3.title"]', "Feature added via UI");
  await page.fill('[id="columns"]', "4");
  await saveSection(page);

  // image_text_split: string + image
  await backToPage(page, pageUrl);
  await openEditor(page, labels.image_text_split);
  await page.fill('[id="heading"]', "Split edited via UI");
  await page.getByRole("button", { name: "Choose image…" }).click();
  await pickImage(page, "Uploaded via UI");
  await saveSection(page);

  // testimonials: textarea in array item
  await backToPage(page, pageUrl);
  await openEditor(page, labels.testimonials);
  await page.fill('[id="items.0.quote"]', "Quote edited via UI");
  await page.fill('[id="items.0.author"]', "Playwright");
  await saveSection(page);

  // cta_banner: link object
  await backToPage(page, pageUrl);
  await openEditor(page, labels.cta_banner);
  await page.fill('[id="heading"]', "CTA edited via UI");
  await page.getByLabel("Cta text").fill("Click me UI");
  await page.getByLabel("Cta URL").fill("/phase3-test");
  await saveSection(page);

  // faq_accordion: textarea
  await backToPage(page, pageUrl);
  await openEditor(page, labels.faq_accordion);
  await page.fill('[id="items.0.answer"]', "Answer edited via UI");
  await saveSection(page);

  // contact_form: boolean + string
  await backToPage(page, pageUrl);
  await openEditor(page, labels.contact_form);
  await page.getByLabel("Show phone").check();
  await page.fill('[id="submitLabel"]', "Send it");
  await saveSection(page);

  // gallery: array of image refs — remove placeholder, add real image
  await backToPage(page, pageUrl);
  await openEditor(page, labels.gallery);
  await page.getByRole("button", { name: "Remove" }).first().click();
  await page.getByRole("button", { name: "+ Add image" }).click();
  await pickImage(page, "Uploaded via UI");
  await saveSection(page);

  // logo_strip: boolean + array of image refs
  await backToPage(page, pageUrl);
  await openEditor(page, labels.logo_strip);
  await page.getByLabel("Grayscale").uncheck();
  await page.getByRole("button", { name: "Remove" }).first().click();
  await page.getByRole("button", { name: "+ Add image" }).click();
  await pickImage(page, "Uploaded via UI");
  await saveSection(page);

  // --- Verify every edit through the content API ---------------------------
  api = await fetchContent();
  ok(section("hero").props.heading === "Hero edited via UI", "hero heading (string input)");
  ok(section("hero").props.variant === "split", "hero variant (enum select)");
  ok(
    (section("hero").props.image as { mediaId: string })?.mediaId === uploaded.id,
    "hero image picked from the media picker is the uploaded image",
  );
  ok(
    (section("hero").props.cta as { label: string })?.label === "Call now",
    "hero cta (nullable link enabled + edited)",
  );
  ok(
    JSON.stringify(section("rich_text").props.body).includes("Rich text edited via UI"),
    "rich text body (Tiptap)",
  );
  const gridItems = section("feature_grid").props.items as Array<{ title: string; description: string }>;
  ok(gridItems[0]?.title === "Feature edited via UI", "feature grid item title (array of objects)");
  ok(
    gridItems[0]?.description === "Longer description typed into the textarea.",
    "feature grid item description (textarea)",
  );
  ok(gridItems.length === 4 && gridItems[3]?.title === "Feature added via UI", "feature grid item added");
  ok(section("feature_grid").props.columns === 4, "feature grid columns (number input)");
  ok(section("image_text_split").props.heading === "Split edited via UI", "image+text heading");
  ok(
    (section("image_text_split").props.image as { mediaId: string })?.mediaId === uploaded.id,
    "image+text image picked",
  );
  const quotes = section("testimonials").props.items as Array<{ quote: string; author: string }>;
  ok(quotes[0]?.quote === "Quote edited via UI" && quotes[0]?.author === "Playwright", "testimonial edited");
  ok(section("cta_banner").props.heading === "CTA edited via UI", "cta banner heading");
  ok(
    (section("cta_banner").props.cta as { label: string })?.label === "Click me UI",
    "cta banner link (link object)",
  );
  const faqs = section("faq_accordion").props.items as Array<{ answer: string }>;
  ok(faqs[0]?.answer === "Answer edited via UI", "faq answer (textarea)");
  ok(section("contact_form").props.showPhone === true, "contact form showPhone (boolean checkbox)");
  ok(section("contact_form").props.submitLabel === "Send it", "contact form submit label");
  const galleryImages = section("gallery").props.images as Array<{ mediaId: string }>;
  ok(
    galleryImages.length === 1 && galleryImages[0]?.mediaId === uploaded.id,
    "gallery images (array of image refs: removed placeholder, added upload)",
  );
  ok(section("logo_strip").props.grayscale === false, "logo strip grayscale (boolean)");
  const logos = section("logo_strip").props.logos as Array<{ mediaId: string }>;
  ok(logos.length === 1 && logos[0]?.mediaId === uploaded.id, "logo strip logos updated");

  // --- Delete every section through the UI ---------------------------------
  await backToPage(page, pageUrl);
  for (const label of Object.values(labels)) {
    const row = sectionRow(page, label);
    await row.getByRole("button", { name: "Delete" }).click();
    await row.waitFor({ state: "detached", timeout: 30_000 });
  }
  api = await fetchContent();
  ok(
    testPage().sections.length === 0,
    "content API shows zero sections after deleting all 10 through the UI",
  );

  await browser.close();
  console.log(`\nPhase 3 acceptance: all ${passed} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
