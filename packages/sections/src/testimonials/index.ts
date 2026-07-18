import { z } from "zod";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().max(120).default("What clients say"),
  items: z
    .array(
      z.object({
        quote: z.string().min(1).max(500).describe("textarea"),
        author: z.string().min(1).max(80),
        role: z.string().max(80).default(""),
      }),
    )
    .min(1)
    .max(9),
});

export type TestimonialsProps = z.infer<typeof schema>;

export const meta = {
  type: "testimonials" as const,
  label: "Testimonials",
  description: "Grid of client quotes with attribution.",
  category: "marketing",
  icon: "message-circle",
  defaults: schema.parse({
    items: [{ quote: "They did a wonderful job.", author: "A happy client" }],
  }),
} satisfies SectionMeta;

export { Testimonials as Component } from "./Testimonials";
