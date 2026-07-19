"use client";

/**
 * Live preview iframe beside the section form. The src is the site's
 * /api/draft URL, so every load (re-)enables draft mode and lands on the
 * edited page with drafts + error cards visible. `reloadKey` remounts the
 * iframe after each successful save.
 */
export function PreviewPane({
  src,
  reloadKey,
  onRefresh,
}: {
  src: string | null;
  reloadKey: number;
  onRefresh: () => void;
}) {
  if (!src) {
    return (
      <div className="rounded-card bg-surface p-6 text-sm text-muted shadow-sm ring-1 ring-black/5">
        <p className="font-medium text-primary">Live preview not configured</p>
        <p className="mt-2">
          Set this site&apos;s <code>settings.delivery</code> (siteUrl +
          previewSecret) so the admin can embed the site&apos;s draft-mode
          preview here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[32rem] flex-col overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-3 border-b border-black/5 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">
          Live preview
        </span>
        <span className="text-xs text-muted">drafts visible</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-btn px-2 py-1 text-xs text-muted hover:bg-surface-alt hover:text-primary"
          >
            Refresh
          </button>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="rounded-btn px-2 py-1 text-xs text-muted hover:bg-surface-alt hover:text-primary"
          >
            Open ↗
          </a>
        </div>
      </div>
      <iframe
        key={reloadKey}
        src={src}
        title="Site preview"
        className="min-h-0 w-full flex-1 bg-white"
      />
    </div>
  );
}
