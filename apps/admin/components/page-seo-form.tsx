"use client";

import { useActionState } from "react";
import { savePageSeo, type ActionResult } from "@/lib/actions";

export interface PageSeo {
  title?: string;
  description?: string;
  noindex?: boolean;
}

/**
 * Collapsible SEO panel on the page detail. Edits the `pages.seo` jsonb:
 * SEO title (overrides the derived tab/search title — the page title above
 * stays the short nav label), meta description, and noindex.
 */
export function PageSeoForm({
  siteId,
  pageId,
  navTitle,
  seo,
}: {
  siteId: string;
  pageId: string;
  navTitle: string;
  seo: PageSeo;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) =>
      savePageSeo(siteId, pageId, {
        title: String(formData.get("seo-title") ?? ""),
        description: String(formData.get("seo-description") ?? ""),
        noindex: formData.get("seo-noindex") === "on",
      }),
    null,
  );

  return (
    <details className="mb-6 rounded-card bg-surface shadow-sm ring-1 ring-black/5">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
        SEO
        <span className="ml-2 font-normal text-muted">
          {seo.title ? seo.title : `${navTitle} — defaults from the nav title`}
        </span>
      </summary>
      <form action={formAction} className="border-t border-black/5 px-4 py-4">
        <label className="block text-sm font-medium" htmlFor="seo-title">
          SEO title
        </label>
        <input
          id="seo-title"
          name="seo-title"
          defaultValue={seo.title ?? ""}
          maxLength={150}
          placeholder={`${navTitle} — <site name>`}
          className="mt-1 w-full rounded-btn border border-black/10 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <p className="mt-1 text-xs text-muted">
          Browser-tab and search-result title, used verbatim. Leave blank to
          derive it from the nav title. The nav label itself stays “{navTitle}”.
        </p>

        <label className="mt-3 block text-sm font-medium" htmlFor="seo-description">
          Meta description
        </label>
        <textarea
          id="seo-description"
          name="seo-description"
          defaultValue={seo.description ?? ""}
          maxLength={300}
          rows={3}
          className="mt-1 w-full rounded-btn border border-black/10 px-3 py-2 text-sm outline-none focus:border-accent"
        />

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="seo-noindex"
            defaultChecked={seo.noindex ?? false}
            className="h-4 w-4 accent-accent"
          />
          Hide from search engines (noindex, drops out of the sitemap)
        </label>

        {state && !state.ok && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        {state?.ok && state.warning && (
          <p className="mt-3 text-sm text-amber-600" role="status">
            Saved, but: {state.warning}
          </p>
        )}
        {state?.ok && !state.warning && (
          <p className="mt-3 text-sm text-emerald-600" role="status">
            Saved.
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="mt-4 rounded-btn bg-accent px-4 py-2 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save SEO"}
        </button>
      </form>
    </details>
  );
}
