import { z } from "zod";
import { link } from "../lib/refs";
import { edgeField } from "../lib/band";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().min(1).max(120),
  headingAccent: z
    .string()
    .max(60)
    .default("")
    .describe("Optional closing phrase set in the italic accent voice"),
  body: z.string().max(300).describe("textarea").default(""),
  cta: link.nullable().default(null),
  variant: z.enum(["accent", "subtle", "ink"]).default("accent"),
  ornament: z.boolean().default(false).describe("Foam-dot cluster in one corner"),
  edge: edgeField,
});

export type CtaBannerProps = z.infer<typeof schema>;

export const meta = {
  type: "cta_banner" as const,
  label: "CTA banner",
  description: "Full-width call-to-action band with a button.",
  category: "marketing",
  icon: "speakerphone",
  defaults: schema.parse({
    heading: "Ready to get started?",
    cta: { label: "Contact us", href: "/contact" },
  }),
} satisfies SectionMeta;

export { CtaBanner as Component } from "./CtaBanner";
