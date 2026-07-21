import { z } from "zod";
import { imageRef, link } from "../lib/refs";
import { edgeField } from "../lib/band";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().min(1).max(120),
  headingAccent: z
    .string()
    .max(60)
    .default("")
    .describe("Optional closing phrase set in the italic accent voice"),
  subheading: z.string().max(240).describe("textarea").default(""),
  cta: link.nullable().default(null),
  image: imageRef.nullable().default(null),
  variant: z.enum(["centered", "split", "full-bleed"]).default("centered"),
  edge: edgeField,
});

export type HeroProps = z.infer<typeof schema>;

export const meta = {
  type: "hero" as const,
  label: "Hero",
  description: "Top-of-page banner with heading, CTA, optional image.",
  category: "headers",
  icon: "layout-navbar",
  defaults: schema.parse({ heading: "Headline goes here", edge: "tide" }),
} satisfies SectionMeta;

export { Hero as Component } from "./Hero";
