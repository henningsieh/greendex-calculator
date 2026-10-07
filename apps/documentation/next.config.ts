import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig = {
  // See apps/calculator/next.config.ts: one root AGENTS.md, no app-level agent files.
  agentRules: false,
  cacheComponents: true,
  partialPrefetching: true,
  typedRoutes: true,
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/docs/:path*.mdx",
        destination: "/llms.mdx/docs/:path*",
      },
    ];
  },
} satisfies NextConfig;

export default withMDX(nextConfig);
