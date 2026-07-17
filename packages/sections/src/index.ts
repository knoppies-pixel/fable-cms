import type { z } from "zod";
import type { ComponentType } from "react";

/**
 * Section registry contract (see CMS_SYSTEM_SPEC.md §5).
 * Every section type exports { schema, meta, Component }; a generated
 * registry.ts maps section_type → entry. Section implementations land in Phase 2.
 */
export interface SectionMeta {
  type: string;
  label: string;
  description: string;
  category: string;
  /** Tabler icon name, used by the admin. */
  icon: string;
  defaults: Record<string, unknown>;
}

export interface RegistryEntry {
  schema: z.ZodType;
  meta: SectionMeta;
  Component: ComponentType<Record<string, unknown>>;
}

export const registry: Record<string, RegistryEntry> = {};
