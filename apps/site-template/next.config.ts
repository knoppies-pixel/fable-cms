import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fable/sections", "@fable/db"],
  images: {
    remotePatterns: [
      // Local Supabase Storage
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
      // Hosted Supabase Storage
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
};

export default nextConfig;
