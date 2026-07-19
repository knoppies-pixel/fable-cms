"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { z } from "zod";
import { registry, type SectionType } from "@fable/sections";
import { saveSectionProps } from "@/lib/actions";
import { analyzeSchema, humanizeKey } from "@/lib/zod-form";
import { FieldRenderer } from "./fields";

function collectErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "_root";
    (fieldErrors[path] ??= []).push(issue.message);
  }
  return fieldErrors;
}

export function SectionForm({
  siteId,
  pageId,
  sectionId,
  sectionType,
  initialProps,
  onSaved,
}: {
  siteId: string;
  pageId: string;
  sectionId: string;
  sectionType: SectionType;
  initialProps: unknown;
  onSaved?: () => void;
}) {
  const entry = registry[sectionType];
  const root = useMemo(() => analyzeSchema(entry.schema), [entry]);

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    // Normalize through the schema when possible (fills defaults added since
    // the row was written); fall back to the raw props so invalid rows stay
    // editable instead of being silently reset.
    const parsed = entry.schema.safeParse(initialProps);
    if (parsed.success) return parsed.data as Record<string, unknown>;
    return (initialProps ?? {}) as Record<string, unknown>;
  });
  const [errors, setErrors] = useState<Record<string, string[]>>(() => {
    const parsed = entry.schema.safeParse(initialProps);
    return parsed.success ? {} : collectErrors(parsed.error);
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(timer);
  }, [saved]);

  if (root.spec.kind !== "object") {
    return (
      <p className="text-sm text-red-600">
        Section schema for “{sectionType}” is not an object — cannot build a
        form.
      </p>
    );
  }
  const shape = root.spec.shape;

  const save = () => {
    setSaved(false);
    setWarning(null);
    const parsed = entry.schema.safeParse(values);
    if (!parsed.success) {
      setErrors(collectErrors(parsed.error));
      setFormError("Some fields are invalid — fix the highlighted ones.");
      return;
    }
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await saveSectionProps(
        siteId,
        pageId,
        sectionId,
        parsed.data,
      );
      if (result.ok) {
        setValues(parsed.data as Record<string, unknown>);
        setSaved(true);
        setWarning(result.warning ?? null);
        onSaved?.();
      } else {
        setErrors(result.fieldErrors ?? {});
        setFormError(result.error);
      }
    });
  };

  return (
    <div className="max-w-2xl">
      <div className="space-y-4 rounded-card bg-surface p-5 shadow-sm ring-1 ring-black/5">
        {Object.entries(shape).map(([key, field]) => (
          <FieldRenderer
            key={key}
            siteId={siteId}
            field={field}
            label={humanizeKey(key)}
            path={key}
            value={values[key]}
            onChange={(next) =>
              setValues((prev) => ({ ...prev, [key]: next }))
            }
            errors={errors}
          />
        ))}
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center gap-3 rounded-card bg-surface p-3 shadow-sm ring-1 ring-black/5">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-btn bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save section"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
        {warning && <span className="text-sm text-amber-700">{warning}</span>}
        {formError && <span className="text-sm text-red-600">{formError}</span>}
        {errors._root && (
          <span className="text-sm text-red-600">{errors._root.join(" ")}</span>
        )}
      </div>
    </div>
  );
}
