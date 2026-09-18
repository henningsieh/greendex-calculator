import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig = {
  // This repository keeps a single root AGENTS.md: Next.js must not write its
  // agent-rules block into this project directory.
  agentRules: false,
  typedRoutes: true,
  reactCompiler: true,
  devIndicators: {
    position: "top-right",
  },

  // allow image hosting from external domains
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/a/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/u/**",
      },
      {
        protocol: "https",
        hostname: "ik.imagekit.io",
        pathname: "/lrigu76hy/**",
      },
      {
        protocol: "https",
        hostname: "html.tailus.io",
        pathname: "/blocks/**",
      },
      {
        protocol: "https",
        hostname: "greendex.world",
        pathname: "/wp-content/**",
      },
    ],
  },

  experimental: {
    // Enable filesystem caching for `next dev`
    turbopackFileSystemCacheForDev: true,
    // Enable filesystem caching for `next build`
    turbopackFileSystemCacheForBuild: true,
  },
} satisfies NextConfig;

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

export default withNextIntl(nextConfig);
