import { z } from "zod";
import { link } from "../lib/refs";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().min(1).max(120),
  body: z.string().max(300).default(""),
  cta: link.nullable().default(null),
  variant: z.enum(["accent", "subtle"]).default("accent"),
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
