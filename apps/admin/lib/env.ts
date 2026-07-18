/**
 * Public Supabase env, safe for both server and client code. The literal
 * `process.env.NEXT_PUBLIC_*` references are inlined into client bundles at
 * build time — keep them written out in full here.
 */
export function supabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }
  return { url, anonKey };
}

/** Public URL for an object in a site's (public) media bucket. */
export function mediaPublicUrl(siteId: string, path: string): string {
  const { url } = supabasePublicEnv();
  return `${url}/storage/v1/object/public/media-${siteId}/${path}`;
}
