import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@fable/db";

/**
 * Append an event to the site's activity log. Best-effort by design: the
 * content write has already succeeded, so a logging failure must never fail
 * the user's action — it is reported to the console (and Sentry) instead.
 *
 * Works with both the server and browser RLS clients; the insert policy
 * requires actor_id = auth.uid(), so events can't be forged for other users.
 */
export interface ActivityEvent {
  siteId: string;
  action: string;
  entityType: "site" | "page" | "section" | "media" | "submission";
  entityId?: string | null;
  summary: string;
  detail?: Json;
}

export async function logActivity(
  supabase: SupabaseClient<Database>,
  actor: { id: string; email?: string | null },
  event: ActivityEvent,
): Promise<void> {
  const { error } = await supabase.from("activity_log").insert({
    site_id: event.siteId,
    actor_id: actor.id,
    actor_email: actor.email ?? null,
    action: event.action,
    entity_type: event.entityType,
    entity_id: event.entityId ?? null,
    summary: event.summary,
    detail: event.detail ?? {},
  });
  if (error) {
    console.error(`activity_log insert failed (${event.action}): ${error.message}`);
  }
}
