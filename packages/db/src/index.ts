import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "./types";

export type { Database, Json };

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/** Create a typed Supabase client. Callers pass env explicitly — no implicit process.env reads here. */
export function createSupabaseClient(env: SupabaseEnv): SupabaseClient<Database> {
  return createClient<Database>(env.url, env.anonKey);
}

/**
 * Columns of `sites` readable by authenticated admin-app users.
 * `sites.api_key_hash` is hidden via column-level grants (migration
 * 20260718110000), so `select('*')` on sites fails for authenticated —
 * and depending on client handling it can surface as an empty result
 * rather than a loud error. Always select sites through this list.
 */
export const siteSummaryColumns =
  "id, slug, name, domain, tokens, settings, created_at" as const;

export interface ServiceRoleEnv {
  url: string;
  serviceRoleKey: string;
}

/** Server-only client that bypasses RLS. Never import from code shipped to the browser. */
export function createServiceRoleClient(env: ServiceRoleEnv): SupabaseClient<Database> {
  return createClient<Database>(env.url, env.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
