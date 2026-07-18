"use client";

import { useEffect, useRef, useState } from "react";
import { mediaPublicUrl } from "@/lib/env";
import { listMedia, uploadMediaFile, type MediaRow } from "@/lib/media";

/** Modal grid of the site's media with inline upload; used by every image
 * field and openable from anywhere that needs an image ref. */
export function MediaPicker({
  siteId,
  open,
  onClose,
  onSelect,
}: {
  siteId: string;
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaRow) => void;
}) {
  const [media, setMedia] = useState<MediaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    listMedia(siteId)
      .then((rows) => {
        if (!cancelled) setMedia(rows);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [open, siteId]);

  if (!open) return null;

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: MediaRow[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadMediaFile(siteId, file));
      }
      setMedia((prev) => [...uploaded, ...(prev ?? [])]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Choose an image"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-card bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3">
          <h2 className="text-sm font-semibold">Choose an image</h2>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void upload(event.target.files)}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
            className="ml-auto rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-btn px-2 py-1.5 text-xs text-muted hover:text-primary"
          >
            Close
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {error && (
            <p className="mb-3 rounded-btn bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {media === null && !error && (
            <p className="py-8 text-center text-sm text-muted">Loading…</p>
          )}
          {media?.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">
              No images yet — upload one above.
            </p>
          )}
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {(media ?? []).map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelect(row)}
                className="group overflow-hidden rounded-btn ring-1 ring-black/10 hover:ring-accent"
                title={row.alt ?? row.path}
              >
                {/* Thumbnails only; next/image is unnecessary here. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaPublicUrl(siteId, row.path)}
                  alt={row.alt ?? ""}
                  className="aspect-[4/3] w-full object-cover transition group-hover:scale-105"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
