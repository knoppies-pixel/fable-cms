"use client";

import { useState, useTransition } from "react";
import { setPageStatus, setSectionStatus } from "@/lib/actions";
import { StatusBadge } from "./status-badge";

/**
 * Status badge + publish/unpublish button for a page or a section. The server
 * action revalidates the admin route, so the badge reflects the new status
 * once the transition lands.
 */
export function PublishToggle({
  siteId,
  pageId,
  sectionId,
  status,
}: {
  siteId: string;
  pageId: string;
  sectionId?: string;
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const published = status === "published";
  const next = published ? ("draft" as const) : ("published" as const);
  const target = sectionId ? "section" : "page";

  const toggle = () => {
    setError(null);
    startTransition(async () => {
      const result = sectionId
        ? await setSectionStatus(siteId, pageId, sectionId, next)
        : await setPageStatus(siteId, pageId, next);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <StatusBadge status={status} />
      <button
        type="button"
        disabled={pending}
        onClick={toggle}
        aria-label={`${published ? "Unpublish" : "Publish"} ${target}`}
        className={
          published
            ? "rounded-btn px-2 py-1.5 text-xs text-muted hover:bg-surface-alt hover:text-primary disabled:opacity-60"
            : "rounded-btn bg-emerald-600 px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
        }
      >
        {pending ? "…" : published ? "Unpublish" : "Publish"}
      </button>
    </div>
  );
}
