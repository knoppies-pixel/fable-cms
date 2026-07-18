import { z } from "zod";
import { imageRef, link, richTextDoc } from "@fable/sections";

/**
 * Zod-schema introspection for the auto-generated section forms (spec §5:
 * "the admin panel auto-generates its edit form from the schema — never
 * hand-write admin forms per section").
 *
 * A schema is analyzed into an AnnotatedField tree:
 *  - string            → text input, or textarea when .describe("textarea")
 *  - number            → number input (min/max from the schema)
 *  - boolean           → checkbox
 *  - enum              → select
 *  - imageRef          → media picker (identity or structural match)
 *  - link              → label + href pair
 *  - richTextDoc       → Tiptap editor
 *  - object            → nested fieldset
 *  - array             → repeatable group
 * .default()/.nullable()/.optional() wrappers are unwrapped; nullability
 * drives the add/remove toggle in the form.
 */

export type FieldSpec =
  | { kind: "string"; multiline: boolean; maxLength: number | null }
  | { kind: "number"; min: number | null; max: number | null }
  | { kind: "boolean" }
  | { kind: "enum"; options: string[] }
  | { kind: "image" }
  | { kind: "link" }
  | { kind: "richtext" }
  | { kind: "object"; shape: Record<string, AnnotatedField> }
  | { kind: "array"; element: AnnotatedField; minItems: number | null; maxItems: number | null }
  | { kind: "unknown" };

export interface AnnotatedField {
  spec: FieldSpec;
  nullable: boolean;
  hasDefault: boolean;
  defaultValue?: unknown;
}

function isImageRefSchema(s: z.ZodType): boolean {
  if (s === (imageRef as z.ZodType)) return true;
  if (!(s instanceof z.ZodObject)) return false;
  const keys = Object.keys(s.shape);
  return keys.length === 2 && keys.includes("mediaId") && keys.includes("alt");
}

function isLinkSchema(s: z.ZodType): boolean {
  if (s === (link as z.ZodType)) return true;
  if (!(s instanceof z.ZodObject)) return false;
  const keys = Object.keys(s.shape);
  return keys.length === 2 && keys.includes("label") && keys.includes("href");
}

function isRichTextSchema(s: z.ZodType): boolean {
  if (s === (richTextDoc as z.ZodType)) return true;
  if (!(s instanceof z.ZodObject)) return false;
  const keys = Object.keys(s.shape);
  return (
    keys.length === 2 &&
    keys.includes("type") &&
    keys.includes("content") &&
    s.shape.type instanceof z.ZodLiteral &&
    s.shape.type.safeParse("doc").success
  );
}

export function analyzeSchema(schema: z.ZodType): AnnotatedField {
  let s: z.ZodType = schema;
  let nullable = false;
  let hasDefault = false;
  let defaultValue: unknown;
  let description: string | undefined;

  // Unwrap default/nullable/optional in any nesting order, collecting the
  // description from whichever layer carries it.
  for (;;) {
    description ??= s.description;
    if (s instanceof z.ZodDefault) {
      hasDefault = true;
      const dv: unknown = s.def.defaultValue;
      defaultValue = typeof dv === "function" ? (dv as () => unknown)() : dv;
      s = s.def.innerType as z.ZodType;
    } else if (s instanceof z.ZodNullable) {
      nullable = true;
      s = s.unwrap() as z.ZodType;
    } else if (s instanceof z.ZodOptional) {
      s = s.unwrap() as z.ZodType;
    } else {
      break;
    }
  }
  description ??= s.description;

  const annotate = (spec: FieldSpec): AnnotatedField => ({
    spec,
    nullable,
    hasDefault,
    ...(hasDefault ? { defaultValue } : {}),
  });

  if (isImageRefSchema(s)) return annotate({ kind: "image" });
  if (isRichTextSchema(s)) return annotate({ kind: "richtext" });
  if (isLinkSchema(s)) return annotate({ kind: "link" });

  if (s instanceof z.ZodString) {
    return annotate({
      kind: "string",
      multiline: description === "textarea",
      maxLength: s.maxLength,
    });
  }
  if (s instanceof z.ZodNumber) {
    return annotate({ kind: "number", min: s.minValue, max: s.maxValue });
  }
  if (s instanceof z.ZodBoolean) return annotate({ kind: "boolean" });
  if (s instanceof z.ZodEnum) {
    return annotate({ kind: "enum", options: s.options.map(String) });
  }
  if (s instanceof z.ZodObject) {
    const shape: Record<string, AnnotatedField> = {};
    for (const [key, value] of Object.entries(s.shape)) {
      shape[key] = analyzeSchema(value as z.ZodType);
    }
    return annotate({ kind: "object", shape });
  }
  if (s instanceof z.ZodArray) {
    const def = s.def as { checks?: unknown };
    let minItems: number | null = null;
    let maxItems: number | null = null;
    if (Array.isArray(def.checks)) {
      for (const check of def.checks as Array<{ _zod?: { def?: { check?: string; minimum?: number; maximum?: number } } }>) {
        const checkDef = check?._zod?.def;
        if (checkDef?.check === "min_length" && typeof checkDef.minimum === "number") {
          minItems = checkDef.minimum;
        }
        if (checkDef?.check === "max_length" && typeof checkDef.maximum === "number") {
          maxItems = checkDef.maximum;
        }
      }
    }
    return annotate({
      kind: "array",
      element: analyzeSchema(s.element as z.ZodType),
      minItems,
      maxItems,
    });
  }
  return annotate({ kind: "unknown" });
}

/** Starting value for a field when the user enables/creates it in the form. */
export function emptyValueFor(field: AnnotatedField): unknown {
  if (field.hasDefault) return structuredCloneValue(field.defaultValue);
  if (field.nullable) return null;
  return emptyInnerValue(field.spec);
}

/** Starting value for a field's inner shape, ignoring nullability/defaults. */
export function emptyInnerValue(spec: FieldSpec): unknown {
  switch (spec.kind) {
    case "string":
      return "";
    case "number":
      return spec.min ?? 0;
    case "boolean":
      return false;
    case "enum":
      return spec.options[0] ?? "";
    case "image":
      return null; // never used directly: image values are set via the picker
    case "link":
      return { label: "", href: "" };
    case "richtext":
      return { type: "doc", content: [] };
    case "object": {
      const value: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(spec.shape)) {
        value[key] = emptyValueFor(child);
      }
      return value;
    }
    case "array":
      return [];
    case "unknown":
      return null;
  }
}

function structuredCloneValue(value: unknown): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

/** "imagePosition" → "Image position" */
export function humanizeKey(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
