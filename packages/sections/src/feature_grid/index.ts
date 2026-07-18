import { z } from "zod";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  eyebrow: z.string().max(60).default(""),
  heading: z.string().max(120).default(""),
  intro: z.string().max(300).default(""),
  items: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        description: z.string().max(300).default(""),
      }),
    )
    .min(1)
    .max(12),
  columns: z.number().int().min(2).max(4).default(3),
});

export type FeatureGridProps = z.infer<typeof schema>;

export const meta = {
  type: "feature_grid" as const,
  label: "Feature grid",
  description: "Grid of feature or service cards with title and description.",
  category: "marketing",
  icon: "layout-grid",
  defaults: schema.parse({
    heading: "What we do",
    items: [
      { title: "First feature", description: "Describe it in a sentence." },
      { title: "Second feature", description: "Describe it in a sentence." },
      { title: "Third feature", description: "Describe it in a sentence." },
    ],
  }),
} satisfies SectionMeta;

export { FeatureGrid as Component } from "./FeatureGrid";
