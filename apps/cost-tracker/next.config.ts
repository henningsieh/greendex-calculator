import type { NextConfig } from "next";

const nextConfig = {
  agentRules: false,
  reactCompiler: true,
  experimental: {
    requestInsights: true,
    turbopackFileSystemCacheForBuild: true,
    turbopackFileSystemCacheForDev: true,
  },
} satisfies NextConfig;

export default nextConfig;
