import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { globSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseEnv } from "node:util";

import {
  assertExistingIntegrationDatabase,
  existingIntegrationApp,
  integrationApps,
  nonbrowserTestNeedsServices,
  type ExistingIntegrationContext,
} from "./existing-integration-environment";

if (!process.stdout.isTTY) delete process.env.FORCE_COLOR;

function gitValue(args: string[]): string {
  try {
    return execFileSync("git", args, { encoding: "utf8" }).trim();
  } catch {
    return "unavailable";
  }
}

function candidateLine(): string {
  const commit = gitValue(["rev-parse", "HEAD"]);
  const branch = gitValue(["rev-parse", "--abbrev-ref", "HEAD"]);
  const tree = gitValue(["status", "--porcelain"]) ? "dirty" : "clean";
  return `candidate commit ${commit} branch ${branch} tree ${tree}`;
}

const root = resolve(dirname(process.argv[1]), "..");
const mode = process.argv[2];
const modes = ["unit", "integration", "e2e"] as const;
const filter = process.argv[3];
if (
  !(process.argv.length === 3 || (process.argv.length === 4 && mode === "e2e")) ||
  ![...modes, "full"].some((value) => value === mode)
) {
  console.error(
    "Usage: pnpm run test:<unit|integration|e2e|full> [e2e-file-filter]",
  );
  process.exit(1);
}
const pattern = "src/**/*.{test,spec}.{ts,tsx,js,jsx}";
const timings: { suite: string; passed: boolean; seconds: string }[] = [];
let failed = false;
let interrupted = false;
class TestRunError extends Error {}
const interruption = new AbortController();
const interrupt = () => {
  interrupted = true;
  interruption.abort();
};
process.on("SIGINT", interrupt);
process.on("SIGTERM", interrupt);

const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

function plain(text: string): string {
  return text.replace(ansi, "");
}

async function command(
  directory: string,
  args: string[],
  environment: Record<string, string | undefined> = process.env,
): Promise<void> {
  const child = spawn("pnpm", ["exec", ...args], {
    cwd: resolve(root, directory),
    stdio: ["inherit", "pipe", "pipe"],
    env: { NODE_ENV: process.env.NODE_ENV, ...environment },
  });
  const forward = (stream: NodeJS.ReadableStream, target: NodeJS.WriteStream) =>
    stream.on("data", (chunk: Buffer) => target.write(plain(chunk.toString())));
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);

  const status = await new Promise<number | null>((done) => {
    child.on("error", () => done(null));
    child.on("close", (code) => done(code));
  });
  if (child.signalCode) interrupted = true;
  if (interrupted)
    throw new TestRunError("Interrupted; remaining checks were not run.");
  if (status === null || status !== 0)
    throw new TestRunError("Test subprocess failed; see its output above.");
}

async function vitest(
  directory: string,
  files: string[],
  integration = false,
  environment: Record<string, string | undefined> = process.env,
): Promise<void> {
  if (!files.length) throw new TestRunError("Required test selection is empty.");
  return command(
    directory,
    [
      "vitest",
      "run",
      integration ? "--maxWorkers=1" : "--maxWorkers=2",
      ...(!process.stdout.isTTY ? ["--no-color"] : []),
      "--retry=0",
      ...(integration ? ["--no-file-parallelism", "--isolate"] : []),
      ...files,
    ],
    { ...environment, NODE_ENV: "test" },
  );
}

function filesFor(directory: string): string[] {
  return globSync([pattern, "test/**/*.test.{ts,tsx,js,jsx}"], {
    cwd: resolve(root, directory),
  })
    .filter((file) => !/\/__tests__\/(?:e2e|merge)\//.test(file))
    .sort();
}

function environmentFile(path: string): Record<string, string> {
  try {
    return Object.fromEntries(
      Object.entries(parseEnv(readFileSync(resolve(root, path), "utf8"))).filter(
        (entry): entry is [string, string] => entry[1] !== undefined,
      ),
    );
  } catch {
    throw new TestRunError(
      `Required configuration file is unavailable: ${path}.`,
    );
  }
}

function existingEnvironment(): Omit<ExistingIntegrationContext, "seed"> {
  const databaseUrl =
    process.env.DATABASE_URL ??
    environmentFile("packages/database/.env").DATABASE_URL;
  assertExistingIntegrationDatabase(databaseUrl ?? "");
  const apps = Object.fromEntries(
    integrationApps.map((app) => {
      const environment: Record<string, string> = {
        ...environmentFile(`apps/${app}/.env`),
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
        DATABASE_URL: databaseUrl,
        DELETE_TESTMAILS_DURING_TESTRUN: "false",
      };
      for (const key of [
        "TEST_RUN_ID",
        "GREENDEX_TEST_SERVICE_DATABASE_URL",
        "GREENDEX_AGGREGATE_TEST_RUN",
        "GREENDEX_FULL_TEST_RUN",
        "GREENDEX_EXISTING_ENVIRONMENT",
        "GREENDEX_E2E_PRODUCTION_OK",
        "GREENDEX_PLAYWRIGHT_AUTH",
        "GREENDEX_PLAYWRIGHT_REPORT",
        "GREENDEX_PLAYWRIGHT_OUTPUT",
      ])
        delete environment[key];
      return [app, existingIntegrationApp(environment)];
    }),
  );
  return {
    kind: "existing-environment",
    correlationId: randomUUID(),
    databaseUrl,
    apps,
  };
}

async function available(baseUrl: string): Promise<void> {
  try {
    const response = await fetch(`${baseUrl}/api/auth/get-session`, {
      redirect: "manual",
      signal: AbortSignal.any([interruption.signal, AbortSignal.timeout(10_000)]),
    });
    if (response.ok && (await response.text()) === "null") return;
  } catch {
    /* Connection details can contain credentials. */
  }
  throw new TestRunError(
    "Required existing loopback application is unavailable or has an unexpected session response. Start it yourself before retrying.",
  );
}

async function main(): Promise<void> {
  console.log(
    "Tests use existing configuration and servers only, dev or production. No production provenance claim.",
  );
  console.log(candidateLine());
  console.log("No builds, startup, migrations, seeding or provisioning.");
  for (const suite of mode === "full"
    ? modes
    : modes.filter((value) => value === mode)) {
    if (interrupted) break;
    const started = Date.now();
    let passed = true;
    const check = async (
      name: string,
      action: () => void | Promise<void>,
    ): Promise<boolean> => {
      await new Promise((resolve) => setImmediate(resolve));
      if (interrupted)
        throw new TestRunError("Interrupted; remaining checks were not run.");
      const start = Date.now();
      try {
        await action();
        console.log(`PASSED ${name} (${Date.now() - start}ms)`);
        return true;
      } catch (error) {
        passed = false;
        const message =
          error instanceof TestRunError
            ? error.message
            : "Required configuration, credentials or service check failed. Private details suppressed.";
        console.error(`FAILED ${name} (${Date.now() - start}ms). ${message}`);
        if (interrupted) throw error;
        return false;
      }
    };
    try {
      if (suite === "unit") {
        for (const name of ["auth", "email", "database", "config", "i18n"]) {
          const directory = `packages/${name}`;
          const files = filesFor(directory).filter(
            (file) => !file.includes(".integration.test."),
          );
          if (files.length)
            await check(directory, () => vitest(directory, files));
        }
        for (const app of integrationApps) {
          const directory = `apps/${app}`;
          await check(directory, () =>
            vitest(
              directory,
              filesFor(directory).filter(
                (file) =>
                  !nonbrowserTestNeedsServices(
                    file,
                    readFileSync(resolve(root, directory, file), "utf8"),
                  ),
              ),
            ),
          );
        }
        await check("repository policies/tooling", () =>
          vitest(".", globSync("scripts/**/*.test.ts", { cwd: root }).sort()),
        );
        await check("documentation", () =>
          vitest("apps/documentation", filesFor("apps/documentation")),
        );
      } else {
        const context = existingEnvironment();
        const calculator = context.apps.calculator!;
        const costTracker = context.apps["cost-tracker"]!;
        const targets = {
          DATABASE_URL: context.databaseUrl,
          CALCULATOR_TEST_BASE_URL: calculator.baseUrl,
          COST_TRACKER_TEST_BASE_URL: costTracker.baseUrl,
          COST_TRACKER_E2E_BASE_URL: costTracker.baseUrl,
          DELETE_TESTMAILS_DURING_TESTRUN: "false",
        };
        const ready: Partial<Record<(typeof integrationApps)[number], boolean>> =
          {};
        for (const app of integrationApps)
          ready[app] = await check(`${app}/existing server`, () =>
            available(context.apps[app]!.baseUrl),
          );
        if (suite === "integration") {
          const { resolveExistingIntegrationSeed, verifyEmailWorkflows } =
            await import("../apps/cost-tracker/scripts/verify-email-workflows");
          const {
            developmentGarageEnvironmentSchema,
            validatedDevelopmentGarageEnvironment,
            verifyDevelopmentGarage,
          } = await import("../apps/cost-tracker/scripts/garage-verification");
          await check("shared migration and seed contracts", () =>
            vitest(
              "packages/database",
              globSync("src/**/*.integration.test.ts", {
                cwd: resolve(root, "packages/database"),
              }).sort(),
              true,
              {
                ...context.apps.calculator!.environment,
                DATABASE_URL: context.databaseUrl,
              },
            ),
          );
          let seed: ExistingIntegrationContext["seed"] | undefined;
          await check("existing seed lookup", async () => {
            seed = await resolveExistingIntegrationSeed(context.databaseUrl);
          });
          for (const app of integrationApps) {
            const directory = `apps/${app}`;
            const files = filesFor(directory).filter((file) =>
              nonbrowserTestNeedsServices(
                file,
                readFileSync(resolve(root, directory, file), "utf8"),
              ),
            );
            const environment: Record<string, string> = {
              ...context.apps[app]!.environment,
              ...targets,
            };
            await check(`${app}/database and procedures`, () =>
              vitest(
                directory,
                files.filter((file) => !/openapi-http\.test\./.test(file)),
                true,
                environment,
              ),
            );
            const http = files.filter((file) =>
              /openapi-http\.test\./.test(file),
            );
            if (http.length)
              await check(`${app}/real HTTP`, () => {
                if (!ready[app])
                  throw new TestRunError("Blocked by missing existing server.");
                return vitest(directory, http, true, environment);
              });
            await check(`${app}/real mail`, async () => {
              if (!ready[app] || !seed)
                throw new TestRunError(
                  "Blocked by missing existing server or seed Organizations.",
                );
              if (
                !(await verifyEmailWorkflows(
                  { context: { ...context, seed }, apps: [app] },
                  AbortSignal.any([
                    interruption.signal,
                    AbortSignal.timeout(10 * 60_000),
                  ]),
                ))
              )
                throw new TestRunError(
                  "Required real-mail workflows failed. Check dedicated mailbox and SMTP/IMAP credentials.",
                );
            });
          }
          await check("real Garage", async () => {
            const storage = validatedDevelopmentGarageEnvironment(
              costTracker.environment,
              {},
            );
            await verifyDevelopmentGarage(
              developmentGarageEnvironmentSchema.parse(storage),
              interruption.signal,
            );
          });
        } else {
          for (const [app, config] of [
            ["cost-tracker", "playwright.config.ts"],
            ["calculator", "playwright.config.ts"],
            ["calculator", "playwright.merge.config.ts"],
          ] as const) {
            await check(`${app}/${config}`, () => {
              if (
                !ready[app] ||
                (config === "playwright.merge.config.ts" &&
                  !ready["cost-tracker"])
              )
                throw new TestRunError("Blocked by missing existing server.");
              return command(
                `apps/${app}`,
                [
                  "playwright",
                  "test",
                  `--config=${config}`,
                  "--workers=1",
                  ...(filter ? [filter] : []),
                ],
                {
                  ...context.apps[app]!.environment,
                  ...targets,
                },
              );
            });
          }
        }
      }
    } catch (error) {
      passed = false;
      console.error(
        `${suite} FAILED. ${error instanceof TestRunError ? error.message : "Required existing environment configuration is missing or invalid. Private details suppressed."}`,
      );
    }
    failed ||= !passed;
    console.log(`${suite} exit ${passed ? 0 : 1}`);
    timings.push({
      suite,
      passed,
      seconds: ((Date.now() - started) / 1000).toFixed(1),
    });
  }
  for (const result of timings)
    console.log(
      `${result.suite} ${result.passed ? "PASSED" : "FAILED"} (${result.seconds}s)`,
    );
  console.log(candidateLine());
  console.log(`overall exit ${failed || interrupted ? 1 : 0}`);
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
  process.exitCode = failed || interrupted ? 1 : 0;
}

main().catch(() => {
  console.error("Test runner failed. Private details suppressed.");
  process.exitCode = 1;
});
