import type { NextConfig } from "next";

// Media URLs in the content API payload point at this Supabase project's
// public Storage; next/image must allowlist that origin. Defaults to the
// local stack so `pnpm dev` works out of the box.
const supabaseUrl = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
);
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
