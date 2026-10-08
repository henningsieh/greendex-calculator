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
  // NOTE (#246): the former `/docs/:path*.mdx` rewrite was removed — a
  // wildcard segment combined with a `.mdx` suffix never matches, so every
  // `.mdx` URL fell through to the locale middleware and 404ed. Markdown is
  // served directly at `/[lang]/llms.mdx/docs/[[...slug]]`.
} satisfies NextConfig;

export default withMDX(nextConfig);
