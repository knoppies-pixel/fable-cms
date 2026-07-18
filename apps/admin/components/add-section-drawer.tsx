"use client";

import { useState, useTransition } from "react";
import { addSection } from "@/lib/actions";

export interface SectionGroup {
  category: string;
  sections: Array<{ type: string; label: string; description: string }>;
}

export function AddSectionDrawer({
  siteId,
  pageId,
  groups,
}: {
  siteId: string;
  pageId: string;
  groups: SectionGroup[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pick = (type: string) => {
    setError(null);
    startTransition(async () => {
      const result = await addSection(siteId, pageId, type);
      if (result.ok) {
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-btn bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90"
      >
        {open ? "Close" : "+ Add section"}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 max-h-96 w-80 overflow-y-auto rounded-card bg-surface p-3 shadow-lg ring-1 ring-black/10">
          {error && (
            <p className="mb-2 rounded-btn bg-red-50 px-2 py-1 text-xs text-red-700">
              {error}
            </p>
          )}
          {groups.map((group) => (
            <div key={group.category} className="mb-3 last:mb-0">
              <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {group.category}
              </p>
              {group.sections.map((section) => (
                <button
                  key={section.type}
                  type="button"
                  disabled={pending}
                  onClick={() => pick(section.type)}
                  className="block w-full rounded-btn px-2 py-1.5 text-left hover:bg-surface-alt disabled:opacity-60"
                >
                  <span className="block text-sm font-medium">
                    {section.label}
                  </span>
                  <span className="block text-xs text-muted">
                    {section.description}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
