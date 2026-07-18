import { z } from "zod";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().max(120).default("Frequently asked questions"),
  items: z
    .array(
      z.object({
        question: z.string().min(1).max(200),
        // Plain text; blank lines split paragraphs (rendered whitespace-pre-line).
        answer: z.string().min(1).max(2000).describe("textarea"),
      }),
    )
    .min(1)
    .max(20),
});

export type FaqAccordionProps = z.infer<typeof schema>;

export const meta = {
  type: "faq_accordion" as const,
  label: "FAQ accordion",
  description: "Expandable question-and-answer list.",
  category: "content",
  icon: "help-circle",
  defaults: schema.parse({
    items: [{ question: "How does it work?", answer: "Explain it here." }],
  }),
} satisfies SectionMeta;

export { FaqAccordion as Component } from "./FaqAccordion";
