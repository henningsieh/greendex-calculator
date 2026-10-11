import type { NextConfig } from "next";

const nextConfig = {
  agentRules: false,
  cacheComponents: true,
  // Prefetch shared static shells; private and URL-dependent data streams per request.
  partialPrefetching: true,
  reactCompiler: true,
  experimental: {
    requestInsights: true,
    turbopackFileSystemCacheForBuild: true,
    turbopackFileSystemCacheForDev: true,
  },
} satisfies NextConfig;

export default nextConfig;
