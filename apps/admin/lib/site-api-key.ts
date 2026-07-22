import { createHash, timingSafeEqual } from "node:crypto";
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@fable/db";

/**
 * Site API key verification, shared by the content route and the forms
 * ingest route. Keys are stored as SHA-256 hex; comparison is constant-time.
 * Unknown slug and bad key are indistinguishable to callers (both null) so
 * routes don't leak which site slugs exist.
 */

export function extractApiKey(request: Request): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey;
  const auth = request.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return null;
}

export function keyMatchesHash(apiKey: string, storedHash: string): boolean {
  const candidate = createHash("sha256").update(apiKey).digest();
  let stored: Buffer;
  try {
    stored = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

export interface KeyedSite {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  tokens: unknown;
  settings: unknown;
}

/** Resolve a site by slug iff the request carries its valid API key. */
export async function authenticateSiteRequest(
  supabase: SupabaseClient<Database>,
  request: Request,
  siteSlug: string,
): Promise<{ site: KeyedSite } | { site: null; status: 401 | 500 }> {
  const apiKey = extractApiKey(request);
  if (!apiKey) return { site: null, status: 401 };

  const { data: site, error } = await supabase
    .from("sites")
    .select("id, slug, name, domain, tokens, settings, api_key_hash")
    .eq("slug", siteSlug)
    .maybeSingle();
  if (error) return { site: null, status: 500 };
  if (!site || !keyMatchesHash(apiKey, site.api_key_hash)) {
    return { site: null, status: 401 };
  }

  const { api_key_hash: _apiKeyHash, ...publicSite } = site;
  return { site: publicSite };
}
