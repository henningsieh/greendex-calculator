import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  local: {} as Record<string, string>,
  appStorage: undefined as Record<string, string> | undefined,
  testStorage: undefined as NodeJS.ProcessEnv | undefined,
  consumers: [] as string[],
  report: undefined as
    | undefined
    | {
        status: string;
        results: { group: string; status: string }[];
        testEvidence: { scope: string; total: number; emptyPolicy: string }[];
      },
}));
vi.mock("node:fs", () => ({ globSync: () => [] }));
vi.mock("node:fs/promises", () => ({
  mkdir: async () => {},
  mkdtemp: async () => "/private/run",
  readFile: async () => "",
  rm: async () => {},
  writeFile: async (_path: string, content: string) => {
    state.report = JSON.parse(content);
  },
}));
vi.mock("@greendex/database/schema", () => ({}));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({}) }));
vi.mock("@aws-sdk/client-s3", () => ({
  DeleteObjectCommand: class {},
  GetObjectCommand: class {},
  PutObjectCommand: class {},
  S3Client: class {},
}));
vi.mock("pg", () => ({
  Pool: class {
    async end() {}
  },
}));
vi.mock("../apps/calculator/scripts/seed", () => ({
  seedDatabase: async () => ({}),
}));
vi.mock("../apps/cost-tracker/scripts/verify-email-workflows", () => ({
  verifyEmailWorkflows: async () => true,
}));
vi.mock("../apps/cost-tracker/scripts/garage-verification", async (original) => ({
  ...(await original<
    typeof import("../apps/cost-tracker/scripts/garage-verification")
  >()),
  verifyDevelopmentGarage: async () => {
    state.consumers.push("garage");
  },
}));
vi.mock("./test-candidate", () => ({
  testCandidate: () => ({ commit: "candidate", sourceDigest: "digest" }),
}));
vi.mock("./canonical-seed-version", () => ({
  canonicalSeedVersion: () => "seed",
}));
vi.mock("./browser-test-registry", () => ({ browserSuites: [] }));
vi.mock("../apps/calculator/src/__tests__/helpers/isolated-run-database", () => ({
  IsolatedRunCreationError: class extends Error {},
  createIsolatedRunDatabase: async () => ({
    runId: "owned",
    databaseUrl: "postgres://owned",
  }),
  disposeIsolatedRunDatabase: async () => {},
}));
vi.mock("./managed-app-servers", () => ({
  ManagedCommandCleanupError: class extends Error {},
  readLocalEnvironment: async (path: string) =>
    path.includes("cost-tracker") ? state.local : {},
  runManagedCommand: async (
    _command: string,
    args: string[],
    options: {
      cwd: string;
      env: NodeJS.ProcessEnv;
      inspectOutput?: (output: string) => void;
    },
  ) => {
    if (options.cwd.endsWith("apps/cost-tracker"))
      state.testStorage = options.env;
    if (args.includes("vitest")) {
      const empty = /packages\/(database|config|i18n)$/.test(options.cwd);
      options.inspectOutput?.(
        JSON.stringify({
          numTotalTestSuites: empty ? 0 : 1,
          numTotalTests: empty ? 0 : 1,
          numPassedTests: empty ? 0 : 1,
          numFailedTests: 0,
          numPendingTests: 0,
          numTodoTests: 0,
          testResults: [],
        }),
      );
    }
  },
  createManagedAppRun: async (
    _root: string,
    _run: unknown,
    environments: Record<string, Record<string, string>>,
    options: { profile: string },
  ) => ({
    evidenceDirectory: "/private/evidence",
    start: async (target: string) => {
      state.consumers.push(target);
      if (target === "cost-tracker") state.appStorage = environments[target];
      return {
        baseUrl: "http://127.0.0.1:1234",
        directory: "/private",
        environment: environments[target],
        runtime: { kind: options.profile, artifact: { variant: "ordinary" } },
      };
    },
    stop: async () => {},
  }),
}));
vi.mock("./nonbrowser-test-groups", async (original) => {
  const actual = await original<typeof import("./nonbrowser-test-groups")>();
  return {
    ...actual,
    runTestGroups: (groups: import("./nonbrowser-test-groups").TestGroup[]) =>
      actual.runTestGroups(
        groups.filter(
          ({ name }) =>
            !name.startsWith("browser/") &&
            ![
              "production/release-ordinary",
              "production/calculator-instant",
            ].includes(name),
        ),
      ),
  };
});
const safe = {
  S3_ENDPOINT: "http://127.0.0.1:3900",
  S3_REGION: "garage",
  S3_BUCKET: "greendex-cost-tracker-development",
  S3_ACCESS_KEY_ID: "fixture-key",
  S3_SECRET_ACCESS_KEY: "fixture-secret",
  S3_FORCE_PATH_STYLE: "true",
};
const argv = process.argv;
const exitCode = process.exitCode;
const umask = process.umask(0o077);
afterEach(() => {
  process.argv = argv;
  process.exitCode = exitCode;
  process.umask(umask);
  vi.unstubAllEnvs();
});
async function run(full: boolean, bucket: string) {
  vi.resetModules();
  Object.assign(state, {
    local: { ...safe, S3_BUCKET: bucket },
    appStorage: undefined,
    testStorage: undefined,
    consumers: [],
    report: undefined,
  });
  vi.stubEnv("S3_BUCKET", "injected-production");
  process.argv = ["node", "runner", ...(full ? ["--full-production"] : [])];
  await import("../apps/cost-tracker/scripts/run-nonbrowser-tests");
  return state.report!;
}
describe("integrated runner prerequisites", () => {
  it.each([false, true])(
    "passes the validated effective storage to app and tests and accounts empty packages, full %s",
    async (full) => {
      const report = await run(full, safe.S3_BUCKET);
      expect(report.status).toBe("passed");
      expect(state.appStorage).toMatchObject(safe);
      expect(state.testStorage).toMatchObject(safe);
      expect(state.consumers).toEqual(
        expect.arrayContaining(["calculator", "cost-tracker", "garage"]),
      );
      expect(report.testEvidence.filter(({ total }) => total === 0)).toEqual([
        expect.objectContaining({
          scope: "packages/database",
          emptyPolicy: "discovered-empty",
        }),
        expect.objectContaining({
          scope: "packages/config",
          emptyPolicy: "discovered-empty",
        }),
        expect.objectContaining({
          scope: "packages/i18n",
          emptyPolicy: "discovered-empty",
        }),
      ]);
    },
    30_000,
  );
  it.each([false, true])(
    "refuses unsafe consumers and preserves independent checks, full %s",
    async (full) => {
      const report = await run(full, "production");
      expect(report.status).toBe("failed");
      expect(report.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ group: "storage/target", status: "failed" }),
          expect.objectContaining({
            group: "development-garage",
            status: "blocked",
          }),
          expect.objectContaining({
            group: "cost-tracker/live",
            status: "blocked",
          }),
          expect.objectContaining({ group: "calculator/pure", status: "passed" }),
          expect.objectContaining({
            group: "cost-tracker/pure",
            status: "passed",
          }),
        ]),
      );
      expect(state.consumers).toEqual(full ? ["calculator"] : []);
      expect(process.exitCode).toBe(1);
    },
    30_000,
  );
});
