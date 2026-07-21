import { z } from "zod";

/**
 * Shared band fields for section schemas (design/DIRECTION.md).
 * `edge` is the section's bottom joint: an SVG shape in the section's own
 * ground color that dips into the next band. Authoring rule (not enforced in
 * code): max two edge styles per page; tide + foam is the house pairing;
 * swell is reserved for entries into ink bands.
 */
export const edgeField = z
  .enum(["none", "tide", "swell", "shore", "foam"])
  .default("none")
  .describe("Bottom edge shape into the next section");

export type Edge = z.infer<typeof edgeField>;
