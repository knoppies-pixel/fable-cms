import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@fable/db";
import { supabasePublicEnv } from "../env";

/**
 * RLS-scoped client for client components (media uploads, media browsing).
 * `createBrowserClient` returns a per-page singleton internally.
 */
export function browserSupabase(): SupabaseClient<Database> {
  const { url, anonKey } = supabasePublicEnv();
  return createBrowserClient<Database>(url, anonKey);
}
