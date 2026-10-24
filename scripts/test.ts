import { spawnSync } from "node:child_process";
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

if (!process.stdout.isTTY) {
  delete process.env.FORCE_COLOR;
  process.env.NO_COLOR = "1";
}

const root = resolve(dirname(process.argv[1]), "..");
const mode = process.argv[2];
const modes = ["unit", "integration", "e2e"] as const;
if (
  process.argv.length !== 3 ||
  ![...modes, "full"].some((value) => value === mode)
) {
  console.error("Usage: pnpm run test:<unit|integration|e2e|full>");
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

function command(
  directory: string,
  args: string[],
  environment: Record<string, string | undefined> = process.env,
): void {
  const outputEnvironment: NodeJS.ProcessEnv = {
    NODE_ENV: process.env.NODE_ENV,
    ...environment,
  };
  if (!process.stdout.isTTY) {
    delete outputEnvironment.FORCE_COLOR;
    outputEnvironment.NO_COLOR = "1";
  }
  const result = spawnSync("pnpm", ["exec", ...args], {
    cwd: resolve(root, directory),
    stdio: "inherit",
    env: outputEnvironment,
  });
  if (result.signal) interrupted = true;
  if (interrupted)
    throw new TestRunError("Interrupted; remaining checks were not run.");
  if (result.error)
    throw new TestRunError(
      "Could not launch test subprocess. Check installed pnpm and dependencies.",
    );
  if (result.status !== 0)
    throw new TestRunError("Test subprocess failed; see its output above.");
}

function vitest(
  directory: string,
  files: string[],
  integration = false,
  environment: Record<string, string | undefined> = process.env,
): void {
  if (!files.length) throw new TestRunError("Required test selection is empty.");
  command(
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
          const files = filesFor(directory);
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
                vitest(directory, http, true, environment);
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
              command(
                `apps/${app}`,
                [
                  "playwright",
                  "test",
                  `--config=${config}`,
                  "--workers=1",
                  "--retries=0",
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
  process.removeListener("SIGINT", interrupt);
  process.removeListener("SIGTERM", interrupt);
  process.exitCode = failed || interrupted ? 1 : 0;
}

main().catch(() => {
  console.error("Test runner failed. Private details suppressed.");
  process.exitCode = 1;
});
