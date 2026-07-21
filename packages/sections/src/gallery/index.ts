import { z } from "zod";
import { imageRef } from "../lib/refs";
import { edgeField } from "../lib/band";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().max(120).default(""),
  images: z.array(imageRef).min(1).max(24),
  columns: z.number().int().min(2).max(4).default(3),
  edge: edgeField,
});

export type GalleryProps = z.infer<typeof schema>;

export const meta = {
  type: "gallery" as const,
  label: "Gallery",
  description: "Responsive image grid.",
  category: "media",
  icon: "photo",
  defaults: schema.parse({
    images: [{ mediaId: "00000000-0000-0000-0000-000000000000", alt: "" }],
  }),
} satisfies SectionMeta;

export { Gallery as Component } from "./Gallery";
