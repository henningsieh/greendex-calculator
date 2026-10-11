import type { NextConfig } from "next";

const nextConfig = {
  agentRules: false,
  cacheComponents: true,
  // Retain existing link-prefetch behavior during this loading-only migration.
  partialPrefetching: false,
  reactCompiler: true,
  experimental: {
    requestInsights: true,
    turbopackFileSystemCacheForBuild: true,
    turbopackFileSystemCacheForDev: true,
  },
} satisfies NextConfig;

export default nextConfig;
