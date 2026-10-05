import { execFileSync } from "node:child_process";
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
  const costTrackerPackage = JSON.parse(
    readFileSync(path.resolve("../../apps/cost-tracker/package.json"), "utf8"),
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
      "pnpm run db:migrate && dotenv -e apps/calculator/.env -- dotenv -e apps/documentation/.env -- dotenv -e apps/cost-tracker/.env -- node scripts/prepare-dev-ports.mjs",
    );
    expect(rootPackage.scripts.build).toBe("turbo run build --concurrency=1");
    expect(rootPackage.scripts.start).toBe("turbo run start");
  });

  it("loads Calculator's app-local environment for non-Next processes", () => {
    expect(calculatorPackage.scripts.dev).toContain(
      "dotenv -v NODE_ENV=development -e .env --",
    );
    expect(calculatorPackage.scripts.prebuild).toBe(
      "dotenv -e .env -- pnpm -w run db:migrate && dotenv -e .env -- pnpm run generate:sri && dotenv -e .env -- pnpm run check:sri",
    );
    expect(calculatorPackage.scripts.build).toBe("next build");
    expect(calculatorPackage.scripts.prestart).toContain("dotenv -e .env --");
    expect(calculatorPackage.scripts.start).toContain(
      "dotenv -v NODE_ENV=production -e .env --",
    );
    expect(calculatorPackage.scripts["auth:generate"]).toContain(
      "dotenv -e .env --",
    );
  });

  it("resolves dotenv-cli's dotenv command after installing workspace dependencies", () => {
    for (const app of ["calculator", "cost-tracker"]) {
      const cwd = path.resolve(`../../apps/${app}`);
      const output = execFileSync(
        "./node_modules/.bin/dotenv",
        [
          "-v",
          "NODE_ENV=development",
          "-e",
          ".env",
          "--",
          process.execPath,
          "-e",
          'process.stdout.write(process.env.NODE_ENV === "development" ? "ready" : "wrong")',
        ],
        { cwd, encoding: "utf8" },
      );
      expect(output).toBe("ready");
    }
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
    expect(documentationPackage.scripts.predev).toBe(
      "dotenv -e .env -- sh -c 'fuser -k \"$DOCUMENTATION_PORT/tcp\" || true'",
    );
    expect(costTrackerPackage.scripts.predev).toBe(
      "dotenv -e .env -- sh -c 'fuser -k \"$COST_TRACKER_PORT/tcp\" || true'",
    );
    expect(documentationPackage.scripts.start).toBe(
      "dotenv -v NODE_ENV=production -e .env -- sh -c 'next start --port \"$DOCUMENTATION_PORT\"'",
    );
  });

  it("migrates once before root dev and through existing per-app build hooks", () => {
    expect(rootPackage.scripts.predev).toMatch(/^pnpm run db:migrate && /);
    expect(rootPackage.scripts["db:migrate"]).toBe("turbo run db:migrate");
    for (const app of [calculatorPackage, costTrackerPackage]) {
      expect(app.scripts["db:migrate"]).toBeUndefined();
      expect(app.scripts.predev ?? "").not.toContain("db:migrate");
      expect(app.scripts.prebuild).toMatch(
        /^dotenv -e \.env -- pnpm -w run db:migrate(?: &&|$)/,
      );
      expect(app.scripts["start:prepare"]).toContain(
        "pnpm --filter @greendex/database run db:migrate",
      );
      expect(app.scripts["dev:serve"]).toBeUndefined();
    }
    for (const app of ["calculator", "cost-tracker"]) {
      const config = JSON.parse(
        readFileSync(path.resolve(`../../apps/${app}/turbo.json`), "utf8"),
      );
      expect(config.tasks.build.cache).toBe(false);
      expect(config.tasks.build.dependsOn ?? []).not.toContain("db:migrate");
      expect(config.tasks.dev.dependsOn ?? []).not.toContain("db:migrate");
    }
    expect(turboConfig.tasks["db:migrate"]).toMatchObject({ cache: false });
    expect(documentationPackage.scripts["db:migrate"]).toBeUndefined();
  });

  it("uses the same alphabetical script ordering in every workspace manifest", () => {
    for (const workspace of [
      ".",
      "apps/calculator",
      "apps/cost-tracker",
      "apps/documentation",
      "packages/auth",
      "packages/config",
      "packages/database",
      "packages/email",
      "packages/i18n",
    ]) {
      const manifest = JSON.parse(
        readFileSync(path.resolve("../..", workspace, "package.json"), "utf8"),
      );
      expect(manifest.scripts).toBeTypeOf("object");
      expect(Array.isArray(manifest.scripts)).toBe(false);
      for (const command of Object.values(manifest.scripts)) {
        expect(command).toBeTypeOf("string");
      }
      const names = Object.keys(manifest.scripts);
      expect(names).toEqual([...names].sort());
    }
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
    const costTrackerTurboConfig = JSON.parse(
      readFileSync(path.resolve("../../apps/cost-tracker/turbo.json"), "utf8"),
    );
    expect(costTrackerTurboConfig.tasks.dev.env).toContain("DATABASE_URL");
  });

  it("does not load dotenv inside Calculator source modules", () => {
    expect(nextConfig).not.toMatch(
      /(?:from\s+|import\s+|require\s*\()\s*["']dotenv(?:\/config)?["']/,
    );
    expect(calculatorPackage.scripts["dev:socket"]).not.toContain("dotenv");
  });
});
