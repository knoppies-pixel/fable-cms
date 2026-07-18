"use client";

import { useEffect, useRef, useState } from "react";
import { mediaPublicUrl } from "@/lib/env";
import {
  deleteMedia,
  listMedia,
  updateMediaAlt,
  uploadMediaFile,
  type MediaRow,
} from "@/lib/media";

export function MediaLibrary({ siteId }: { siteId: string }) {
  const [media, setMedia] = useState<MediaRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
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
  }, [siteId]);

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

  const remove = async (row: MediaRow) => {
    if (!window.confirm("Delete this image? Sections using it will show nothing.")) {
      return;
    }
    setError(null);
    try {
      await deleteMedia(siteId, row);
      setMedia((prev) => (prev ?? []).filter((m) => m.id !== row.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Media library
        </h2>
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
          className="ml-auto rounded-btn bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast hover:opacity-90 disabled:opacity-60"
        >
          {uploading ? "Uploading…" : "Upload images"}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-btn bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {media === null && !error && (
        <p className="py-10 text-center text-sm text-muted">Loading…</p>
      )}
      {media?.length === 0 && (
        <p className="rounded-card bg-surface py-10 text-center text-sm text-muted shadow-sm ring-1 ring-black/5">
          No images yet — upload some to use them in sections.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(media ?? []).map((row) => (
          <MediaCard key={row.id} siteId={siteId} row={row} onDelete={remove} />
        ))}
      </div>
    </div>
  );
}

function MediaCard({
  siteId,
  row,
  onDelete,
}: {
  siteId: string;
  row: MediaRow;
  onDelete: (row: MediaRow) => void;
}) {
  const [alt, setAlt] = useState(row.alt ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const savedAlt = useRef(row.alt ?? "");

  const saveAlt = async () => {
    if (alt === savedAlt.current) return;
    setState("saving");
    try {
      await updateMediaAlt(siteId, row.id, alt);
      savedAlt.current = alt;
      setState("saved");
      setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
    }
  };

  return (
    <figure className="overflow-hidden rounded-card bg-surface shadow-sm ring-1 ring-black/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaPublicUrl(siteId, row.path)}
        alt={row.alt ?? ""}
        className="aspect-[4/3] w-full bg-surface-alt object-cover"
        loading="lazy"
      />
      <figcaption className="p-2">
        <input
          type="text"
          value={alt}
          placeholder="Alt text"
          aria-label={`Alt text for ${row.path}`}
          onChange={(event) => setAlt(event.target.value)}
          onBlur={() => void saveAlt()}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="w-full rounded-btn border border-black/10 px-2 py-1 text-xs outline-none focus:border-accent"
        />
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
          <span className="truncate" title={row.path}>
            {row.width && row.height ? `${row.width}×${row.height} · ` : ""}
            {row.path}
          </span>
          <span>
            {state === "saving" && "Saving…"}
            {state === "saved" && <span className="text-emerald-700">Saved ✓</span>}
            {state === "error" && <span className="text-red-600">Save failed</span>}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onDelete(row)}
          className="mt-1 rounded-btn px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </figcaption>
    </figure>
  );
}
