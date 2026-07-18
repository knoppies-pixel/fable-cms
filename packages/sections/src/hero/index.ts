import { z } from "zod";
import { imageRef, link } from "../lib/refs";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().min(1).max(120),
  subheading: z.string().max(240).default(""),
  cta: link.nullable().default(null),
  image: imageRef.nullable().default(null),
  variant: z.enum(["centered", "split", "full-bleed"]).default("centered"),
});

export type HeroProps = z.infer<typeof schema>;

export const meta = {
  type: "hero" as const,
  label: "Hero",
  description: "Top-of-page banner with heading, CTA, optional image.",
  category: "headers",
  icon: "layout-navbar",
  defaults: schema.parse({ heading: "Headline goes here" }),
} satisfies SectionMeta;

export { Hero as Component } from "./Hero";
