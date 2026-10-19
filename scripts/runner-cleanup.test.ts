import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  commandFails: false,
  stopFails: false,
  startFails: false,
  acquisitionFails: false,
  outerFailure: false,
  production: false,
  databaseExists: false,
  artifactsExist: false,
  report: undefined as
    | undefined
    | {
        status: string;
        cleanup: Record<string, string>;
      },
}));
vi.mock("node:fs", () => ({ globSync: () => [] }));
vi.mock("node:fs/promises", () => ({
  mkdir: async () => {},
  mkdtemp: async () => {
    state.artifactsExist = true;
    return "/private/run";
  },
  readFile: async () => "",
  rm: async () => {
    state.artifactsExist = false;
  },
  writeFile: async (_path: string, content: string) => {
    state.report = JSON.parse(content);
  },
}));
vi.mock("@greendex/database/schema", () => ({}));
vi.mock("../apps/calculator/scripts/seed", () => ({ seedDatabase: vi.fn() }));
vi.mock("../apps/cost-tracker/scripts/garage-verification", () => ({}));
vi.mock("../apps/cost-tracker/scripts/verify-email-workflows", () => ({}));
vi.mock("./test-candidate", () => ({
  testCandidate: () => ({ commit: "candidate", sourceDigest: "digest" }),
}));
vi.mock("./canonical-seed-version", () => ({
  canonicalSeedVersion: () => "seed",
}));
vi.mock("./browser-test-registry", () => ({ browserSuites: [] }));
vi.mock("../apps/calculator/src/__tests__/helpers/isolated-run-database", () => ({
  IsolatedRunCreationError: class extends Error {},
  createIsolatedRunDatabase: async () => {
    state.databaseExists = true;
    return { runId: "owned-run", databaseUrl: "private" };
  },
  disposeIsolatedRunDatabase: async () => {
    state.databaseExists = false;
  },
}));
vi.mock("./managed-app-servers", () => {
  const stop = async () => {
    if (state.stopFails) throw new Error("surviving child");
  };
  class ManagedCommandCleanupError extends Error {}
  return {
    ManagedCommandCleanupError,
    runManagedCommand: async () => {
      if (state.commandFails)
        throw new ManagedCommandCleanupError("surviving command");
    },
    readLocalEnvironment: async () => ({}),
    createManagedAppRun: async () => {
      if (state.acquisitionFails) throw new Error("acquisition cleanup failed");
      return {
        evidenceDirectory: "/private/lifecycle/evidence",
        start: async () => {
          if (state.startFails) throw new Error("startup failed");
          return {
            baseUrl: "http://127.0.0.1:1234",
            runtime: { kind: "production", artifact: { variant: "ordinary" } },
          };
        },
        stop,
      };
    },
  };
});
vi.mock("./nonbrowser-test-groups", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./nonbrowser-test-groups")>();
  return {
    ...actual,
    runTestGroups: async (
      groups: import("./nonbrowser-test-groups").TestGroup[],
    ) => {
      const selected = groups
        .filter(({ name }) =>
          [
            ...(state.commandFails ? ["calculator/live"] : []),
            "database/create",
            "managed-run",
            "production/calculator",
            "production/cost-tracker",
            "managed-servers",
            "cleanup/servers",
            "cleanup/database",
          ].includes(name),
        )
        .map((group) => ({ ...group, prerequisites: [] }));
      if (state.outerFailure) {
        for (const group of selected.filter(
          ({ execution }) => execution !== "cleanup",
        ))
          await group.run();
        throw new Error("runner interrupted before cleanup");
      }
      return actual.runTestGroups(selected);
    },
  };
});
const originalArgv = process.argv;
const originalExitCode = process.exitCode;
const originalUmask = process.umask(0o077);
afterEach(() => {
  process.argv = originalArgv;
  process.exitCode = originalExitCode;
  process.umask(originalUmask);
});

async function run(options: Partial<typeof state> = {}) {
  vi.resetModules();
  Object.assign(
    state,
    {
      commandFails: false,
      stopFails: false,
      startFails: false,
      acquisitionFails: false,
      outerFailure: false,
      production: false,
      databaseExists: false,
      artifactsExist: false,
      report: undefined,
    },
    options,
  );
  process.argv = [
    "node",
    "runner",
    ...(state.production ? ["--full-production"] : []),
  ];
  await import("../apps/cost-tracker/scripts/run-nonbrowser-tests");
  return state.report;
}

describe("integrated runner cleanup", () => {
  it("retains resources and interrupts later work after command cleanup fails", async () => {
    const report = await run({ commandFails: true });
    expect(report).toMatchObject({
      status: "failed",
      interrupted: true,
      cleanup: {
        commands: "failed",
        servers: "stopped",
        database: "retained",
        browserArtifacts: "retained",
      },
    });
    expect(state.databaseExists).toBe(true);
    expect(state.artifactsExist).toBe(true);
    expect(process.exitCode).toBe(1);
  });
  it.each([
    [false, false],
    [false, true],
    [true, false],
    [true, true],
  ])(
    "retains resources after failed server cleanup (outer fallback %s, production %s)",
    async (outerFailure, production) => {
      const report = await run({ stopFails: true, outerFailure, production });
      expect(report).toMatchObject({
        status: "failed",
        cleanup: {
          servers: "failed",
          database: "retained",
          browserArtifacts: "retained",
        },
      });
      expect(state.databaseExists).toBe(true);
      expect(state.artifactsExist).toBe(true);
      expect(process.exitCode).toBe(1);
    },
  );
  it("retains the database after startup and shutdown both fail", async () => {
    const report = await run({ startFails: true, stopFails: true });
    expect(report).toMatchObject({
      status: "failed",
      cleanup: { servers: "failed", database: "retained" },
    });
    expect(state.databaseExists).toBe(true);
  });
  it("retains the database when lifecycle acquisition cannot confirm cleanup", async () => {
    const report = await run({ acquisitionFails: true });
    expect(report).toMatchObject({
      status: "failed",
      cleanup: { servers: "failed", database: "retained" },
    });
    expect(state.databaseExists).toBe(true);
  });
  it("disposes the database and artifacts only after verified shutdown", async () => {
    const report = await run();
    expect(report).toMatchObject({
      status: "passed",
      cleanup: {
        servers: "stopped",
        database: "disposed",
        browserArtifacts: "removed",
      },
    });
    expect(state.databaseExists).toBe(false);
    expect(state.artifactsExist).toBe(false);
  });
  it("disposes resources after failed startup if shutdown succeeds", async () => {
    const report = await run({ startFails: true });
    expect(report).toMatchObject({
      status: "failed",
      cleanup: {
        servers: "stopped",
        database: "disposed",
        browserArtifacts: "removed",
      },
    });
    expect(state.databaseExists).toBe(false);
  });
});
