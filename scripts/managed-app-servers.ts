import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdtemp,
  mkdir,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import {
  copyWorkspaceSource,
  linkWorkspaceDependencies,
  workspaceDigest,
} from "./private-app-workspace";

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

export class ManagedCommandCleanupError extends Error {}

/** Bounded task subprocess; output remains private, and descendants are owned too. */
export async function runManagedCommand(
  command: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    timeoutMs: number;
    signal?: AbortSignal;
    inspectOutput?: (output: string) => void;
  },
): Promise<void> {
  options.signal?.throwIfAborted();
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    detached: true,
    stdio: options.inspectOutput ? ["ignore", "pipe", "ignore"] : "ignore",
  });
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    if (output.length < 16_000_000) output += chunk.toString();
  });
  const handle = { pid: child.pid, owned: true };
  ownedProcesses.add(handle);
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = () =>
        reject(new Error("Managed command timed out or interrupted."));
      const timer = setTimeout(fail, options.timeoutMs);
      options.signal?.addEventListener("abort", fail, { once: true });
      child.once("error", () => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", fail);
        reject(new Error("Managed command could not start."));
      });
      child.once("exit", (code) => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", fail);
        if (code === 0) resolve();
        else reject(new Error("Managed command failed."));
      });
      if (options.signal?.aborted) fail();
    });
  } finally {
    if (handle.pid)
      await stopOwnedProcess(handle).catch((error: unknown) => {
        throw new ManagedCommandCleanupError("Managed command cleanup failed.", {
          cause: error,
        });
      });
    options.inspectOutput?.(output);
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

export type AppTarget = "calculator" | "cost-tracker";
export type RuntimeProfile = "development" | "production";
export type ManagedTarget = AppTarget | "calculator-instant";
type Target<P extends RuntimeProfile> = P extends "production"
  ? ManagedTarget
  : AppTarget;
export interface ArtifactIdentity {
  candidateDigest: string;
  configurationDigest: string;
  variant: "ordinary" | "instant";
  buildId: string;
}
export interface ReadyApp {
  directory: string;
  baseUrl: string;
  environment: NodeJS.ProcessEnv;
  runtime:
    | { kind: "development" }
    | { kind: "production"; artifact: ArtifactIdentity };
}
export class ManagedAppLifecycleError extends Error {
  constructor(
    message: string,
    readonly evidenceDirectory: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ManagedAppLifecycleError";
  }
}

export interface ManagedAppRun<P extends RuntimeProfile> {
  start(target: Target<P>): Promise<ReadyApp>;
  release(target: Target<P>): Promise<void>;
  stop(): Promise<void>;
  evidenceDirectory: string;
}
interface ManagedServerOptions {
  signal?: AbortSignal;
  ownershipTimeoutMs?: number;
}
interface ManagedAppRunOptions<
  P extends RuntimeProfile,
> extends ManagedServerOptions {
  profile: P;
  buildTimeoutMs?: number;
  readinessTimeoutMs?: number;
}

async function reservePort(port = 0) {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No managed port available.");
  let closed = false;
  return {
    port: address.port,
    async release() {
      if (closed) return;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      closed = true;
    },
  };
}
type Reservation = Awaited<ReturnType<typeof reservePort>>;
interface TargetRecord {
  app: AppTarget;
  port: Reservation;
  socket?: Reservation;
  environment: NodeJS.ProcessEnv;
  directory: string;
  image: string;
  children: { child: ChildProcess; handle: OwnedProcess; failed: boolean }[];
  ready?: ReadyApp;
  artifact?: ArtifactIdentity;
  materialized: boolean;
}

const alive = (record: TargetRecord) =>
  record.children.length > 0 &&
  record.children.every(
    ({ child, failed }) =>
      !failed && child.exitCode === null && child.signalCode === null,
  );

async function waitForSocket(
  record: TargetRecord,
  child: ChildProcess,
  runId: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && alive(record) && !signal.aborted) {
    try {
      const response = await fetch(
        `http://127.0.0.1:${record.socket!.port}/__managed-ready`,
        { signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]) },
      );
      if (
        response.ok &&
        response.headers.get("X-Greendex-Test-Run") === runId &&
        (await response.text()) === String(child.pid)
      )
        return;
    } catch {
      /* The owned socket child must identify itself before the deadline. */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Owned socket child did not become ready.");
}

async function waitForApp(
  record: TargetRecord,
  runId: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let ready = false;
  while (Date.now() < deadline && alive(record) && !signal.aborted) {
    try {
      const response = await fetch(
        `${record.environment.NEXT_PUBLIC_BASE_URL}/api/auth/get-session`,
        {
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
          redirect: "manual",
        },
      );
      if (await isManagedAuthReady(response, runId)) {
        ready = true;
        break;
      }
    } catch {
      /* No raw service errors reach reports. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  signal.throwIfAborted();
  if (!ready || !alive(record))
    throw new Error("Managed app did not become ready.");
  const response = await fetch(
    `${record.environment.NEXT_PUBLIC_BASE_URL}/api/rpc`,
    {
      signal: AbortSignal.any([
        signal,
        AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      ]),
      redirect: "manual",
    },
  );
  if (
    response.status !== 404 ||
    (await response.text()) !== "Not found" ||
    !alive(record)
  )
    throw new Error("Managed RPC route did not become ready.");
}

/** One source snapshot, three isolated targets, and only run-owned process handles. */
export async function createManagedAppRun<P extends RuntimeProfile>(
  root: string,
  run: ManagedRun,
  environments: Record<AppTarget, Record<string, string>>,
  options: ManagedAppRunOptions<P>,
): Promise<ManagedAppRun<P>> {
  assertManagedRun(run);
  options.signal?.throwIfAborted();
  const runsDirectory = resolve(root, ".turbo/managed-app-runs");
  await mkdir(runsDirectory, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(resolve(runsDirectory, `${run.runId}-`));
  await chmod(directory, 0o700);
  const evidenceDirectory = resolve(directory, "evidence");
  const snapshot = resolve(directory, "source");
  const records = new Map<ManagedTarget, TargetRecord>();
  const reservations: Reservation[] = [];
  const controller = new AbortController();
  let closed = false;
  let acquired = false;
  let stopping: Promise<void> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const pending = queue.then(task);
    queue = pending.catch(() => {});
    return pending;
  };
  const signal = controller.signal;
  const persist = async (target: ManagedTarget, state: string) => {
    const record = records.get(target)!;
    await writeFile(
      resolve(evidenceDirectory, `${target}.json`),
      JSON.stringify(
        {
          runId: run.runId,
          target,
          profile: options.profile,
          state,
          directory: record.directory,
          ports: [
            record.port.port,
            ...(record.socket ? [record.socket.port] : []),
          ],
          pids: record.children.map(({ handle }) => handle.pid),
          artifact: record.artifact,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  };
  const stopChildren = async (target: ManagedTarget) => {
    const record = records.get(target)!;
    const failures: unknown[] = [];
    for (const { handle } of [...record.children].reverse()) {
      try {
        if (handle.pid) await stopOwnedProcess(handle);
      } catch (error) {
        failures.push(error);
      }
    }
    record.ready = undefined;
    if (failures.length) {
      await persist(target, "cleanup-failed-resources-retained");
      throw new AggregateError(
        failures,
        "Managed target cleanup failed; workspace and ownership evidence retained.",
      );
    }
    record.children = [];
  };
  const stop = () => {
    if (stopping) return stopping;
    closed = true;
    controller.abort();
    stopping = serial(async () => {
      const failures: unknown[] = [];
      for (const [target, record] of records) {
        try {
          await stopChildren(target);
          await rm(record.image, { recursive: true, force: true });
          await persist(target, "stopped");
        } catch (error) {
          failures.push(error);
        }
      }
      for (const reservation of reservations) {
        try {
          await reservation.release();
        } catch (error) {
          failures.push(error);
        }
      }
      if (failures.length)
        throw new ManagedAppLifecycleError(
          "Managed app run cleanup failed; retain the database until verified recovery.",
          evidenceDirectory,
          { cause: new AggregateError(failures) },
        );
      await rm(snapshot, { recursive: true, force: true });
      options.signal?.removeEventListener("abort", onAbort);
    });
    return stopping;
  };
  const onAbort = () => {
    controller.abort();
    if (acquired) void stop().catch(() => {});
  };
  options.signal?.addEventListener("abort", onAbort, { once: true });
  if (options.signal?.aborted) onAbort();
  try {
    signal.throwIfAborted();
    await mkdir(evidenceDirectory, { mode: 0o700 });
    await copyWorkspaceSource(root, snapshot);
    signal.throwIfAborted();
    const candidateDigest = await workspaceDigest(snapshot);
    for (const target of [
      "calculator",
      "cost-tracker",
      ...(options.profile === "production"
        ? (["calculator-instant"] as const)
        : []),
    ] as ManagedTarget[]) {
      signal.throwIfAborted();
      const app = target === "calculator-instant" ? "calculator" : target;
      const port = await reservePort();
      reservations.push(port);
      const socket = app === "calculator" ? await reservePort() : undefined;
      if (socket) reservations.push(socket);
      const image = resolve(directory, target);
      records.set(target, {
        app,
        port,
        socket,
        image,
        directory: resolve(image, "apps", app),
        environment: { NODE_ENV: options.profile },
        children: [],
        materialized: false,
      });
    }
    const calculatorBase = `http://127.0.0.1:${records.get("calculator")!.port.port}`;
    const costBase = `http://127.0.0.1:${records.get("cost-tracker")!.port.port}`;
    for (const [target, record] of records) {
      record.environment = Object.freeze({
        ...process.env,
        ...environments[record.app],
        DATABASE_URL: run.databaseUrl,
        TEST_RUN_ID: run.runId,
        CALCULATOR_TEST_BASE_URL:
          target === "calculator-instant"
            ? `http://127.0.0.1:${record.port.port}`
            : calculatorBase,
        COST_TRACKER_TEST_BASE_URL: costBase,
        NEXT_PUBLIC_BASE_URL: `http://127.0.0.1:${record.port.port}`,
        ...(record.socket
          ? {
              SOCKET_PORT: String(record.socket.port),
              NEXT_PUBLIC_SOCKET_URL: `http://127.0.0.1:${record.socket.port}`,
            }
          : {}),
        PORT: String(record.port.port),
        COST_TRACKER_PORT: String(record.port.port),
        NODE_ENV: options.profile,
        NEXT_TELEMETRY_DISABLED: "1",
        EXPOSE_TESTING_API: target === "calculator-instant" ? "1" : "0",
        MANAGED_WORKSPACE_ROOT: root,
      });
    }
    acquired = true;
    signal.throwIfAborted();
    const launch = async (
      target: ManagedTarget,
      command: string,
      args: string[],
      name: string,
    ) => {
      signal.throwIfAborted();
      const record = records.get(target)!;
      const log = await open(
        resolve(evidenceDirectory, `${target}-${name}.log`),
        "a",
        0o600,
      );
      try {
        const child = spawn(command, args, {
          cwd: record.directory,
          env: record.environment,
          detached: true,
          stdio: ["ignore", log.fd, log.fd],
        });
        const handle = { pid: child.pid, owned: true };
        ownedProcesses.add(handle);
        const completion = new Promise<void>((resolve, reject) => {
          child.once("error", () =>
            reject(new Error("Managed child could not start.")),
          );
          child.once("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error("Managed child exited unsuccessfully.")),
          );
        });
        void completion.catch(() => {});
        const owned = { child, handle, failed: false, completion };
        record.children.push(owned);
        child.once("error", () => {
          owned.failed = true;
        });
        await persist(target, "starting");
        return owned;
      } finally {
        await log.close();
      }
    };
    const command = async (
      target: ManagedTarget,
      args: string[],
      name: string,
    ) => {
      const owned = await launch(target, process.execPath, args, name);
      await new Promise<void>((resolve, reject) => {
        const fail = () =>
          finish(new Error("Managed build failed or interrupted."));
        const timer = setTimeout(fail, options.buildTimeoutMs ?? 900_000);
        const finish = (error?: Error) => {
          clearTimeout(timer);
          signal.removeEventListener("abort", fail);
          if (error) reject(error);
          else resolve();
        };
        signal.addEventListener("abort", fail, { once: true });
        void owned.completion.then(
          () => finish(),
          () => finish(new Error("Managed build failed.")),
        );
        if (signal.aborted) fail();
      });
      await stopChildren(target);
    };
    const start = (target: Target<P>) =>
      serial(async (): Promise<ReadyApp> => {
        if (closed) throw new Error("Managed app run is stopped.");
        const record = records.get(target);
        if (!record) throw new Error("Unsupported managed app target.");
        if (
          record.materialized &&
          (await workspaceDigest(snapshot, record.image)) !== candidateDigest
        )
          throw new Error("Managed source changed; artifact reuse refused.");
        if (record.ready) {
          if (!alive(record))
            throw new Error("Managed app lost its owned child.");
          return record.ready;
        }
        try {
          signal.throwIfAborted();
          if (!record.materialized) {
            await copyWorkspaceSource(snapshot, record.image);
            await linkWorkspaceDependencies(root, record.image);
            const configuration: {
              compilerOptions?: { paths?: Record<string, string[]> };
            } = JSON.parse(
              await readFile(resolve(record.directory, "tsconfig.json"), "utf8"),
            );
            const types = `./.next/test-runs/${run.runId}/${options.profile === "development" ? "dev/" : ""}types/*`;
            await writeFile(
              resolve(record.directory, `.tsconfig-test-${run.runId}.json`),
              JSON.stringify({
                ...configuration,
                compilerOptions: {
                  ...configuration.compilerOptions,
                  paths: {
                    ...configuration.compilerOptions?.paths,
                    "#next-routes/*": [types],
                  },
                },
              }),
            );
            record.materialized = true;
          }
          const next = resolve(
            record.directory,
            "node_modules/next/dist/bin/next",
          );
          if (options.profile === "production" && !record.artifact) {
            if (record.app === "calculator") {
              const sri = resolve(record.directory, "src/lib/orpc/scalar-sri.ts");
              const reviewed = await readFile(sri, "utf8").catch((error) => {
                if ((error as NodeJS.ErrnoException).code === "ENOENT")
                  return undefined;
                throw error;
              });
              await command(target, ["scripts/generate-sri.js"], "sri");
              if (
                reviewed !== undefined &&
                (await readFile(sri, "utf8")) !== reviewed
              )
                throw new Error(
                  "Calculator SRI differs from reviewed source; rebuild requires a reviewed source update.",
                );
              await command(target, ["scripts/check-sri.js"], "sri-check");
            }
            await command(target, [next, "build"], "build");
            const buildId = (
              await readFile(
                resolve(
                  record.directory,
                  `.next/test-runs/${run.runId}/BUILD_ID`,
                ),
                "utf8",
              )
            ).trim();
            if (!buildId)
              throw new Error("Missing production artifact identity.");
            record.artifact = {
              candidateDigest,
              configurationDigest: createHash("sha256")
                .update(JSON.stringify(record.environment))
                .digest("hex"),
              variant: target === "calculator-instant" ? "instant" : "ordinary",
              buildId,
            };
            await persist(target, "built");
          }
          if (record.socket) {
            await record.socket.release();
            const { child } = await launch(
              target,
              process.execPath,
              ["--import", "tsx", "src/socket-server.ts"],
              "socket",
            );
            await waitForSocket(
              record,
              child,
              run.runId,
              signal,
              options.readinessTimeoutMs ?? 120_000,
            );
          }
          await record.port.release();
          await launch(
            target,
            process.execPath,
            [
              next,
              options.profile === "production" ? "start" : "dev",
              "--port",
              String(record.port.port),
              "--hostname",
              "127.0.0.1",
            ],
            "next",
          );
          await waitForApp(
            record,
            run.runId,
            signal,
            options.readinessTimeoutMs ?? 120_000,
          );
          if ((await workspaceDigest(snapshot, record.image)) !== candidateDigest)
            throw new Error("Managed source changed during build or startup.");
          record.ready = Object.freeze({
            directory: record.directory,
            baseUrl: record.environment.NEXT_PUBLIC_BASE_URL!,
            environment: record.environment,
            runtime: record.artifact
              ? { kind: "production" as const, artifact: record.artifact }
              : { kind: "development" as const },
          });
          await persist(target, "ready");
          return record.ready;
        } catch (error) {
          try {
            await stopChildren(target);
            await persist(target, "startup-failed");
          } catch (cleanupError) {
            throw new AggregateError(
              [error, cleanupError],
              "Managed startup and cleanup failed; resources retained.",
            );
          }
          throw new Error("Managed application startup failed.", {
            cause: error,
          });
        }
      });
    return {
      start,
      stop,
      evidenceDirectory,
      release: (target) =>
        serial(async () => {
          const record = records.get(target);
          if (!record) throw new Error("Unsupported managed app target.");
          await stopChildren(target);
          await persist(target, "released");
        }),
    };
  } catch (error) {
    try {
      await stop();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Managed acquisition and cleanup failed; resources retained.",
      );
    }
    throw error;
  }
}

export interface ManagedAppServers {
  calculatorBaseUrl: string;
  costTrackerBaseUrl: string;
  environment: Record<string, string>;
  stop(): Promise<void>;
}

/** Compatibility operation for consumers that require both development apps. */
export async function startManagedAppServers(
  root: string,
  run: ManagedRun,
  environments: Record<AppTarget, Record<string, string>>,
  options: ManagedServerOptions = {},
): Promise<ManagedAppServers> {
  const apps = await createManagedAppRun(root, run, environments, {
    ...options,
    profile: "development",
  });
  try {
    const calculator = await apps.start("calculator");
    const costTracker = await apps.start("cost-tracker");
    return {
      calculatorBaseUrl: calculator.baseUrl,
      costTrackerBaseUrl: costTracker.baseUrl,
      environment: {
        TEST_RUN_ID: run.runId,
        CALCULATOR_TEST_BASE_URL: calculator.baseUrl,
        COST_TRACKER_TEST_BASE_URL: costTracker.baseUrl,
      },
      stop: () => apps.stop(),
    };
  } catch (error) {
    try {
      await apps.stop();
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Managed application startup and cleanup failed.",
      );
    }
    throw error;
  }
}
