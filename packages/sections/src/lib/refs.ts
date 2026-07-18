import { z } from "zod";

/**
 * Shared field schemas reused across section schemas. The admin form
 * generator (Phase 3) special-cases these shapes: imageRef → media picker,
 * link → link editor.
 */

/** Reference to a row in the media table. Resolved to a URL at render time. */
export const imageRef = z.object({
  mediaId: z.uuid(),
  /** Per-placement alt override; empty string falls back to the media row's alt. */
  alt: z.string().max(240).default(""),
});
export type ImageRef = z.infer<typeof imageRef>;

export const link = z.object({
  label: z.string().min(1).max(60),
  href: z.string().min(1).max(500),
});
export type Link = z.infer<typeof link>;
