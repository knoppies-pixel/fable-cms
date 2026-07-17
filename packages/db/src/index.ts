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
