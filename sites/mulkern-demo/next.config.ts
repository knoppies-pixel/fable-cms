import type { NextConfig } from "next";

// Media URLs in the content API payload point at this Supabase project's
// public Storage; next/image must allowlist that origin. A production build
// that can't derive it would ship with every image silently 400ing, so fail
// the build/boot loudly instead. Development falls back to the local stack
// so `pnpm dev` works out of the box.
const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Snapshot mode (CONTENT_SNAPSHOT_FILE) serves media from public/cms-media —
// relative URLs, no remote host — so the Storage origin is not required.
if (
  !rawSupabaseUrl &&
  !process.env.CONTENT_SNAPSHOT_FILE &&
  process.env.NODE_ENV === "production"
) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is required in production: next/image cannot " +
      "allowlist the media host without it, which breaks every image on the site.",
  );
}
let supabaseUrl: URL;
try {
  supabaseUrl = new URL(rawSupabaseUrl ?? "http://127.0.0.1:54321");
} catch {
  throw new Error(
    `NEXT_PUBLIC_SUPABASE_URL is not a valid URL: "${rawSupabaseUrl}"`,
  );
}
const isLocalSupabase = ["127.0.0.1", "localhost", "[::1]"].includes(
  supabaseUrl.hostname,
);

const nextConfig: NextConfig = {
  transpilePackages: ["@fable/sections", "@fable/db"],
  images: {
    remotePatterns: [
      {
        protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
        hostname: supabaseUrl.hostname,
        ...(supabaseUrl.port ? { port: supabaseUrl.port } : {}),
      },
    ],
    // The optimizer blocks local/private IPs (SSRF protection) even when
    // allowlisted; opt out only when pointing at the local Supabase stack.
    ...(isLocalSupabase ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
