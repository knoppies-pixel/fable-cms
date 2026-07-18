/**
 * Sanity check for the Zod-to-form introspection: analyze every registry
 * schema and assert the expected field kinds come out. Run with:
 *   pnpm --filter @fable/db exec tsx ../../apps/admin/scripts/check-zod-form.ts
 * (borrows tsx from @fable/db; module resolution works because this file
 * lives inside apps/admin).
 */
import { registry } from "@fable/sections";
import { analyzeSchema, emptyValueFor, type AnnotatedField } from "../lib/zod-form";

let failures = 0;
function expect(cond: boolean, message: string) {
  if (!cond) {
    failures += 1;
    console.error(`  FAIL: ${message}`);
  }
}

function shapeOf(type: string): Record<string, AnnotatedField> {
  const root = analyzeSchema(registry[type as keyof typeof registry].schema);
  if (root.spec.kind !== "object") throw new Error(`${type}: root not object`);
  return root.spec.shape;
}

for (const [type, entry] of Object.entries(registry)) {
  const root = analyzeSchema(entry.schema);
  expect(root.spec.kind === "object", `${type}: root should be object`);
}

const hero = shapeOf("hero");
expect(hero.heading?.spec.kind === "string", "hero.heading is string");
expect(
  hero.subheading?.spec.kind === "string" &&
    hero.subheading.spec.multiline === true,
  "hero.subheading is textarea",
);
expect(
  hero.cta?.spec.kind === "link" && hero.cta.nullable,
  "hero.cta is nullable link",
);
expect(
  hero.image?.spec.kind === "image" && hero.image.nullable,
  "hero.image is nullable image",
);
expect(
  hero.variant?.spec.kind === "enum" &&
    hero.variant.spec.options.join(",") === "centered,split,full-bleed",
  "hero.variant is enum with 3 options",
);

const grid = shapeOf("feature_grid");
expect(
  grid.items?.spec.kind === "array" &&
    grid.items.spec.element.spec.kind === "object" &&
    grid.items.spec.minItems === 1 &&
    grid.items.spec.maxItems === 12,
  `feature_grid.items is array(object) 1..12 (got ${JSON.stringify(
    grid.items?.spec.kind === "array"
      ? { min: grid.items.spec.minItems, max: grid.items.spec.maxItems }
      : grid.items?.spec.kind,
  )})`,
);
expect(
  grid.items?.spec.kind === "array" &&
    grid.items.spec.element.spec.kind === "object" &&
    grid.items.spec.element.spec.shape.description?.spec.kind === "string" &&
    grid.items.spec.element.spec.shape.description.spec.multiline,
  "feature_grid item description is textarea",
);
expect(grid.columns?.spec.kind === "number", "feature_grid.columns is number");
expect(
  grid.columns?.spec.kind === "number" &&
    grid.columns.spec.min === 2 &&
    grid.columns.spec.max === 4,
  "feature_grid.columns bounds 2..4",
);

const richText = shapeOf("rich_text");
expect(richText.body?.spec.kind === "richtext", "rich_text.body is richtext");
expect(richText.width?.spec.kind === "enum", "rich_text.width is enum");

const split = shapeOf("image_text_split");
expect(split.body?.spec.kind === "richtext", "image_text_split.body is richtext");
expect(split.image?.spec.kind === "image", "image_text_split.image is image");

const contact = shapeOf("contact_form");
expect(contact.showPhone?.spec.kind === "boolean", "contact_form.showPhone is boolean");

const gallery = shapeOf("gallery");
expect(
  gallery.images?.spec.kind === "array" &&
    gallery.images.spec.element.spec.kind === "image",
  "gallery.images is array(image)",
);

const logos = shapeOf("logo_strip");
expect(logos.grayscale?.spec.kind === "boolean", "logo_strip.grayscale is boolean");

const faq = shapeOf("faq_accordion");
expect(
  faq.items?.spec.kind === "array" &&
    faq.items.spec.element.spec.kind === "object" &&
    faq.items.spec.element.spec.shape.answer?.spec.kind === "string" &&
    faq.items.spec.element.spec.shape.answer.spec.multiline,
  "faq answer is textarea",
);

// Defaults round-trip: every schema's meta.defaults should parse, and
// emptyValueFor on defaulted fields should return the default.
for (const [type, entry] of Object.entries(registry)) {
  expect(
    entry.schema.safeParse(entry.meta.defaults).success,
    `${type}: meta.defaults parse`,
  );
}
expect(
  emptyValueFor(hero.subheading!) === "",
  "hero.subheading default is empty string",
);
const testimonialItems = shapeOf("testimonials").items;
if (testimonialItems?.spec.kind === "array") {
  const item = emptyValueFor(testimonialItems.spec.element) as Record<string, unknown>;
  expect(
    typeof item === "object" && item !== null && item.quote === "" && item.role === "",
    `new testimonial item is empty object (got ${JSON.stringify(item)})`,
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("zod-form introspection: all checks passed");
