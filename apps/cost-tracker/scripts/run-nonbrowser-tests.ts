/* eslint-disable import/no-relative-parent-imports -- Repository test orchestration, not app runtime. */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { globSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import * as schema from "@greendex/database/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { canonicalSeedVersion } from "../../../scripts/canonical-seed-version";
import {
  readLocalEnvironment,
  runManagedCommand,
  startManagedAppServers,
  type ManagedAppServers,
} from "../../../scripts/managed-app-servers";
import { nonbrowserTestEvidence } from "../../../scripts/nonbrowser-test-evidence";
import {
  fullRunPassed,
  runTestGroups,
  type TestGroup,
} from "../../../scripts/nonbrowser-test-groups";
import { seedDatabase } from "../../calculator/scripts/seed";
import {
  createIsolatedRunDatabase,
  disposeIsolatedRunDatabase,
  IsolatedRunCreationError,
  type IsolatedRunHandle,
} from "../../calculator/src/__tests__/helpers/isolated-run-database";
import { verifyEmailWorkflows } from "./verify-email-workflows";

const root = resolve(import.meta.dirname, "../../..");
const started = Date.now();
const interruption = new AbortController();
const interrupt = () => interruption.abort();
process.once("SIGINT", interrupt);
process.once("SIGTERM", interrupt);
let handle: IsolatedRunHandle | undefined;
let databaseCreation:
  | { databaseName: string; rollback: "disposed" | "failed" }
  | undefined;
let servers: ManagedAppServers | undefined;
let seed: Awaited<ReturnType<typeof seedDatabase>> | undefined;
let environments: Record<"calculator" | "cost-tracker", Record<string, string>>;
let pool: Pool | undefined;
const cleanup = {
  servers: "not-started",
  database: "not-created",
  pool: "not-opened",
};
const environment = (): NodeJS.ProcessEnv => ({
  ...process.env,
  DATABASE_URL:
    handle?.databaseUrl ?? "postgres://127.0.0.1:1/blocked_test_prerequisite",
  TEST_RUN_ID: handle?.runId,
  GREENDEX_TEST_SERVICE_DATABASE_URL: handle?.baseDatabaseUrl,
  ...servers?.environment,
  GREENDEX_AGGREGATE_TEST_RUN: "true",
});
const command = (cwd: string, args: string[], env = environment()) =>
  runManagedCommand("pnpm", args, {
    cwd: resolve(root, cwd),
    env,
    timeoutMs: 900_000,
    signal: interruption.signal,
  });
const testEvidence: ReturnType<typeof nonbrowserTestEvidence>[] = [];
const vitest = (cwd: string, args: string[] = [], timeoutMs = 900_000) =>
  runManagedCommand(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--no-file-parallelism",
      `--reporter=${resolve(root, "scripts/nonbrowser-json-reporter.ts")}`,
      ...args,
    ],
    {
      cwd: resolve(root, cwd),
      env: environment(),
      timeoutMs,
      signal: interruption.signal,
      inspectOutput: (output) => {
        const start = output.indexOf('{"numTotalTestSuites"');
        if (start < 0) throw new Error("Missing valid test evidence.");
        let skipped = false;
        try {
          const data = JSON.parse(output.slice(start));
          const evidence = nonbrowserTestEvidence(data, cwd, root);
          testEvidence.push(evidence);
          console.log(JSON.stringify(evidence));
          skipped = data.numPendingTests > 0 || data.numTodoTests > 0;
        } catch {
          throw new Error("Missing valid test evidence.");
        }
        if (skipped) throw new Error("Required tests were skipped.");
      },
    },
  );
const calculatorExceptions = [
  "src/__tests__/migration-chain.integration.test.ts",
  "src/__tests__/project-coordinator-role-migration.integration.test.ts",
  "src/__tests__/host-project-assignment-migration.integration.test.ts",
  "src/__tests__/development-seed.integration.test.ts",
  "src/__tests__/project-partnership-foundation-migration.integration.test.ts",
  "src/__tests__/project-shared-travel-legs-migration.integration.test.ts",
];
const inventory: Record<string, { pure: string[]; live: string[] }> = {};
for (const app of ["calculator", "cost-tracker"]) {
  const cwd = resolve(root, "apps", app);
  const files = globSync(
    ["src/**/*.{test,spec}.{ts,tsx,js,jsx}", "test/**/*.test.{ts,tsx,js,jsx}"],
    { cwd },
  )
    .filter(
      (file) =>
        !file.includes("/__tests__/e2e/") &&
        !file.includes("/__tests__/merge/") &&
        !(app === "calculator" && calculatorExceptions.includes(file)),
    )
    .sort();
  const pure: string[] = [];
  const live: string[] = [];
  for (const file of files) {
    const source = await readFile(resolve(cwd, file), "utf8");
    // Conservative prerequisites: procedure/router tests may reach persistence transitively.
    const needsServices =
      /\.integration\.|openapi-(?:http|rest)|db-connection/.test(file) ||
      /@greendex\/database|from ["']pg["']|from ["'][^"']*(?:router|procedures|http-client)[^"']*["']/.test(
        source,
      );
    (needsServices ? live : pure).push(file);
  }
  inventory[app] = { pure, live };
}
const groups: TestGroup[] = [
  {
    name: "repository",
    prerequisites: [],
    run: async () => {
      await vitest(".", ["scripts"]);
      await command(".", ["exec", "tsx", "scripts/check-agent-instructions.ts"]);
      await command(".", ["run", "check:cost-tracker-persistence-seam"]);
    },
  },
  ...["auth", "email", "database", "config", "i18n"].map((name) => ({
    name: `package/${name}`,
    prerequisites: [],
    run: () => vitest(`packages/${name}`, ["--passWithNoTests"]),
  })),
  ...["calculator", "cost-tracker"].map((app) => ({
    name: `${app}/pure`,
    prerequisites: [],
    run: () => vitest(`apps/${app}`, inventory[app].pure, 1_800_000),
  })),
  {
    name: "database/create",
    prerequisites: [],
    run: async () => {
      const local = await readLocalEnvironment(
        resolve(root, "packages/database/.env"),
      );
      try {
        handle = await createIsolatedRunDatabase({
          baseDatabaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL,
          prefix: "nonbrowser",
        });
        cleanup.database = "pending";
      } catch (error) {
        if (error instanceof IsolatedRunCreationError) {
          databaseCreation = {
            databaseName: error.handle.databaseName,
            rollback: error.rollback,
          };
          cleanup.database = error.rollback;
          if (error.rollback === "failed") handle = error.handle;
        }
        throw error;
      }
    },
  },
  {
    name: "database/migrate",
    prerequisites: ["database/create"],
    run: () => command("packages/database", ["run", "db:migrate"]),
  },
  {
    name: "database/seed",
    prerequisites: ["database/migrate"],
    run: async () => {
      if (!handle) throw new Error("Missing run database.");
      pool = new Pool({
        connectionString: handle.databaseUrl,
        max: 1,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 30_000,
      });
      cleanup.pool = "pending";
      const originalLog = console.log;
      try {
        console.log = () => {};
        seed = await seedDatabase(drizzle(pool, { schema }));
      } finally {
        console.log = originalLog;
      }
      await pool.end();
      pool = undefined;
      cleanup.pool = "closed";
    },
  },
  {
    name: "calculator/migrations-and-seed-contract",
    prerequisites: ["database/create"],
    // Seed convergence/reset contracts intentionally perform multiple complete seeds.
    run: () => vitest("apps/calculator", calculatorExceptions, 1_800_000),
  },
  {
    name: "managed-servers",
    prerequisites: ["database/seed"],
    run: async () => {
      if (interruption.signal.aborted) throw new Error("Run interrupted.");
      if (!handle) throw new Error("Missing run database.");
      environments = {
        calculator: await readLocalEnvironment(
          resolve(root, "apps/calculator/.env"),
        ),
        "cost-tracker": await readLocalEnvironment(
          resolve(root, "apps/cost-tracker/.env"),
        ),
      };
      servers = await startManagedAppServers(
        root,
        { runId: handle.runId, databaseUrl: handle.databaseUrl },
        environments,
        { signal: interruption.signal },
      );
      cleanup.servers = "pending";
    },
  },
  {
    name: "calculator/live",
    prerequisites: ["managed-servers"],
    run: () => vitest("apps/calculator", inventory.calculator.live, 1_800_000),
  },
  {
    name: "cost-tracker/live",
    prerequisites: ["managed-servers"],
    run: () =>
      vitest("apps/cost-tracker", inventory["cost-tracker"].live, 1_800_000),
  },
  {
    name: "live-mail",
    prerequisites: ["managed-servers"],
    run: async () => {
      if (!handle || !servers || !seed)
        throw new Error("Missing email prerequisites.");
      if (!(await verifyEmailWorkflows({ handle, servers, seed })))
        throw new Error("Live email failed.");
    },
  },
  {
    name: "development-garage",
    prerequisites: [],
    run: () =>
      command("apps/cost-tracker", ["run", "test:garage-storage"], {
        ...process.env,
      }),
  },
  {
    name: "cleanup/servers",
    prerequisites: [],
    run: async () => {
      if (!servers) return;
      try {
        await servers.stop();
        cleanup.servers = "stopped";
      } catch {
        cleanup.servers = "failed";
        throw new Error("Server cleanup failed.");
      }
    },
  },
  {
    name: "cleanup/database",
    prerequisites: [],
    run: async () => {
      let failed = false;
      if (pool) {
        try {
          await pool.end();
          cleanup.pool = "closed";
        } catch {
          cleanup.pool = "failed";
          failed = true;
        }
      }
      if (handle) {
        try {
          await disposeIsolatedRunDatabase(handle);
          cleanup.database = "disposed";
        } catch {
          cleanup.database = "failed";
          failed = true;
        }
      }
      if (failed) throw new Error("Database cleanup failed.");
    },
  },
];

const results = await runTestGroups(groups);
const report = {
  suite: "nonbrowser",
  commit: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
  }).trim(),
  workingTreeDirty:
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
      timeout: 10_000,
    }).trim().length > 0,
  seedVersion: await canonicalSeedVersion(
    resolve(root, "apps/calculator/scripts"),
  ),
  runId: handle?.runId ?? null,
  durationMs: Date.now() - started,
  interrupted: interruption.signal.aborted,
  status:
    fullRunPassed(results) && !interruption.signal.aborted ? "passed" : "failed",
  results,
  inventory: { ...inventory, calculatorExceptions },
  testEvidence,
  cleanup,
  databaseCreation,
};
const reports = resolve(root, ".turbo/nonbrowser-tests");
await mkdir(reports, { recursive: true });
await writeFile(
  resolve(reports, `${handle?.runId ?? randomUUID()}.json`),
  JSON.stringify(report, null, 2),
  { mode: 0o600 },
);
console.log(JSON.stringify(report));
process.removeListener("SIGINT", interrupt);
process.removeListener("SIGTERM", interrupt);
if (report.status !== "passed") process.exitCode = 1;
