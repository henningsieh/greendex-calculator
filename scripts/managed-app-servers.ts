import { spawn, type ChildProcess } from "node:child_process";
import { copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

export interface ManagedRun {
  runId: string;
  databaseUrl: string;
}

export function assertManagedRun({ runId, databaseUrl }: ManagedRun): void {
  if (!/^[a-f0-9]{32}$/.test(runId))
    throw new Error("Managed server requires a run identity.");
  const database = new URL(databaseUrl).pathname.slice(1);
  if (
    !/^[a-z_]+_[a-f0-9]{32}$/.test(database) ||
    !database.endsWith(`_${runId}`)
  ) {
    throw new Error("Managed server requires the exact run-owned database.");
  }
}

export async function readLocalEnvironment(
  path: string,
): Promise<Record<string, string>> {
  const values = parseEnv(await readFile(path, "utf8"));
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No managed port available.");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}

async function readOptionalFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

interface OwnedProcess {
  pid?: number;
  owned: boolean;
}

function groupAlive(pid: number): boolean {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

/** Only handles returned by this module may authorize group termination. */
const ownedProcesses = new WeakSet<object>();
export async function stopOwnedProcess(handle: OwnedProcess): Promise<void> {
  if (!handle.owned || !handle.pid || !ownedProcesses.has(handle))
    throw new Error("Refusing to stop an unowned process.");
  if (!groupAlive(handle.pid)) return;
  process.kill(-handle.pid, "SIGTERM");
  const deadline = Date.now() + 10_000;
  while (groupAlive(handle.pid) && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 100));
  if (groupAlive(handle.pid)) {
    process.kill(-handle.pid, "SIGKILL");
    const killDeadline = Date.now() + 5_000;
    while (groupAlive(handle.pid) && Date.now() < killDeadline)
      await new Promise((resolve) => setTimeout(resolve, 100));
    if (groupAlive(handle.pid)) throw new Error("Owned process cleanup failed.");
  }
}

export async function isManagedAuthReady(
  response: Response,
  runId: string,
): Promise<boolean> {
  return (
    response.ok &&
    response.headers.get("X-Greendex-Test-Run") === runId &&
    (await response.text()) === "null"
  );
}

export interface ManagedAppServers {
  calculatorBaseUrl: string;
  costTrackerBaseUrl: string;
  environment: Record<string, string>;
  stop(): Promise<void>;
}

/** Dedicated servers only: no discovery or attachment to ordinary dev processes. */
export async function startManagedAppServers(
  root: string,
  run: ManagedRun,
  environments: Record<"calculator" | "cost-tracker", Record<string, string>>,
): Promise<ManagedAppServers> {
  assertManagedRun(run);
  const ports = [await freePort(), await freePort()];
  while (ports[0] === ports[1]) ports[1] = await freePort();
  const bases = ports.map((port) => `http://127.0.0.1:${port}`);
  const environment = {
    TEST_RUN_ID: run.runId,
    CALCULATOR_TEST_BASE_URL: bases[0],
    COST_TRACKER_TEST_BASE_URL: bases[1],
  };
  const owned: {
    child: ChildProcess;
    handle: OwnedProcess;
    directory: string;
    tsconfig: string;
    originalDeclarations: string | undefined;
    generatedDeclarations: string | undefined;
  }[] = [];
  const stop = async () => {
    const failures: unknown[] = [];
    for (const app of [...owned].reverse()) {
      try {
        await stopOwnedProcess(app.handle);
        // Next always writes app-root next-env.d.ts, even with a separate tsconfig.
        // Restore only our captured output; never overwrite a concurrent external write.
        const declarationsPath = resolve(app.directory, "next-env.d.ts");
        const current = await readOptionalFile(declarationsPath);
        if (current !== app.originalDeclarations) {
          if (current !== app.generatedDeclarations)
            failures.push(
              new Error("Generated declarations changed externally; preserved."),
            );
          else if (app.originalDeclarations === undefined)
            await rm(declarationsPath, { force: true });
          else await writeFile(declarationsPath, app.originalDeclarations);
        }
        await rm(app.tsconfig, { force: true });
        await rm(resolve(app.directory, ".next/test-runs", run.runId), {
          recursive: true,
          force: true,
        });
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length) throw new Error("Managed server cleanup failed.");
  };
  try {
    for (const [index, app] of (
      ["calculator", "cost-tracker"] as const
    ).entries()) {
      const directory = resolve(root, "apps", app);
      const tsconfig = resolve(directory, `.tsconfig-test-${run.runId}.json`);
      const originalDeclarations = await readOptionalFile(
        resolve(directory, "next-env.d.ts"),
      );
      await copyFile(resolve(directory, "tsconfig.json"), tsconfig);
      const child = spawn(
        process.execPath,
        [
          resolve(directory, "node_modules/next/dist/bin/next"),
          "dev",
          "--port",
          String(ports[index]),
          "--hostname",
          "127.0.0.1",
        ],
        {
          cwd: directory,
          detached: true,
          stdio: "ignore",
          env: {
            ...process.env,
            ...environments[app],
            ...environment,
            DATABASE_URL: run.databaseUrl,
            NEXT_PUBLIC_BASE_URL: bases[index],
            PORT: String(ports[index]),
            COST_TRACKER_PORT: String(ports[index]),
            NODE_ENV: "development",
            NEXT_TELEMETRY_DISABLED: "1",
          },
        },
      );
      const handle = { pid: child.pid, owned: true };
      ownedProcesses.add(handle);
      const ownedApp = {
        child,
        handle,
        directory,
        tsconfig,
        originalDeclarations,
        generatedDeclarations: undefined as string | undefined,
      };
      owned.push(ownedApp);
      let failed = false;
      child.once("error", () => {
        failed = true;
      });
      const deadline = Date.now() + 120_000;
      let ready = false;
      while (
        Date.now() < deadline &&
        !failed &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        try {
          const response = await fetch(`${bases[index]}/api/auth/get-session`, {
            signal: AbortSignal.timeout(5_000),
            redirect: "manual",
          });
          if (await isManagedAuthReady(response, run.runId)) {
            ready = true;
            break;
          }
        } catch {
          /* Readiness is bounded; no raw URLs/errors reach reports. */
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      const declarations = await readOptionalFile(
        resolve(directory, "next-env.d.ts"),
      );
      if (declarations?.includes(`.next/test-runs/${run.runId}/`))
        ownedApp.generatedDeclarations = declarations;
      if (!ready || child.exitCode !== null || child.signalCode !== null)
        throw new Error("Managed app did not become ready.");
    }
    return {
      calculatorBaseUrl: bases[0],
      costTrackerBaseUrl: bases[1],
      environment,
      stop,
    };
  } catch {
    await stop();
    throw new Error("Managed application startup failed.");
  }
}
