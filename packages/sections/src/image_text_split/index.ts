import { z } from "zod";
import { imageRef, link } from "../lib/refs";
import { richTextDoc, textDoc } from "../lib/richtext";
import { edgeField } from "../lib/band";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().min(1).max(120),
  headingAccent: z
    .string()
    .max(60)
    .default("")
    .describe("Optional closing phrase set in the italic accent voice"),
  body: richTextDoc.default(textDoc("Add a paragraph or two here.")),
  image: imageRef.nullable().default(null),
  imagePosition: z.enum(["left", "right"]).default("right"),
  cta: link.nullable().default(null),
  depth: z
    .enum(["none", "escape"])
    .default("none")
    .describe("escape: the image dips toward the band's bottom edge"),
  edge: edgeField,
});

export type ImageTextSplitProps = z.infer<typeof schema>;

export const meta = {
  type: "image_text_split" as const,
  label: "Image + text",
  description: "Two-column section: rich text beside an image.",
  category: "content",
  icon: "layout-columns",
  defaults: schema.parse({ heading: "Section heading" }),
} satisfies SectionMeta;

export { ImageTextSplit as Component } from "./ImageTextSplit";
