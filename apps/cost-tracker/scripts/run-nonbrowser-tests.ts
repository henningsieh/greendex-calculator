/* eslint-disable import/no-relative-parent-imports -- Repository test orchestration, not app runtime. */
import { randomUUID } from "node:crypto";
import { globSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import * as schema from "@greendex/database/schema";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import {
  browserTestEvidence,
  assertBrowserExecution,
} from "../../../scripts/browser-test-evidence";
import {
  browserFiles,
  browserSuites,
  assertBrowserCoverage,
  type BrowserSuite,
} from "../../../scripts/browser-test-registry";
import { canonicalSeedVersion } from "../../../scripts/canonical-seed-version";
import { fullProductionGroups } from "../../../scripts/full-production-groups";
import {
  createManagedAppRun,
  ManagedCommandCleanupError,
  type ManagedAppRun,
  type ManagedTarget,
  type ReadyApp,
  readLocalEnvironment,
  runManagedCommand,
  type ManagedAppServers,
} from "../../../scripts/managed-app-servers";
import { nonbrowserTestEvidence } from "../../../scripts/nonbrowser-test-evidence";
import {
  fullRunPassed,
  nonbrowserPackages,
  nonbrowserVitestScheduling,
  runTestGroups,
  type TestGroup,
} from "../../../scripts/nonbrowser-test-groups";
import { testCandidate } from "../../../scripts/test-candidate";
import { seedDatabase } from "../../calculator/scripts/seed";
import {
  createIsolatedRunDatabase,
  disposeIsolatedRunDatabase,
  IsolatedRunCreationError,
  type IsolatedRunHandle,
} from "../../calculator/src/__tests__/helpers/isolated-run-database";
import {
  developmentGarageEnvironmentSchema,
  GarageCleanupError,
  verifyDevelopmentGarage,
} from "./garage-verification";
import { verifyEmailWorkflows } from "./verify-email-workflows";

const root = resolve(import.meta.dirname, "../../..");
const started = Date.now();
const full = process.argv.includes("--full-production");
if (process.argv.slice(2).some((arg) => arg !== "--full-production"))
  throw new Error("Unknown runner argument.");
process.umask(0o077);
const candidate = testCandidate(root);
const privateRoot = resolve(
  root,
  ".turbo",
  full ? "full-tests" : "nonbrowser-tests",
);
await mkdir(privateRoot, { recursive: true, mode: 0o700 });
const privateRun = await mkdtemp(resolve(privateRoot, "run-"));
let managedRun: ManagedAppRun<"production"> | undefined;
let developmentRun: ManagedAppRun<"development"> | undefined;
const ready = new Map<ManagedTarget, ReadyApp>();
const environmentFailures = new Set<"calculator" | "cost-tracker">();
const browserEvidence: {
  suite: string;
  discovery?: ReturnType<typeof browserTestEvidence>;
  execution?: ReturnType<typeof browserTestEvidence>;
}[] = [];
const browserInventory = browserSuites.map((suite) => ({
  suite: suite.name,
  config: `apps/${suite.app}/${suite.config}`,
  files: browserFiles(root, suite),
  targets: suite.targets,
}));
const interruption = new AbortController();
const interrupt = () => interruption.abort();
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);
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
  commands: "not-failed",
  database: "not-created",
  pool: "not-opened",
  garage: "not-started",
  garageKey: null as string | null,
  browserArtifacts: "not-created",
};
const environment = (): NodeJS.ProcessEnv => ({
  ...process.env,
  DATABASE_URL:
    handle?.databaseUrl ?? "postgres://127.0.0.1:1/blocked_test_prerequisite",
  TEST_RUN_ID: handle?.runId,
  GREENDEX_TEST_SERVICE_DATABASE_URL: handle?.baseDatabaseUrl,
  ...servers?.environment,
  ...(full
    ? {
        ...ready.get("calculator")?.environment,
        ...ready.get("cost-tracker")?.environment,
        GREENDEX_FULL_TEST_RUN: "true",
        GREENDEX_TEST_SERVICE_DATABASE_URL: handle?.baseDatabaseUrl,
      }
    : {}),
  GREENDEX_AGGREGATE_TEST_RUN: "true",
});
const managedCommand = async (...args: Parameters<typeof runManagedCommand>) => {
  try {
    await runManagedCommand(...args);
  } catch (error) {
    if (error instanceof ManagedCommandCleanupError) {
      cleanup.commands = "failed";
      interruption.abort();
    }
    throw error;
  }
};
const command = (cwd: string, args: string[], env = environment()) =>
  managedCommand("pnpm", args, {
    cwd: resolve(root, cwd),
    env,
    timeoutMs: 900_000,
    signal: interruption.signal,
  });
const testEvidence: ReturnType<typeof nonbrowserTestEvidence>[] = [];
const vitest = (
  cwd: string,
  args: string[] = [],
  timeoutMs = 900_000,
  scheduling: keyof typeof nonbrowserVitestScheduling = "serial",
) =>
  managedCommand(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      ...nonbrowserVitestScheduling[full ? "serial" : scheduling],
      ...(full ? ["--maxWorkers=1", "--retry=0"] : []),
      `--reporter=${resolve(root, "scripts/nonbrowser-json-reporter.ts")}`,
      ...args,
    ],
    {
      cwd: resolve(root, cwd),
      env: {
        ...environment(),
        ...(full && cwd === "apps/calculator"
          ? ready.get("calculator")?.environment
          : {}),
        ...(full && cwd === "apps/cost-tracker"
          ? ready.get("cost-tracker")?.environment
          : {}),
        GREENDEX_AGGREGATE_TEST_RUN: "true",
        GREENDEX_TEST_SERVICE_DATABASE_URL: handle?.baseDatabaseUrl,
        NODE_ENV: "test",
      },
      timeoutMs,
      signal: interruption.signal,
      inspectOutput: (output) => {
        const start = output.indexOf('{"numTotalTestSuites"');
        if (start < 0) throw new Error("Missing valid test evidence.");
        let skipped = false;
        try {
          const data: unknown = JSON.parse(output.slice(start));
          const evidence = nonbrowserTestEvidence(data, cwd, root);
          testEvidence.push(evidence);
          console.log(JSON.stringify(evidence));
          skipped =
            evidence.total === 0 ||
            evidence.failed > 0 ||
            evidence.suiteFailures.length > 0 ||
            evidence.pending > 0 ||
            evidence.todo > 0 ||
            evidence.passed !== evidence.total ||
            evidence.pendingTests.length > 0;
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
    execution: "parallel",
    run: async () => {
      await vitest(".", ["scripts"]);
      await command(".", ["exec", "tsx", "scripts/check-agent-instructions.ts"]);
      await command(".", ["run", "check:cost-tracker-persistence-seam"]);
    },
  },
  ...nonbrowserPackages.map((name) => ({
    name: `package/${name}`,
    prerequisites: [],
    execution: "parallel" as const,
    run: () => vitest(`packages/${name}`, ["--passWithNoTests"]),
  })),
  ...["calculator", "cost-tracker"].map((app) => ({
    name: `${app}/pure`,
    prerequisites: [],
    execution: "parallel" as const,
    run: () => vitest(`apps/${app}`, inventory[app].pure, 1_800_000, "pure"),
  })),
  {
    name: "database/create",
    prerequisites: [],
    execution: "parallel",
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
    execution: "serial",
    run: () => command("packages/database", ["run", "db:migrate"]),
  },
  {
    name: "database/seed",
    prerequisites: ["database/migrate"],
    execution: "serial",
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
    execution: "serial",
    // Seed convergence/reset contracts intentionally perform multiple complete seeds.
    run: () => vitest("apps/calculator", calculatorExceptions, 1_800_000),
  },
  {
    name: "managed-servers",
    prerequisites: ["database/seed"],
    execution: "serial",
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
      cleanup.servers = "pending";
      developmentRun = await createManagedAppRun(
        root,
        { runId: handle.runId, databaseUrl: handle.databaseUrl },
        environments,
        { profile: "development", signal: interruption.signal },
      );
      const lifecycle = developmentRun;
      const calculator = await lifecycle.start("calculator");
      const costTracker = await lifecycle.start("cost-tracker");
      servers = {
        calculatorBaseUrl: calculator.baseUrl,
        costTrackerBaseUrl: costTracker.baseUrl,
        environment: {
          TEST_RUN_ID: handle.runId,
          CALCULATOR_TEST_BASE_URL: calculator.baseUrl,
          COST_TRACKER_TEST_BASE_URL: costTracker.baseUrl,
        },
        stop: () => lifecycle.stop(),
      };
    },
  },
  {
    name: "calculator/live",
    prerequisites: ["managed-servers"],
    execution: "serial",
    run: () => vitest("apps/calculator", inventory.calculator.live, 1_800_000),
  },
  {
    name: "cost-tracker/live",
    prerequisites: ["managed-servers"],
    execution: "serial",
    run: () =>
      vitest("apps/cost-tracker", inventory["cost-tracker"].live, 1_800_000),
  },
  {
    name: "live-mail",
    prerequisites: ["managed-servers"],
    execution: "serial",
    run: async () => {
      if (!handle || !servers || !seed)
        throw new Error("Missing email prerequisites.");
      if (
        !(await verifyEmailWorkflows(
          { handle, servers, seed },
          interruption.signal,
        ))
      )
        throw new Error("Live email failed.");
    },
  },
  {
    name: "development-garage",
    prerequisites: [],
    execution: "parallel",
    run: async () => {
      const garageEnvironment = developmentGarageEnvironmentSchema.parse({
        ...(await readLocalEnvironment(resolve(root, "apps/cost-tracker/.env"))),
        ...(await readLocalEnvironment(resolve(root, "packages/database/.env"))),
        ...process.env,
      });
      cleanup.garage = "pending";
      try {
        await verifyDevelopmentGarage(garageEnvironment, interruption.signal);
      } catch (error) {
        if (error instanceof GarageCleanupError) {
          cleanup.garage = "failed";
          cleanup.garageKey = error.key;
        }
        throw error;
      } finally {
        if (cleanup.garage === "pending") cleanup.garage = "completed";
      }
    },
  },
  {
    name: "cleanup/servers",
    prerequisites: [],
    execution: "cleanup",
    run: async () => {
      if (cleanup.servers === "not-started") return;
      try {
        if (managedRun) await managedRun.stop();
        else if (developmentRun) await developmentRun.stop();
        else throw new Error("Lifecycle acquisition cleanup is unconfirmed.");
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
    execution: "cleanup",
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
        if (
          cleanup.servers === "failed" ||
          cleanup.servers === "pending" ||
          cleanup.commands === "failed" ||
          failed
        ) {
          cleanup.database = "retained";
          throw new Error(
            "Database retained until resource cleanup is verified.",
          );
        }
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

const runBrowser = async (suite: BrowserSuite) => {
  const app = ready.get(suite.targets[0]);
  if (
    !app ||
    app.runtime.kind !== "production" ||
    app.runtime.artifact.variant !== (suite.instant ? "instant" : "ordinary")
  )
    throw new Error("Missing production browser target.");
  cleanup.browserArtifacts = "pending";
  const directory = resolve(privateRun, suite.name);
  await mkdir(directory, { mode: 0o700 });
  const reportFile = resolve(directory, "raw.json");
  const evidence: (typeof browserEvidence)[number] = { suite: suite.name };
  browserEvidence.push(evidence);
  const env = {
    ...environment(),
    ...app.environment,
    GREENDEX_AGGREGATE_TEST_RUN: "true",
    GREENDEX_TEST_SERVICE_DATABASE_URL: handle?.baseDatabaseUrl,
    GREENDEX_FULL_TEST_RUN: "true",
    GREENDEX_PLAYWRIGHT_REPORT: reportFile,
    PLAYWRIGHT_JSON_OUTPUT_FILE: reportFile,
    GREENDEX_PLAYWRIGHT_OUTPUT: resolve(directory, "output"),
    GREENDEX_PLAYWRIGHT_AUTH: resolve(directory, "auth.json"),
    COST_TRACKER_E2E_BASE_URL: ready.get("cost-tracker")?.baseUrl,
  };
  const invoke = async (discovery: boolean) => {
    await rm(reportFile, { force: true });
    try {
      await managedCommand(
        "pnpm",
        [
          "exec",
          "playwright",
          "test",
          `--config=${suite.config}`,
          "--workers=1",
          "--retries=0",
          ...(discovery ? ["--list"] : []),
        ],
        {
          cwd: app.directory,
          env,
          timeoutMs: 3_600_000,
          signal: interruption.signal,
        },
      );
    } finally {
      try {
        const parsed = browserTestEvidence(
          JSON.parse(await readFile(reportFile, "utf8")),
          discovery,
        );
        if (discovery) evidence.discovery = parsed;
        else evidence.execution = parsed;
      } finally {
        await rm(reportFile, { force: true });
      }
    }
  };
  await invoke(true);
  if (!evidence.discovery || evidence.discovery.errors)
    throw new Error("Missing browser discovery.");
  assertBrowserCoverage(
    browserFiles(root, suite),
    [...new Set(evidence.discovery.tests.map(({ file }) => file))].sort(),
  );
  await invoke(false);
  if (!evidence.execution) throw new Error("Missing browser execution.");
  assertBrowserExecution(evidence.discovery, evidence.execution);
};
const selectedGroups = full
  ? fullProductionGroups(groups, {
      create: async () => {
        if (!handle) throw new Error("Missing run database.");
        environments = { calculator: {}, "cost-tracker": {} };
        for (const app of ["calculator", "cost-tracker"] as const) {
          try {
            environments[app] = await readLocalEnvironment(
              resolve(root, "apps", app, ".env"),
            );
          } catch {
            environmentFailures.add(app);
          }
        }
        cleanup.servers = "pending";
        managedRun = await createManagedAppRun(
          root,
          { runId: handle.runId, databaseUrl: handle.databaseUrl },
          environments,
          { profile: "production", signal: interruption.signal },
        );
      },
      start: async (target) => {
        if (!managedRun) throw new Error("Missing managed run.");
        if (
          environmentFailures.has(
            target === "calculator-instant" ? "calculator" : target,
          )
        )
          throw new Error("Missing target environment prerequisite.");
        const app = await managedRun.start(target);
        if (
          app.runtime.kind !== "production" ||
          app.runtime.artifact.variant !==
            (target === "calculator-instant" ? "instant" : "ordinary")
        )
          throw new Error("Missing required production artifact.");
        ready.set(target, app);
      },
      pair: async () => {
        const calculator = ready.get("calculator");
        const cost = ready.get("cost-tracker");
        const lifecycle = managedRun;
        if (!calculator || !cost || !lifecycle || !handle)
          throw new Error("Missing paired production targets.");
        servers = {
          calculatorBaseUrl: calculator.baseUrl,
          costTrackerBaseUrl: cost.baseUrl,
          environment: {
            TEST_RUN_ID: handle.runId,
            CALCULATOR_TEST_BASE_URL: calculator.baseUrl,
            COST_TRACKER_TEST_BASE_URL: cost.baseUrl,
          },
          stop: () => lifecycle.stop(),
        };
      },
      browser: runBrowser,
      releaseOrdinary: async () => {
        if (!managedRun) return;
        const outcomes = await Promise.allSettled([
          managedRun.release("calculator"),
          managedRun.release("cost-tracker"),
        ]);
        if (outcomes.some(({ status }) => status === "rejected"))
          throw new Error("Ordinary production release failed.");
      },
    })
  : groups;
let results: Awaited<ReturnType<typeof runTestGroups>> = [];
let runnerFailed = false;
try {
  results = await runTestGroups(selectedGroups, { signal: interruption.signal });
} catch {
  runnerFailed = true;
} finally {
  for (const group of selectedGroups.filter(
    ({ name, execution }) =>
      execution === "cleanup" && !results.some(({ group }) => group === name),
  )) {
    try {
      await group.run();
    } catch {
      runnerFailed = true;
    }
  }
  if (
    cleanup.servers === "failed" ||
    cleanup.servers === "pending" ||
    cleanup.commands === "failed"
  ) {
    cleanup.browserArtifacts = "retained";
    runnerFailed = true;
  } else {
    try {
      await rm(privateRun, { recursive: true, force: true });
      cleanup.browserArtifacts = "removed";
    } catch {
      cleanup.browserArtifacts = "failed";
      runnerFailed = true;
    }
  }
}
const finalCandidate = testCandidate(root);
const lifecycle = managedRun ?? developmentRun;
const report = {
  suite: full ? "full-production" : "nonbrowser",
  ...candidate,
  candidateUnchanged:
    candidate.sourceDigest === finalCandidate.sourceDigest &&
    candidate.commit === finalCandidate.commit,
  runtime: full ? "production" : "development",
  lifecycleEvidenceDirectory: lifecycle
    ? relative(root, lifecycle.evidenceDirectory)
    : null,
  retainedArtifactsDirectory:
    cleanup.browserArtifacts === "retained" ? relative(root, privateRun) : null,
  productionTargets: [...ready].map(([target, app]) => ({
    target,
    baseUrl: app.baseUrl,
    runtime: app.runtime,
  })),
  browserInventory: full ? browserInventory : [],
  browserEvidence,
  seedVersion: await canonicalSeedVersion(
    resolve(root, "apps/calculator/scripts"),
  ),
  runId: handle?.runId ?? null,
  durationMs: Date.now() - started,
  interrupted: interruption.signal.aborted,
  status:
    fullRunPassed(results) &&
    !runnerFailed &&
    candidate.sourceDigest === finalCandidate.sourceDigest &&
    candidate.commit === finalCandidate.commit &&
    !interruption.signal.aborted
      ? "passed"
      : "failed",
  results,
  groupInventory: selectedGroups.map(({ name, prerequisites, execution }) => ({
    name,
    prerequisites,
    execution,
  })),
  groupCounts: {
    passed: results.filter(({ status }) => status === "passed").length,
    failed: results.filter(({ status }) => status === "failed").length,
    blocked: results.filter(({ status }) => status === "blocked").length,
    missing: selectedGroups.length - results.length,
  },
  inventory: { ...inventory, calculatorExceptions },
  testEvidence,
  cleanup,
  databaseCreation,
};
const reports = privateRoot;
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
