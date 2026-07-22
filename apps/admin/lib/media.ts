import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@fable/db";
import { logActivity } from "./activity";
import { browserSupabase } from "./supabase/browser";

/** Client-side media helpers. All calls run as the signed-in user: storage
 * object policies + media-table RLS scope them to the user's sites. */

/** Signed-in user for activity entries. The insert policy re-checks the id
 * server-side (actor_id must equal auth.uid()), so this is display-only trust. */
async function sessionActor(
  supabase: SupabaseClient<Database>,
): Promise<{ id: string; email?: string | null } | null> {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;
  return user ? { id: user.id, email: user.email } : null;
}

async function logMediaActivity(
  supabase: SupabaseClient<Database>,
  siteId: string,
  action: string,
  mediaId: string | null,
  summary: string,
): Promise<void> {
  const actor = await sessionActor(supabase);
  if (!actor) return;
  await logActivity(supabase, actor, {
    siteId,
    action,
    entityType: "media",
    entityId: mediaId,
    summary,
  });
}

export interface MediaRow {
  id: string;
  path: string;
  alt: string | null;
  width: number | null;
  height: number | null;
}

export const MEDIA_COLUMNS = "id, path, alt, width, height";

export async function listMedia(siteId: string): Promise<MediaRow[]> {
  const supabase = browserSupabase();
  const { data, error } = await supabase
    .from("media")
    .select(MEDIA_COLUMNS)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load media: ${error.message}`);
  return data ?? [];
}

async function imageDimensions(
  file: File,
): Promise<{ width: number | null; height: number | null }> {
  try {
    const bitmap = await createImageBitmap(file);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return { width: null, height: null }; // e.g. SVG in some browsers
  }
}

export async function uploadMediaFile(
  siteId: string,
  file: File,
): Promise<MediaRow> {
  const supabase = browserSupabase();
  const { width, height } = await imageDimensions(file);

  const safeName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const path = `${crypto.randomUUID().slice(0, 8)}-${safeName || "upload"}`;

  const { error: uploadError } = await supabase.storage
    .from(`media-${siteId}`)
    .upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data, error } = await supabase
    .from("media")
    .insert({ site_id: siteId, path, alt: "", width, height })
    .select(MEDIA_COLUMNS)
    .single();
  if (error) {
    // Roll the object back so storage doesn't accumulate orphans.
    await supabase.storage.from(`media-${siteId}`).remove([path]);
    throw new Error(`Could not save the media record: ${error.message}`);
  }
  await logMediaActivity(supabase, siteId, "media.upload", data.id, `Uploaded “${path}”`);
  return data;
}

export async function updateMediaAlt(
  siteId: string,
  mediaId: string,
  alt: string,
): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await supabase
    .from("media")
    .update({ alt })
    .eq("id", mediaId)
    .eq("site_id", siteId);
  if (error) throw new Error(`Could not save alt text: ${error.message}`);
  await logMediaActivity(supabase, siteId, "media.alt", mediaId, "Edited image alt text");
}

export async function deleteMedia(
  siteId: string,
  media: Pick<MediaRow, "id" | "path">,
): Promise<void> {
  const supabase = browserSupabase();
  const { error } = await supabase
    .from("media")
    .delete()
    .eq("id", media.id)
    .eq("site_id", siteId);
  if (error) throw new Error(`Could not delete media: ${error.message}`);
  // Best effort: the row is authoritative; a stray object hurts nothing.
  await supabase.storage.from(`media-${siteId}`).remove([media.path]);
  await logMediaActivity(supabase, siteId, "media.delete", media.id, `Deleted “${media.path}”`);
}

export async function getMediaRow(mediaId: string): Promise<MediaRow | null> {
  const supabase = browserSupabase();
  const { data } = await supabase
    .from("media")
    .select(MEDIA_COLUMNS)
    .eq("id", mediaId)
    .maybeSingle();
  return data ?? null;
}
