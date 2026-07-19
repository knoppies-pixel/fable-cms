import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@fable/db";

/**
 * Per-site delivery config, stored in `sites.settings.delivery`. It tells the
 * multi-tenant admin where each deployed site lives and how to talk to its
 * preview/revalidation endpoints. Seeded for demo-site; written by
 * create-site.ts for real sites (Phase 5). Absent config degrades gracefully:
 * no preview pane, no revalidation ping.
 */
const deliverySchema = z.object({
  siteUrl: z.url(),
  previewSecret: z.string().min(1).optional(),
  revalidateSecret: z.string().min(1).optional(),
});

export type SiteDelivery = z.infer<typeof deliverySchema>;

export async function getSiteDelivery(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<SiteDelivery | null> {
  const { data } = await supabase
    .from("sites")
    .select("settings")
    .eq("id", siteId)
    .maybeSingle();
  const settings = data?.settings as { delivery?: unknown } | null;
  const parsed = deliverySchema.safeParse(settings?.delivery);
  return parsed.success ? parsed.data : null;
}

/** Draft-mode preview URL for a page, or null when preview isn't configured. */
export function sitePreviewUrl(
  delivery: SiteDelivery | null,
  pageSlug: string,
): string | null {
  if (!delivery?.previewSecret) return null;
  const url = new URL("/api/draft", delivery.siteUrl);
  url.searchParams.set("secret", delivery.previewSecret);
  url.searchParams.set("path", pageSlug);
  return url.toString();
}

/**
 * Ping the site's /api/revalidate so a publish/save goes live within seconds
 * (spec §6). Never throws: the row is already written, so a failed ping is a
 * warning for the UI, not an error. Returns the warning, if any.
 */
export async function revalidateSite(
  supabase: SupabaseClient<Database>,
  siteId: string,
): Promise<string | undefined> {
  const delivery = await getSiteDelivery(supabase, siteId);
  if (!delivery?.revalidateSecret) return undefined; // not deployed yet
  const url = new URL("/api/revalidate", delivery.siteUrl);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-revalidate-secret": delivery.revalidateSecret },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return `Saved, but the live site refused revalidation (HTTP ${response.status}).`;
    }
    return undefined;
  } catch {
    return "Saved, but the live site could not be reached to revalidate — changes appear after its next scheduled refresh.";
  }
}
