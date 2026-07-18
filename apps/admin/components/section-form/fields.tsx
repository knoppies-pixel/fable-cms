"use client";

import { useEffect, useState } from "react";
import { mediaPublicUrl } from "@/lib/env";
import { getMediaRow, type MediaRow } from "@/lib/media";
import {
  emptyInnerValue,
  emptyValueFor,
  humanizeKey,
  type AnnotatedField,
  type FieldSpec,
} from "@/lib/zod-form";
import { MediaPicker } from "@/components/media-picker";
import { RichTextField } from "./rich-text-field";

export interface FieldProps {
  siteId: string;
  field: AnnotatedField;
  label: string;
  path: string;
  value: unknown;
  onChange: (value: unknown) => void;
  errors: Record<string, string[]>;
}

const inputClass =
  "w-full rounded-btn border border-black/10 bg-surface px-3 py-2 text-sm outline-none focus:border-accent";

function FieldError({ errors, path }: { errors: Record<string, string[]>; path: string }) {
  const messages = errors[path];
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-600">{messages.join(" ")}</p>;
}

function Label({ text, htmlFor }: { text: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
      {text}
    </label>
  );
}

export function FieldRenderer(props: FieldProps) {
  const { field, value, onChange, label } = props;
  const { spec } = field;

  // Image fields manage their own null state (null = no image chosen);
  // booleans are never nullable in the registry. Everything else nullable
  // gets an add/remove toggle around the inner control.
  if (field.nullable && spec.kind !== "image") {
    if (value == null) {
      return (
        <div>
          <Label text={label} />
          <button
            type="button"
            onClick={() => onChange(emptyInnerValue(spec))}
            className="rounded-btn border border-dashed border-black/20 px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent"
          >
            + Add {label.toLowerCase()}
          </button>
        </div>
      );
    }
    return (
      <div className="relative">
        <InnerField {...props} />
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute right-0 top-0 text-xs text-muted hover:text-red-600"
        >
          Remove
        </button>
      </div>
    );
  }

  return <InnerField {...props} />;
}

function InnerField(props: FieldProps) {
  const { siteId, field, label, path, value, onChange, errors } = props;
  const { spec } = field;

  switch (spec.kind) {
    case "string": {
      const text = typeof value === "string" ? value : "";
      return (
        <div>
          <Label text={label} htmlFor={path} />
          {spec.multiline ? (
            <textarea
              id={path}
              value={text}
              rows={4}
              maxLength={spec.maxLength ?? undefined}
              onChange={(event) => onChange(event.target.value)}
              className={inputClass}
            />
          ) : (
            <input
              id={path}
              type="text"
              value={text}
              maxLength={spec.maxLength ?? undefined}
              onChange={(event) => onChange(event.target.value)}
              className={inputClass}
            />
          )}
          <FieldError errors={errors} path={path} />
        </div>
      );
    }

    case "number": {
      const num = typeof value === "number" && !Number.isNaN(value) ? value : "";
      return (
        <div>
          <Label text={label} htmlFor={path} />
          <input
            id={path}
            type="number"
            value={num}
            min={spec.min ?? undefined}
            max={spec.max ?? undefined}
            step={1}
            onChange={(event) =>
              onChange(
                event.target.value === "" ? undefined : Number(event.target.value),
              )
            }
            className={inputClass}
          />
          <FieldError errors={errors} path={path} />
        </div>
      );
    }

    case "boolean":
      return (
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(event) => onChange(event.target.checked)}
              className="size-4 accent-[--color-accent]"
            />
            {label}
          </label>
          <FieldError errors={errors} path={path} />
        </div>
      );

    case "enum": {
      const current = typeof value === "string" ? value : "";
      const known = spec.options.includes(current);
      return (
        <div>
          <Label text={label} htmlFor={path} />
          <select
            id={path}
            value={known ? current : ""}
            onChange={(event) => onChange(event.target.value)}
            className={inputClass}
          >
            {!known && (
              <option value="" disabled>
                {current ? `Invalid value: ${current}` : "Choose…"}
              </option>
            )}
            {spec.options.map((option) => (
              <option key={option} value={option}>
                {humanizeKey(option)}
              </option>
            ))}
          </select>
          <FieldError errors={errors} path={path} />
        </div>
      );
    }

    case "image":
      return <ImageRefField {...props} />;

    case "link": {
      const linkValue = (value ?? {}) as { label?: unknown; href?: unknown };
      const set = (key: "label" | "href", next: string) =>
        onChange({
          label: typeof linkValue.label === "string" ? linkValue.label : "",
          href: typeof linkValue.href === "string" ? linkValue.href : "",
          [key]: next,
        });
      return (
        <div>
          <Label text={label} />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                type="text"
                aria-label={`${label} text`}
                placeholder="Label"
                value={typeof linkValue.label === "string" ? linkValue.label : ""}
                onChange={(event) => set("label", event.target.value)}
                className={inputClass}
              />
              <FieldError errors={errors} path={`${path}.label`} />
            </div>
            <div>
              <input
                type="text"
                aria-label={`${label} URL`}
                placeholder="/page or https://…"
                value={typeof linkValue.href === "string" ? linkValue.href : ""}
                onChange={(event) => set("href", event.target.value)}
                className={inputClass}
              />
              <FieldError errors={errors} path={`${path}.href`} />
            </div>
          </div>
          <FieldError errors={errors} path={path} />
        </div>
      );
    }

    case "richtext":
      return (
        <div>
          <Label text={label} />
          <RichTextField value={value} onChange={onChange} />
          <FieldError errors={errors} path={path} />
        </div>
      );

    case "object": {
      const objectValue = (value ?? {}) as Record<string, unknown>;
      return (
        <fieldset className="rounded-card border border-black/10 p-3">
          <legend className="px-1 text-sm font-medium">{label}</legend>
          <div className="space-y-3">
            {Object.entries(spec.shape).map(([key, child]) => (
              <FieldRenderer
                key={key}
                siteId={siteId}
                field={child}
                label={humanizeKey(key)}
                path={path ? `${path}.${key}` : key}
                value={objectValue[key]}
                onChange={(next) => onChange({ ...objectValue, [key]: next })}
                errors={errors}
              />
            ))}
          </div>
        </fieldset>
      );
    }

    case "array":
      return <ArrayField {...props} spec={spec} />;

    case "unknown":
      return (
        <div>
          <Label text={label} />
          <p className="text-xs text-muted">
            This field type has no form control yet.
          </p>
        </div>
      );
  }
}

function ArrayField({
  siteId,
  label,
  path,
  value,
  onChange,
  errors,
  spec,
}: FieldProps & { spec: Extract<FieldSpec, { kind: "array" }> }) {
  const items = Array.isArray(value) ? value : [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const isImageArray = spec.element.spec.kind === "image";
  const atMax = spec.maxItems !== null && items.length >= spec.maxItems;

  const setItem = (index: number, next: unknown) =>
    onChange(items.map((item, i) => (i === index ? next : item)));
  const removeItem = (index: number) =>
    onChange(items.filter((_, i) => i !== index));
  const moveItem = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <Label text={label} />
        <span className="text-xs text-muted">
          {items.length}
          {spec.maxItems !== null ? ` / ${spec.maxItems}` : ""} items
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-card border border-black/10 bg-surface-alt/50 p-3"
          >
            <div className="mb-2 flex items-center gap-1">
              <span className="text-xs font-medium text-muted">
                Item {index + 1}
              </span>
              <div className="ml-auto flex gap-1">
                <button
                  type="button"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="rounded-btn px-1.5 text-xs text-muted hover:text-primary disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move down"
                  className="rounded-btn px-1.5 text-xs text-muted hover:text-primary disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-btn px-1.5 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
            <FieldRenderer
              siteId={siteId}
              field={spec.element}
              label={`${label} item ${index + 1}`}
              path={`${path}.${index}`}
              value={item}
              onChange={(next) => setItem(index, next)}
              errors={errors}
            />
          </div>
        ))}
      </div>
      {isImageArray ? (
        <>
          <button
            type="button"
            disabled={atMax}
            onClick={() => setPickerOpen(true)}
            className="mt-2 rounded-btn border border-dashed border-black/20 px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-40"
          >
            + Add image
          </button>
          <MediaPicker
            siteId={siteId}
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onSelect={(media) => {
              onChange([...items, { mediaId: media.id, alt: "" }]);
              setPickerOpen(false);
            }}
          />
        </>
      ) : (
        <button
          type="button"
          disabled={atMax}
          onClick={() => onChange([...items, emptyValueFor(spec.element)])}
          className="mt-2 rounded-btn border border-dashed border-black/20 px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent disabled:opacity-40"
        >
          + Add item
        </button>
      )}
      <FieldError errors={errors} path={path} />
    </div>
  );
}

function ImageRefField({ siteId, label, path, value, onChange, errors, field }: FieldProps) {
  const imageValue = (value ?? null) as { mediaId?: string; alt?: string } | null;
  const mediaId = imageValue?.mediaId;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaRow, setMediaRow] = useState<MediaRow | null>(null);
  const [lookedUp, setLookedUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMediaRow(null);
    setLookedUp(false);
    if (!mediaId) {
      setLookedUp(true);
      return;
    }
    getMediaRow(mediaId)
      .then((row) => {
        if (!cancelled) {
          setMediaRow(row);
          setLookedUp(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLookedUp(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId]);

  return (
    <div>
      <Label text={label} />
      {imageValue == null ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="rounded-btn border border-dashed border-black/20 px-3 py-2 text-sm text-muted hover:border-accent hover:text-accent"
        >
          Choose image…
        </button>
      ) : (
        <div className="flex items-start gap-3">
          <div className="size-20 shrink-0 overflow-hidden rounded-btn bg-surface-alt ring-1 ring-black/10">
            {mediaRow ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaPublicUrl(siteId, mediaRow.path)}
                alt={mediaRow.alt ?? ""}
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center p-1 text-center text-[10px] text-muted">
                {lookedUp ? "Missing image" : "…"}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              type="text"
              placeholder={
                mediaRow?.alt ? `Alt (default: ${mediaRow.alt})` : "Alt text"
              }
              value={imageValue.alt ?? ""}
              onChange={(event) =>
                onChange({ mediaId: imageValue.mediaId, alt: event.target.value })
              }
              className={inputClass}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="rounded-btn px-2 py-1 text-xs text-muted ring-1 ring-black/10 hover:text-primary"
              >
                Replace
              </button>
              {field.nullable && (
                <button
                  type="button"
                  onClick={() => onChange(null)}
                  className="rounded-btn px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <FieldError errors={errors} path={path} />
      <FieldError errors={errors} path={`${path}.mediaId`} />
      <MediaPicker
        siteId={siteId}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(media) => {
          onChange({ mediaId: media.id, alt: imageValue?.alt ?? "" });
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
