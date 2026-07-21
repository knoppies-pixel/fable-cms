import { z } from "zod";
import { imageRef } from "../lib/refs";
import { edgeField } from "../lib/band";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().max(120).default("What clients say"),
  items: z
    .array(
      z.object({
        quote: z.string().min(1).max(500).describe("textarea"),
        author: z.string().min(1).max(80),
        role: z.string().max(80).default(""),
        image: imageRef.nullable().default(null),
      }),
    )
    .min(1)
    .max(9),
  /* Schema default stays "alt" so stored rows render unchanged; new rows get
   * ink via meta.defaults (design/DIRECTION.md — the depth-chord tenant). */
  background: z.enum(["alt", "surface", "ink"]).default("alt"),
  edge: edgeField,
});

export type TestimonialsProps = z.infer<typeof schema>;

export const meta = {
  type: "testimonials" as const,
  label: "Testimonials",
  description:
    "Client quotes with attribution — a grid, or a single pull-quote with portrait.",
  category: "marketing",
  icon: "message-circle",
  defaults: schema.parse({
    items: [{ quote: "They did a wonderful job.", author: "A happy client" }],
    background: "ink",
    edge: "foam",
  }),
} satisfies SectionMeta;

export { Testimonials as Component } from "./Testimonials";
