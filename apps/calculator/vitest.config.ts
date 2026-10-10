/// <reference types="vitest" />

import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    // Isolated workers per file: auth mocks and module singletons must not
    // leak across files (flaky UNAUTHORIZED/FORBIDDEN in full runs).
    // Costs extra jsdom startup per file, but keeps repeated runs green.
    isolate: true,
    environment: "jsdom",
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
    // Only include explicit test patterns.
    include: [
      "src/**/*.{test,spec}.{ts,tsx,js,jsx}",
      "test/**/*.test.{ts,tsx,js,jsx}",
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
      "src/__tests__/e2e/**", // Exclude Playwright e2e tests
      "src/__tests__/merge/**", // Explicit two-app Playwright proof
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
