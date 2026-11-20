/// <reference types="vitest" />

import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
      "@greendex/cost-tracker": resolve(import.meta.dirname, "./src"),
      "#repo": resolve(import.meta.dirname, "../.."),
      "#cost-tracker-scripts": resolve(import.meta.dirname, "./scripts"),
    },
  },
  test: {
    // Transform next-intl's extensionless Next.js imports for Node-based proxy tests.
    server: { deps: { inline: ["next-intl"] } },
    globalSetup: ["./src/__tests__/global-setup.ts"],
    setupFiles: ["./src/__tests__/setup.ts"],
    // Pure logic tests run in Node, where the environment is cheap. Component
    // tests stay on jsdom. The browser transport test is the one `.ts` file
    // that needs a DOM, so it belongs to the jsdom project explicitly.
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.{test,spec}.ts", "scripts/**/*.test.ts"],
          exclude: ["src/__tests__/e2e/**", "src/lib/orpc/orpc.browser.test.ts"],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "src/**/*.{test,spec}.tsx",
            "src/lib/orpc/orpc.browser.test.ts",
          ],
          exclude: ["src/__tests__/e2e/**"],
        },
      },
    ],
  },
});
