import { z } from "zod";
import { edgeField } from "../lib/band";
import type { SectionMeta } from "../contract";

export const schema = z.object({
  heading: z.string().max(120).default("Get in touch"),
  intro: z.string().max(300).describe("textarea").default(""),
  showPhone: z.boolean().default(false),
  submitLabel: z.string().min(1).max(40).default("Send message"),
  successMessage: z
    .string()
    .min(1)
    .max(200)
    .default("Thanks — we'll get back to you shortly."),
  background: z.enum(["surface", "ink"]).default("surface"),
  edge: edgeField,
});

export type ContactFormProps = z.infer<typeof schema>;

export const meta = {
  type: "contact_form" as const,
  label: "Contact form",
  description: "Name/email/message form posting to the site's contact endpoint.",
  category: "forms",
  icon: "mail",
  defaults: schema.parse({}),
} satisfies SectionMeta;

export { ContactForm as Component } from "./ContactForm";
