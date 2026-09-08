import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

type PackageManifest = {
  scripts: Record<string, string>;
  dependencies?: Record<string, string>;
};

describe("environment entrypoints", () => {
  const content = readFileSync(path.resolve("src/socket-server.ts"), "utf8");
  const rootPackage = JSON.parse(
    readFileSync(path.resolve("../../package.json"), "utf8"),
  ) as PackageManifest;
  const nextConfig = readFileSync(path.resolve("next.config.ts"), "utf8");
  const calculatorPackage = JSON.parse(
    readFileSync(path.resolve("package.json"), "utf8"),
  ) as PackageManifest;
  const documentationPackage = JSON.parse(
    readFileSync(path.resolve("../../apps/documentation/package.json"), "utf8"),
  ) as PackageManifest;
  const turboConfig = JSON.parse(
    readFileSync(path.resolve("../../turbo.json"), "utf8"),
  ) as {
    tasks: Record<string, { env?: string[] }>;
  };
  const calculatorTurboConfig = JSON.parse(
    readFileSync(path.resolve("turbo.json"), "utf8"),
  ) as {
    tasks: Record<string, { env?: string[] }>;
  };

  it("does not load dotenv from a hardcoded .env path", () => {
    const importLine = content
      .split("\n")
      .findIndex((line) => line.trim() === 'import { config } from "dotenv";');
    expect(importLine).toBe(-1);
  });

  it("reads environment variables via the shared @/env module", () => {
    expect(content).toMatch(/await import\("@\/env"\)/);
  });

  it("delegates root lifecycle commands directly to Turbo", () => {
    expect(rootPackage.scripts.dev).toBe("turbo run dev");
    expect(rootPackage.scripts.predev).toBe(
      "dotenv -e apps/calculator/.env -- dotenv -e apps/documentation/.env -- node scripts/prepare-dev-ports.mjs",
    );
    expect(rootPackage.scripts.build).toBe("turbo run build");
    expect(rootPackage.scripts.start).toBe("turbo run start");
  });

  it("loads Calculator's app-local environment for non-Next processes", () => {
    expect(calculatorPackage.scripts.dev).toContain(
      "dotenv -v NODE_ENV=development -e .env --",
    );
    expect(calculatorPackage.scripts.prebuild).toContain("dotenv -e .env --");
    expect(calculatorPackage.scripts.build).toBe("next build");
    expect(calculatorPackage.scripts.prestart).toContain("dotenv -e .env --");
    expect(calculatorPackage.scripts.start).toContain(
      "dotenv -v NODE_ENV=production -e .env --",
    );
    expect(calculatorPackage.scripts["auth:generate"]).toContain(
      "dotenv -e .env --",
    );
  });

  it("configures every service port from the environment", () => {
    expect(calculatorPackage.scripts["dev:next"]).toBe("next dev --port $PORT");
    expect(calculatorPackage.scripts.prestart).toBe(
      "dotenv -e .env -- pnpm run start:prepare",
    );
    expect(calculatorPackage.scripts["start:prepare"]).toContain(
      'pnpm dlx kill-port "$PORT" "$SOCKET_PORT"',
    );
    expect(calculatorPackage.scripts.start).toBe(
      "dotenv -v NODE_ENV=production -e .env -- pnpm run serve",
    );
    expect(calculatorPackage.scripts.serve).toContain("next start --port $PORT");
    expect(calculatorPackage.scripts["test:e2e:report"]).toBe(
      "pnpm dlx kill-port 9323 || true && pnpm exec playwright show-report src/__tests__/e2e/.playwright/report",
    );
    expect(documentationPackage.scripts.dev).toBe(
      "dotenv -v NODE_ENV=development -e .env -- sh -c 'next dev --port \"$DOCUMENTATION_PORT\"'",
    );
    expect(documentationPackage.scripts.start).toBe(
      "dotenv -v NODE_ENV=production -e .env -- sh -c 'next start --port \"$DOCUMENTATION_PORT\"'",
    );
  });

  it("keeps runtime CLI dependencies available to the production start commands", () => {
    expect(rootPackage.dependencies).toMatchObject({
      "dotenv-cli": expect.any(String),
      turbo: expect.any(String),
    });
    expect(calculatorPackage.dependencies).toMatchObject({
      concurrently: expect.any(String),
      "dotenv-cli": expect.any(String),
      tsx: expect.any(String),
    });
  });

  it("forwards only Calculator's required environment variables to its dev task", () => {
    expect(turboConfig.tasks.dev.env).toBeUndefined();
    expect(calculatorTurboConfig.tasks.dev.env).toEqual([
      "NEXT_PUBLIC_BASE_URL",
      "NEXT_PUBLIC_SOCKET_URL",
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "DISCORD_CLIENT_ID",
      "DISCORD_CLIENT_SECRET",
      "GITHUB_CLIENT_ID",
      "GITHUB_CLIENT_SECRET",
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_SENDER",
      "SMTP_USERNAME",
      "SMTP_PASSWORD",
      "SMTP_SECURE",
      "NODE_ENV",
      "PORT",
      "ORPC_DEV_DELAY_MS",
      "SOCKET_PORT",
    ]);
    expect(turboConfig.tasks["db:migrate"].env).toEqual(["DATABASE_URL"]);
  });

  it("does not load dotenv inside Calculator source modules", () => {
    expect(nextConfig).not.toMatch(
      /(?:from\s+|import\s+|require\s*\()\s*["']dotenv(?:\/config)?["']/,
    );
    expect(calculatorPackage.scripts["dev:socket"]).not.toContain("dotenv");
  });
});
