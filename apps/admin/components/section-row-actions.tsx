"use client";

import { useState, useTransition } from "react";
import { deleteSection, duplicateSection } from "@/lib/actions";

export function SectionRowActions({
  siteId,
  pageId,
  sectionId,
  label,
}: {
  siteId: string;
  pageId: string;
  sectionId: string;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => duplicateSection(siteId, pageId, sectionId))}
        className="rounded-btn px-2 py-1.5 text-xs text-muted hover:bg-surface-alt hover:text-primary disabled:opacity-60"
      >
        Duplicate
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (window.confirm(`Delete this ${label} section?`)) {
            run(() => deleteSection(siteId, pageId, sectionId));
          }
        }}
        className="rounded-btn px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Delete
      </button>
    </div>
  );
}
