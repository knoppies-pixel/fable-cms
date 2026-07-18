/**
 * Section registry package (see CMS_SYSTEM_SPEC.md §5).
 * Every section type lives in src/{type}/ and exports { schema, meta,
 * Component }; the generated registry.ts maps section_type → entry.
 */
export type { RegistryEntry, SectionCategory, SectionMeta } from "./contract";
export { getRegistryEntry, registry, type SectionType } from "./registry";

// Shared primitives used by the renderer and (Phase 3) the admin.
export { CmsImage } from "./lib/CmsImage";
export { registerMedia, resolveMedia, type MediaRecord } from "./lib/media";
export { imageRef, link, type ImageRef, type Link } from "./lib/refs";
export { RichText, richTextDoc, textDoc, type RichTextDoc } from "./lib/richtext";
export { SectionShell } from "./lib/SectionShell";
