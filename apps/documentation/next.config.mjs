import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig = {
  // See apps/calculator/next.config.ts: one root AGENTS.md, no app-level agent files.
  agentRules: false,
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
};

export default withMDX(nextConfig);
