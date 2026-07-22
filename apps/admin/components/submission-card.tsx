"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSubmission } from "@/lib/actions";

export interface SubmissionRow {
  id: string;
  page_slug: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  spam: boolean;
  created_at: string | null;
}

export function SubmissionCard({
  siteId,
  submission,
}: {
  siteId: string;
  submission: SubmissionRow;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const when = submission.created_at
    ? new Date(submission.created_at).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "";

  return (
    <li
      className={`rounded-card bg-surface p-4 shadow-sm ring-1 ${
        submission.spam ? "ring-amber-300" : "ring-black/5"
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{submission.name}</span>
        <a
          href={`mailto:${submission.email}`}
          className="text-sm text-accent hover:underline"
        >
          {submission.email}
        </a>
        {submission.phone && (
          <span className="text-sm text-muted">{submission.phone}</span>
        )}
        {submission.spam && (
          <span className="rounded-btn bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            likely spam
          </span>
        )}
        <span className="ml-auto text-xs text-muted">
          {when}
          {submission.page_slug ? ` · ${submission.page_slug}` : ""}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm">{submission.message}</p>
      <div className="mt-3 flex items-center gap-2">
        {error && <span className="text-xs text-red-600">{error}</span>}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(`Delete the submission from ${submission.name}?`)) {
              setError(null);
              startTransition(async () => {
                const result = await deleteSubmission(siteId, submission.id);
                if (!result.ok) setError(result.error);
                else router.refresh();
              });
            }
          }}
          className="ml-auto rounded-btn px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
