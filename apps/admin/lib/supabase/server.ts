import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@fable/db";
import type { User } from "@supabase/supabase-js";
import { supabasePublicEnv } from "../env";

/**
 * RLS-scoped client bound to the request's auth cookies. All admin reads and
 * writes go through this (or the browser twin) so Postgres policies — not
 * app code — are what scope users to their sites. The service-role client
 * stays reserved for the content API route.
 */
export async function serverSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();
  const { url, anonKey } = supabasePublicEnv();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by proxy.ts, so this is safe to drop.
        }
      },
    },
  });
}

/** For pages/actions that require a signed-in user. Redirects to /login. */
export async function requireUser(): Promise<{
  supabase: SupabaseClient<Database>;
  user: User;
}> {
  const supabase = await serverSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
