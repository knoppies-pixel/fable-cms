import { cache } from "react";

/**
 * Per-request media lookup. The page loader fetches the site's media rows
 * from the content API and calls registerMedia() before rendering sections;
 * CmsImage resolves refs from here. React's cache() scopes the map to the
 * current server render, so sections stay presentational (no fetching) while
 * image fields in props stay small ({ mediaId, alt }).
 */
export interface MediaRecord {
  id: string;
  /** Absolute public URL (Supabase Storage). */
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

const mediaStore = cache((): Map<string, MediaRecord> => new Map());

export function registerMedia(records: MediaRecord[]): void {
  const store = mediaStore();
  for (const record of records) store.set(record.id, record);
}

export function resolveMedia(mediaId: string): MediaRecord | null {
  return mediaStore().get(mediaId) ?? null;
}
