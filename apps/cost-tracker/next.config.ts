import type { NextConfig } from "next";

const testRunId = process.env.TEST_RUN_ID;
if (testRunId && !/^[a-f0-9]{32}$/.test(testRunId)) {
  throw new Error("Invalid managed test run identity.");
}

const nextConfig = {
  ...(process.env.MANAGED_WORKSPACE_ROOT
    ? { turbopack: { root: process.env.MANAGED_WORKSPACE_ROOT } }
    : {}),
  // #273: managed runs never share build output or rewrite the dev tsconfig.
  ...(testRunId
    ? {
        distDir: `.next/test-runs/${testRunId}`,
        typescript: { tsconfigPath: `.tsconfig-test-${testRunId}.json` },
      }
    : {}),
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
