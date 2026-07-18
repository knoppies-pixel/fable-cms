import type { z } from "zod";
import type { ComponentType } from "react";

/**
 * Section registry contract (see CMS_SYSTEM_SPEC.md §5).
 * Every section module in src/{type}/ exports { schema, meta, Component };
 * scripts/generate-registry.ts collects them into src/registry.ts.
 */

/** Admin add-section drawer grouping. */
export type SectionCategory =
  | "headers"
  | "content"
  | "marketing"
  | "media"
  | "forms";

export interface SectionMeta {
  type: string;
  label: string;
  description: string;
  category: SectionCategory;
  /** Tabler icon name, used by the admin. */
  icon: string;
  /** Result of schema.parse() on a minimal seed — always schema-valid. */
  defaults: Record<string, unknown>;
}

/**
 * Type-erased registry entry. Component props are erased to `never` (the
 * supertype of all component prop shapes) so heterogeneous sections fit one
 * record; the renderer validates props with `schema` before rendering, then
 * widens the component type in one documented cast.
 */
export interface RegistryEntry {
  schema: z.ZodType;
  meta: SectionMeta;
  Component: ComponentType<never>;
}
