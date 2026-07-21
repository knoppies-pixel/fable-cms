import { z } from "zod";
import { richTextDoc, textDoc } from "../lib/richtext";
import { edgeField } from "../lib/band";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  body: richTextDoc.default(textDoc("Write something…")),
  width: z.enum(["narrow", "normal"]).default("narrow"),
  edge: edgeField,
});

export type RichTextSectionProps = z.infer<typeof schema>;

export const meta = {
  type: "rich_text" as const,
  label: "Rich text",
  description: "Free-form formatted text: headings, lists, links, quotes.",
  category: "content",
  icon: "align-left",
  defaults: schema.parse({}),
} satisfies SectionMeta;

export { RichTextSection as Component } from "./RichTextSection";
