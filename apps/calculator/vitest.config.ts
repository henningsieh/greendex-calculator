/// <reference types="vitest" />

import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Direct runs can include suites sharing the seed database.
    fileParallelism: false,
    globals: true,
    experimental: {
      diagnostics: {
        environment: false,
      },
    },
    globalSetup: ["./src/__tests__/global-setup.ts"],
    setupFiles: ["./src/__tests__/setup.ts"],
    // Increase test timeout to 20 seconds for Next.js dev server startup
    testTimeout: 20_000,
    hookTimeout: 20_000,
    // Pure logic tests run in Node, where the environment is cheap. Component
    // tests stay on jsdom. Only the shared unit runner opts into worker reuse.
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          isolate: process.env.GREENDEX_VITEST_REUSE_WORKERS !== "1",
          include: ["src/**/*.{test,spec}.{ts,js}", "test/**/*.test.{ts,js}"],
          exclude: [
            ".next",
            "node_modules",
            "docs/**",
            "dist",
            "build",
            "public",
            "coverage",
            "storybook-static",
            "src/__tests__/e2e/**",
            "src/__tests__/merge/**",
            "src/lib/orpc/orpc.browser.test.ts",
            "src/__tests__/email-sender.test.ts",
          ],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          isolate: process.env.GREENDEX_VITEST_REUSE_WORKERS !== "1",
          include: [
            "src/**/*.{test,spec}.{tsx,jsx}",
            "test/**/*.test.{tsx,jsx}",
            "src/lib/orpc/orpc.browser.test.ts",
            "src/__tests__/email-sender.test.ts",
          ],
          exclude: [
            ".next",
            "node_modules",
            "docs/**",
            "dist",
            "build",
            "public",
            "coverage",
            "storybook-static",
            "src/__tests__/e2e/**",
            "src/__tests__/merge/**",
          ],
        },
      },
    ],
  },
  // Prevent Vite's file watcher from watching the large docs folder (improves watch performance)
  server: {
    watch: {
      ignored: [
        "**/.next/**",
        "**/node_modules/**",
        "**/docs/**",
        "**/dist/**",
        "**/build/**",
        "**/public/**",
        "**/coverage/**",
        "**/storybook-static/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
});
