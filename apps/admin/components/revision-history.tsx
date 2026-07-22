"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { restoreSectionRevision } from "@/lib/actions";

export interface RevisionSummary {
  id: number;
  saved_by_email: string | null;
  created_at: string | null;
}

/**
 * The section's saved history (newest first). Each entry is the state the
 * section had *before* that save — restoring swaps the current props back and
 * records the replaced state as a new revision, so restores are undoable.
 */
export function RevisionHistory({
  siteId,
  pageId,
  sectionId,
  revisions,
}: {
  siteId: string;
  pageId: string;
  sectionId: string;
  revisions: RevisionSummary[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (revisions.length === 0) return null;

  return (
    <details className="mt-6 max-w-2xl rounded-card bg-surface shadow-sm ring-1 ring-black/5">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-muted hover:text-primary">
        History — {revisions.length} earlier {revisions.length === 1 ? "version" : "versions"}
      </summary>
      <div className="border-t border-black/5 px-4 py-2">
        {error && <p className="py-1 text-xs text-red-600">{error}</p>}
        {warning && <p className="py-1 text-xs text-amber-700">{warning}</p>}
        <ul>
          {revisions.map((revision) => {
            const when = revision.created_at
              ? new Date(revision.created_at).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "unknown time";
            return (
              <li
                key={revision.id}
                className="flex items-center gap-3 border-b border-black/5 py-2 last:border-b-0"
              >
                <span className="text-sm tabular-nums">{when}</span>
                <span className="text-xs text-muted">
                  {revision.saved_by_email ?? "system"}
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Restore this section to the version from ${when}? The current state is kept in history.`,
                      )
                    ) {
                      setError(null);
                      setWarning(null);
                      startTransition(async () => {
                        const result = await restoreSectionRevision(
                          siteId,
                          pageId,
                          sectionId,
                          revision.id,
                        );
                        if (!result.ok) setError(result.error);
                        else {
                          if (result.warning) setWarning(result.warning);
                          router.refresh();
                        }
                      });
                    }
                  }}
                  className="ml-auto rounded-btn px-2 py-1 text-xs text-accent hover:bg-surface-alt disabled:opacity-60"
                >
                  Restore
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}
