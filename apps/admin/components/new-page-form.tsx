"use client";

import { useActionState } from "react";
import { createPage, type ActionResult } from "@/lib/actions";

export function NewPageForm({ siteId }: { siteId: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      createPage(siteId, formData),
    null,
  );

  return (
    <form
      action={formAction}
      className="rounded-card bg-surface p-4 shadow-sm ring-1 ring-black/5"
    >
      <label className="block text-sm font-medium" htmlFor="page-title">
        Title
      </label>
      <input
        id="page-title"
        name="title"
        required
        placeholder="Services"
        className="mt-1 w-full rounded-btn border border-black/10 px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <label className="mt-3 block text-sm font-medium" htmlFor="page-slug">
        Slug
      </label>
      <input
        id="page-slug"
        name="slug"
        required
        placeholder="/services"
        className="mt-1 w-full rounded-btn border border-black/10 px-3 py-2 font-mono text-sm outline-none focus:border-accent"
      />
      {state && !state.ok && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-btn bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create page"}
      </button>
      <p className="mt-2 text-xs text-muted">
        New pages start as drafts; sections you add are editable immediately.
      </p>
    </form>
  );
}
