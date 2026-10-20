import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  assertManagedRun,
  createManagedAppRun,
  isManagedAuthReady,
  ManagedCommandCleanupError,
  ManagedAppCleanupError,
  runManagedCommand,
  startManagedAppServers,
  stopOwnedProcess,
} from "./managed-app-servers";

const runId = "a".repeat(32);
const run = { runId, databaseUrl: `postgres://localhost/mail_check_${runId}` };
const require = createRequire(import.meta.url);

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "greendex-managed-test-"));
  await mkdir(join(root, "packages/shared"), { recursive: true });
  await writeFile(join(root, "packages/shared/source.ts"), "reviewed package");
  await writeFile(join(root, ".env"), "DO_NOT_COPY=secret");
  for (const app of ["calculator", "cost-tracker"]) {
    const path = join(root, "apps", app);
    await mkdir(join(path, "node_modules/next/dist/bin"), { recursive: true });
    await mkdir(join(path, "node_modules/@greendex"), { recursive: true });
    await symlink(
      join(root, "packages/shared"),
      join(path, "node_modules/@greendex/shared"),
    );
    await symlink(
      dirname(require.resolve("tsx/package.json")),
      join(path, "node_modules/tsx"),
    );
    await mkdir(join(path, "src/lib/orpc"), { recursive: true });
    await mkdir(join(path, "scripts"), { recursive: true });
    await writeFile(join(path, "tsconfig.json"), "{}");
    await writeFile(join(path, "next-env.d.ts"), "dev baseline");
    await writeFile(join(path, "src/lib/orpc/scalar-sri.ts"), "reviewed SRI");
    await writeFile(
      join(path, "scripts/generate-sri.js"),
      `if(process.env.CHANGE_SRI) require('node:fs').writeFileSync('src/lib/orpc/scalar-sri.ts', 'unreviewed SRI');`,
    );
    await writeFile(join(path, "scripts/check-sri.js"), "process.exit(0)");
    await writeFile(
      join(path, "src/socket-server.ts"),
      `
      import {createServer} from 'node:http';
      if (process.env.FAIL_SOCKET) process.exit(1);
      createServer((req,res) => {
        res.setHeader('X-Greendex-Test-Run', process.env.TEST_RUN_ID);
        res.end(process.env.WRONG_SOCKET_PID ? '1' : String(process.pid));
      }).listen(process.env.SOCKET_PORT, '127.0.0.1');
    `,
    );
    await writeFile(
      join(path, "node_modules/next/dist/bin/next"),
      `
      const {createServer} = require('node:http');
      const {writeFileSync,mkdirSync,readFileSync} = require('node:fs');
      const mode = process.argv[2];
      writeFileSync(mode + '-environment.json', JSON.stringify(process.env));
      writeFileSync('next-env.d.ts', '.next/test-runs/' + process.env.TEST_RUN_ID + '/types/routes.d.ts');
      if(mode === 'build') {
        if(process.env.FAIL_BUILD) process.exit(1);
        const dist = '.next/test-runs/' + process.env.TEST_RUN_ID;
        mkdirSync(dist, {recursive:true});
        writeFileSync(dist + '/BUILD_ID', 'fixture-' + process.env.EXPOSE_TESTING_API);
        process.exit(0);
      }
      writeFileSync('owned-pid', String(process.pid));
      if (process.env.FAIL_START) process.exit(1);
      const port = process.argv[process.argv.indexOf('--port') + 1];
      createServer((req,res) => {
        if(req.url === '/api/rpc') {
          writeFileSync('rpc-warmed', 'compiled');
          res.statusCode = process.env.FAIL_RPC ? 500 : 404;
          res.end(process.env.INVALID_RPC_BODY ? 'unexpected' : 'Not found'); return;
        }
        if (process.env.NOT_READY) res.statusCode = 503;
        res.setHeader('X-Greendex-Test-Run', process.env.WRONG_RUN || process.env.TEST_RUN_ID);
        res.end('null');
      }).listen(port, '127.0.0.1');
    `,
    );
  }
  return root;
}

async function withRun(
  test: (
    apps: Awaited<ReturnType<typeof createManagedAppRun<"production">>>,
    root: string,
  ) => Promise<void>,
  environments = { calculator: {}, "cost-tracker": {} },
) {
  const root = await fixture();
  const apps = await createManagedAppRun(root, run, environments, {
    profile: "production",
    readinessTimeoutMs: 1500,
  });
  try {
    await test(apps, root);
  } finally {
    await apps.stop();
    await rm(dirname(apps.evidenceDirectory), { recursive: true, force: true });
    await rm(root, { recursive: true, force: true });
  }
}

describe("managed app lifecycle", () => {
  it("distinguishes unconfirmed command shutdown from an ordinary task failure", async () => {
    const kill = process.kill.bind(process);
    let group: number | undefined;
    const termination = vi
      .spyOn(process, "kill")
      .mockImplementation((pid, signal) => {
        if (signal === "SIGTERM") {
          group = pid;
          throw new Error("termination refused");
        }
        return kill(pid, signal);
      });
    try {
      await expect(
        runManagedCommand(
          process.execPath,
          ["-e", "setInterval(() => {}, 1000)"],
          {
            cwd: import.meta.dirname,
            env: process.env,
            timeoutMs: 50,
          },
        ),
      ).rejects.toThrow(ManagedCommandCleanupError);
    } finally {
      termination.mockRestore();
      if (group !== undefined) kill(group, "SIGKILL");
    }
  });
  it.each(["development", "production"] as const)(
    "maps route types to the %s artifact without modifying checkout configuration",
    async (profile) => {
      const root = await fixture();
      const original = JSON.stringify({
        compilerOptions: {
          strict: true,
          paths: { "@/*": ["./src/*"], "#next-routes/*": ["./.next/types/*"] },
        },
      });
      await writeFile(join(root, "apps/cost-tracker/tsconfig.json"), original);
      const apps = await createManagedAppRun(
        root,
        run,
        { calculator: {}, "cost-tracker": {} },
        { profile },
      );
      try {
        const app = await apps.start("cost-tracker");
        const configuration = JSON.parse(
          await readFile(
            join(app.directory, `.tsconfig-test-${runId}.json`),
            "utf8",
          ),
        );
        expect(configuration.compilerOptions).toEqual({
          strict: true,
          paths: {
            "@/*": ["./src/*"],
            "#next-routes/*": [
              `./.next/test-runs/${runId}/${profile === "development" ? "dev/" : ""}types/*`,
            ],
          },
        });
        expect(
          await readFile(join(root, "apps/cost-tracker/tsconfig.json"), "utf8"),
        ).toBe(original);
      } finally {
        await apps.stop();
        await rm(root, { recursive: true, force: true });
      }
    },
    10_000,
  );

  it("accepts only an exact run-owned database", () => {
    expect(() => assertManagedRun(run)).not.toThrow();
    for (const bad of [
      { runId: "", databaseUrl: "" },
      { ...run, databaseUrl: "postgres://localhost/development" },
      {
        ...run,
        databaseUrl: `postgres://localhost/mail_check_${"b".repeat(32)}`,
      },
    ])
      expect(() => assertManagedRun(bad)).toThrow();
  });

  it("requires successful run-correlated null-session readiness", async () => {
    for (const response of [
      new Response("null"),
      new Response("null", { headers: { "X-Greendex-Test-Run": "other" } }),
      new Response("null", {
        status: 500,
        headers: { "X-Greendex-Test-Run": runId },
      }),
      new Response("{}", { headers: { "X-Greendex-Test-Run": runId } }),
    ])
      expect(await isManagedAuthReady(response, runId)).toBe(false);
    expect(
      await isManagedAuthReady(
        new Response("null", { headers: { "X-Greendex-Test-Run": runId } }),
        runId,
      ),
    ).toBe(true);
  });

  it("builds exact ordinary and instant environments in distinct private images", async () => {
    await withRun(
      async (apps, root) => {
        const ordinary = await apps.start("calculator");
        expect(await apps.start("calculator")).toBe(ordinary);
        const cost = await apps.start("cost-tracker");
        const instant = await apps.start("calculator-instant");
        expect(
          new Set([ordinary.baseUrl, cost.baseUrl, instant.baseUrl]).size,
        ).toBe(3);
        for (const target of [ordinary, cost, instant]) {
          const build = JSON.parse(
            await readFile(
              join(target.directory, "build-environment.json"),
              "utf8",
            ),
          );
          const start = JSON.parse(
            await readFile(
              join(target.directory, "start-environment.json"),
              "utf8",
            ),
          );
          expect(build).toEqual(start);
          expect(build.DATABASE_URL).toBe(run.databaseUrl);
          expect(build.NEXT_PUBLIC_BASE_URL).toBe(target.baseUrl);
          expect(build.NODE_ENV).toBe("production");
          expect(target.runtime.kind).toBe("production");
          expect(
            await readFile(join(target.directory, "rpc-warmed"), "utf8"),
          ).toBe("compiled");
          const shared = await realpath(
            join(target.directory, "node_modules/@greendex/shared"),
          );
          expect(shared).toBe(resolve(target.directory, "../../packages/shared"));
          await writeFile(join(shared, "source.ts"), "private mutation");
          expect(
            await readFile(join(root, "packages/shared/source.ts"), "utf8"),
          ).toBe("reviewed package");
          await expect(
            readFile(resolve(target.directory, "../../.env")),
          ).rejects.toThrow();
        }
        expect(ordinary.environment.EXPOSE_TESTING_API).toBe("0");
        expect(instant.environment.EXPOSE_TESTING_API).toBe("1");
        expect(ordinary.runtime).toMatchObject({
          kind: "production",
          artifact: { variant: "ordinary", buildId: "fixture-0" },
        });
        expect(instant.runtime).toMatchObject({
          kind: "production",
          artifact: { variant: "instant", buildId: "fixture-1" },
        });
        const pid = Number(
          await readFile(join(ordinary.directory, "owned-pid"), "utf8"),
        );
        await apps.release("calculator");
        await apps.release("calculator");
        expect(() => process.kill(pid, 0)).toThrow();
        expect(
          await readFile(
            join(ordinary.directory, `.next/test-runs/${runId}/BUILD_ID`),
            "utf8",
          ),
        ).toBe("fixture-0");
        await apps.stop();
        await apps.stop();
        await expect(
          readFile(join(ordinary.directory, "next-env.d.ts")),
        ).rejects.toThrow();
        expect(
          await readFile(join(root, "apps/calculator/next-env.d.ts"), "utf8"),
        ).toBe("dev baseline");
        await expect(apps.start("calculator")).rejects.toThrow("stopped");
      },
      {
        calculator: {
          EXPOSE_TESTING_API: "1",
          DATABASE_URL: "postgres://localhost/development",
        },
        "cost-tracker": {},
      },
    );
  }, 20_000);

  it.each([
    "FAIL_BUILD",
    "FAIL_START",
    "FAIL_RPC",
    "INVALID_RPC_BODY",
    "FAIL_SOCKET",
    "WRONG_SOCKET_PID",
    "WRONG_RUN",
  ])(
    "isolates %s failure from the independent app",
    async (failure) => {
      await withRun(
        async (apps) => {
          await expect(apps.start("calculator")).rejects.toThrow(
            "startup failed",
          );
          const cost = await apps.start("cost-tracker");
          expect(
            (await fetch(`${cost.baseUrl}/api/auth/get-session`)).status,
          ).toBe(200);
          expect(
            JSON.parse(
              await readFile(
                join(apps.evidenceDirectory, "calculator.json"),
                "utf8",
              ),
            ).state,
          ).toBe("startup-failed");
        },
        { calculator: { [failure]: "true" }, "cost-tracker": {} },
      );
    },
    15_000,
  );

  it("fails closed when SRI generation differs from reviewed source", async () => {
    await withRun(
      async (apps, root) => {
        await expect(apps.start("calculator")).rejects.toThrow("startup failed");
        expect(
          await readFile(
            join(root, "apps/calculator/src/lib/orpc/scalar-sri.ts"),
            "utf8",
          ),
        ).toBe("reviewed SRI");
        await apps.start("cost-tracker");
      },
      { calculator: { CHANGE_SRI: "1" }, "cost-tracker": {} },
    );
  }, 10_000);

  it("interrupts startup and performs repeat-safe cleanup without touching unrelated listeners", async () => {
    const root = await fixture();
    const controller = new AbortController();
    const sentinel = createServer((_, response) => response.end("unrelated"));
    await new Promise<void>((resolve) =>
      sentinel.listen(0, "127.0.0.1", resolve),
    );
    const address = sentinel.address();
    if (!address || typeof address === "string")
      throw new Error("sentinel unavailable");
    const apps = await createManagedAppRun(
      root,
      run,
      { calculator: { NOT_READY: "1" }, "cost-tracker": {} },
      {
        profile: "development",
        signal: controller.signal,
        readinessTimeoutMs: 2000,
      },
    );
    try {
      const started = apps.start("calculator");
      const rejected = expect(started).rejects.toThrow("startup failed");
      setTimeout(() => controller.abort(), 200);
      await rejected;
      await apps.stop();
      await apps.stop();
      expect(await (await fetch(`http://127.0.0.1:${address.port}`)).text()).toBe(
        "unrelated",
      );
      const evidence = JSON.parse(
        await readFile(join(apps.evidenceDirectory, "calculator.json"), "utf8"),
      );
      expect(evidence.state).toBe("stopped");
      expect(
        await readFile(join(root, "apps/calculator/next-env.d.ts"), "utf8"),
      ).toBe("dev baseline");
    } finally {
      await apps.stop();
      await new Promise<void>((resolve) => sentinel.close(() => resolve()));
      await rm(dirname(apps.evidenceDirectory), { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  }, 10_000);

  it("preserves the paired development caller contract", async () => {
    const root = await fixture();
    const servers = await startManagedAppServers(root, run, {
      calculator: {},
      "cost-tracker": {},
    });
    try {
      expect(servers.environment).toEqual({
        TEST_RUN_ID: runId,
        CALCULATOR_TEST_BASE_URL: servers.calculatorBaseUrl,
        COST_TRACKER_TEST_BASE_URL: servers.costTrackerBaseUrl,
      });
      expect(
        await (
          await fetch(`${servers.calculatorBaseUrl}/api/auth/get-session`)
        ).text(),
      ).toBe("null");
    } finally {
      await servers.stop();
      await rm(root, { recursive: true, force: true });
    }
  }, 10_000);

  it("retains workspace and child evidence when cleanup cannot stop an owned process", async () => {
    await withRun(async (apps) => {
      const app = await apps.start("cost-tracker");
      const pid = Number(
        await readFile(join(app.directory, "owned-pid"), "utf8"),
      );
      const kill = process.kill.bind(process);
      const blocked = vi
        .spyOn(process, "kill")
        .mockImplementation((target, signal) => {
          if (target === -pid && signal === "SIGTERM")
            throw new Error("simulated termination failure");
          return kill(target, signal);
        });
      try {
        await expect(apps.release("cost-tracker")).rejects.toThrow(
          "cleanup failed",
        );
        expect(await readFile(join(app.directory, "owned-pid"), "utf8")).toBe(
          String(pid),
        );
        const evidence = JSON.parse(
          await readFile(
            join(apps.evidenceDirectory, "cost-tracker.json"),
            "utf8",
          ),
        );
        expect(evidence).toMatchObject({
          state: "cleanup-failed-resources-retained",
          pids: [pid],
        });
        expect(() => kill(pid, 0)).not.toThrow();
      } finally {
        blocked.mockRestore();
      }
      await apps.release("cost-tracker");
      expect(() => process.kill(pid, 0)).toThrow();
    });
  }, 10_000);

  it("blocks subsequent builds and retains resources after startup timeout and failed termination", async () => {
    const root = await fixture();
    const apps = await createManagedAppRun(
      root,
      run,
      { calculator: {}, "cost-tracker": { NOT_READY: "1" } },
      { profile: "production", readinessTimeoutMs: 500 },
    );
    const kill = process.kill.bind(process);
    const blocked = vi.spyOn(process, "kill").mockImplementation((pid, signal) => {
      if (signal === "SIGTERM") throw new Error("termination refused");
      return kill(pid, signal);
    });
    try {
      const failure = await apps.start("cost-tracker").catch((error: unknown) => error);
      expect(failure).toMatchObject({ name: "ManagedAppCleanupError" });
      expect(failure).toBeInstanceOf(ManagedAppCleanupError);
      expect(failure).toMatchObject({ evidenceDirectory: apps.evidenceDirectory });
      const evidence = JSON.parse(await readFile(join(apps.evidenceDirectory, "cost-tracker.json"), "utf8"));
      expect(evidence.state).toBe("cleanup-failed-resources-retained");
      const pid = Number(await readFile(join(evidence.directory, "owned-pid"), "utf8"));
      expect(evidence.pids).toEqual([pid]);
      expect(kill(pid, 0)).toBe(true);
      await expect(apps.start("calculator")).rejects.toBe(failure);
      await expect(readFile(join(dirname(apps.evidenceDirectory), "calculator/apps/calculator/build-environment.json"))).rejects.toThrow();
      await expect(apps.stop()).rejects.toBeInstanceOf(ManagedAppCleanupError);
      expect(await readFile(join(evidence.directory, `.next/test-runs/${runId}/BUILD_ID`), "utf8")).toBe("fixture-0");
      expect(kill(pid, 0)).toBe(true);
    } finally {
      blocked.mockRestore();
      const evidence = JSON.parse(await readFile(join(apps.evidenceDirectory, "cost-tracker.json"), "utf8"));
      for (const pid of evidence.pids) kill(-pid, "SIGKILL");
      await rm(root, { recursive: true, force: true });
    }
  }, 10_000);

  it("refuses an artifact after copied source changes", async () => {
    await withRun(async (apps) => {
      const app = await apps.start("cost-tracker");
      await apps.release("cost-tracker");
      await writeFile(
        resolve(app.directory, "../../packages/shared/source.ts"),
        "changed source",
      );
      await expect(apps.start("cost-tracker")).rejects.toThrow(
        "artifact reuse refused",
      );
    });
  }, 10_000);

  it("rejects pre-aborted acquisition and commands", async () => {
    const signal = AbortSignal.abort();
    await expect(
      createManagedAppRun(
        "/absent",
        run,
        { calculator: {}, "cost-tracker": {} },
        { profile: "production", signal },
      ),
    ).rejects.toThrow();
    await expect(
      runManagedCommand(process.execPath, ["-e", "process.exit(0)"], {
        cwd: process.cwd(),
        env: process.env,
        signal,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow();
  });

  it("refuses fabricated process ownership", async () => {
    await expect(
      stopOwnedProcess({ pid: process.pid, owned: true }),
    ).rejects.toThrow();
    await expect(
      stopOwnedProcess({ pid: process.pid, owned: false }),
    ).rejects.toThrow();
  });
});
