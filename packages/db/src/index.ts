import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type { Database };

export interface SupabaseEnv {
  url: string;
  anonKey: string;
}

/** Create a typed Supabase client. Callers pass env explicitly — no implicit process.env reads here. */
export function createSupabaseClient(env: SupabaseEnv): SupabaseClient<Database> {
  return createClient<Database>(env.url, env.anonKey);
}

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
