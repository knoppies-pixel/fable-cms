import { z } from "zod";
import { imageRef } from "../lib/refs";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().max(120).default(""),
  logos: z.array(imageRef).min(1).max(12),
  grayscale: z.boolean().default(true),
});

export type LogoStripProps = z.infer<typeof schema>;

export const meta = {
  type: "logo_strip" as const,
  label: "Logo strip",
  description: "Row of client or partner logos.",
  category: "marketing",
  icon: "building-store",
  defaults: schema.parse({
    heading: "Trusted by",
    logos: [{ mediaId: "00000000-0000-0000-0000-000000000000", alt: "" }],
  }),
} satisfies SectionMeta;

export { LogoStrip as Component } from "./LogoStrip";
