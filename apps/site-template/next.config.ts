import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@fable/sections", "@fable/db"],
};

export default nextConfig;
