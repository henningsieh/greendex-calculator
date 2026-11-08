import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  // Typed routes are temporarily off: pages live only under app/[locale], and
  // Next's generated union knows only /[locale]/... URLs. The next-intl
  // pathnames migration restores typed hrefs without stub page files.
  typedRoutes: false,
  experimental: {
    requestInsights: true,
    turbopackFileSystemCacheForBuild: true,
    turbopackFileSystemCacheForDev: true,
  },
} satisfies NextConfig;

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

export default withNextIntl(nextConfig);
