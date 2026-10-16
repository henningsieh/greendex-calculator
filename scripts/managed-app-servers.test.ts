import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  assertManagedRun,
  isManagedAuthReady,
  startManagedAppServers,
  stopOwnedProcess,
} from "./managed-app-servers";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "greendex-managed-test-"));
  for (const app of ["calculator", "cost-tracker"]) {
    const path = join(root, "apps", app);
    await mkdir(join(path, "node_modules/next/dist/bin"), { recursive: true });
    await writeFile(join(path, "tsconfig.json"), "{}");
    await writeFile(join(path, "next-env.d.ts"), "dev baseline");
    await writeFile(
      join(path, "node_modules/next/dist/bin/next"),
      `
      const {createServer} = require('node:http');
      const {writeFileSync} = require('node:fs');
      writeFileSync('owned-pid', String(process.pid));
      writeFileSync('next-env.d.ts', '.next/test-runs/' + process.env.TEST_RUN_ID + '/dev/types/routes.d.ts');
      if (process.env.FAIL_START === 'true') process.exit(1);
      const port = process.argv[process.argv.indexOf('--port') + 1];
      createServer((req,res) => {
        if (req.url === '/api/rpc') {
          writeFileSync('rpc-warmed', 'compiled');
          res.statusCode = process.env.FAIL_RPC === 'true' ? 500 : 404;
          res.end(process.env.INVALID_RPC_BODY === 'true' ? 'unexpected' : 'Not found');
          return;
        }
        if (process.env.NOT_READY === 'true') res.statusCode = 503;
        res.setHeader('X-Greendex-Test-Run', process.env.TEST_RUN_ID);
        res.end('null');
      }).listen(port, '127.0.0.1');
    `,
    );
  }
  return root;
}

async function assertStopped(root: string) {
  for (const app of ["calculator", "cost-tracker"]) {
    const pid = Number(
      await readFile(join(root, "apps", app, "owned-pid"), "utf8"),
    );
    expect(() => process.kill(pid, 0)).toThrow();
    await expect(
      readFile(join(root, "apps", app, `.tsconfig-test-${"a".repeat(32)}.json`)),
    ).rejects.toThrow();
    expect(await readFile(join(root, "apps", app, "tsconfig.json"), "utf8")).toBe(
      "{}",
    );
    expect(await readFile(join(root, "apps", app, "next-env.d.ts"), "utf8")).toBe(
      "dev baseline",
    );
  }
}

describe("managed-app-servers", () => {
  it("rejects readiness from an unrelated server or a failed auth endpoint", async () => {
    const runId = "a".repeat(32);
    expect(await isManagedAuthReady(new Response("null"), runId)).toBe(false);
    expect(
      await isManagedAuthReady(
        new Response("null", {
          headers: { "X-Greendex-Test-Run": "b".repeat(32) },
        }),
        runId,
      ),
    ).toBe(false);
    expect(
      await isManagedAuthReady(
        new Response("null", {
          status: 500,
          headers: { "X-Greendex-Test-Run": runId },
        }),
        runId,
      ),
    ).toBe(false);
    expect(
      await isManagedAuthReady(
        new Response("{}", { headers: { "X-Greendex-Test-Run": runId } }),
        runId,
      ),
    ).toBe(false);
    expect(
      await isManagedAuthReady(
        new Response("null", { headers: { "X-Greendex-Test-Run": runId } }),
        runId,
      ),
    ).toBe(true);
  });
  it("refuses absent ownership and ordinary databases", () => {
    expect(() => assertManagedRun({ runId: "", databaseUrl: "" })).toThrow();
    expect(() =>
      assertManagedRun({
        runId: "a".repeat(32),
        databaseUrl: "postgres://localhost/development",
      }),
    ).toThrow();
    expect(() =>
      assertManagedRun({
        runId: "a".repeat(32),
        databaseUrl: `postgres://localhost/mail_check_${"b".repeat(32)}`,
      }),
    ).toThrow();
  });
  it("accepts only the exact run-owned database identity", () => {
    expect(() =>
      assertManagedRun({
        runId: "a".repeat(32),
        databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
      }),
    ).not.toThrow();
  });
  it("owns separate servers and cleans both after success without changing dev config", async () => {
    const root = await fixture();
    let servers: Awaited<ReturnType<typeof startManagedAppServers>> | undefined;
    try {
      servers = await startManagedAppServers(
        root,
        {
          runId: "a".repeat(32),
          databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
        },
        { calculator: {}, "cost-tracker": {} },
      );
      expect(servers.calculatorBaseUrl).not.toBe(servers.costTrackerBaseUrl);
      expect(servers.environment.TEST_RUN_ID).toBe("a".repeat(32));
      for (const app of ["calculator", "cost-tracker"])
        expect(
          await readFile(join(root, "apps", app, "rpc-warmed"), "utf8"),
        ).toBe("compiled");
      await servers.stop();
      await assertStopped(root);
    } finally {
      await servers?.stop();
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
  it("stops the first owned server when the second fails readiness", async () => {
    const root = await fixture();
    try {
      await expect(
        startManagedAppServers(
          root,
          {
            runId: "a".repeat(32),
            databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
          },
          { calculator: {}, "cost-tracker": { FAIL_START: "true" } },
        ),
      ).rejects.toThrow();
      await assertStopped(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
  it.each(["FAIL_RPC", "INVALID_RPC_BODY"])(
    "fails closed and cleans owned servers when RPC warmup has %s",
    async (failure) => {
      const root = await fixture();
      let servers: Awaited<ReturnType<typeof startManagedAppServers>> | undefined;
      try {
        await expect(
          (async () => {
            servers = await startManagedAppServers(
              root,
              {
                runId: "a".repeat(32),
                databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
              },
              { calculator: {}, "cost-tracker": { [failure]: "true" } },
            );
          })(),
        ).rejects.toThrow("Managed application startup failed");
        await assertStopped(root);
      } finally {
        await servers?.stop();
        await rm(root, { recursive: true, force: true });
      }
    },
    30_000,
  );
  it("serializes overlapping runs for the complete declaration lifetime", async () => {
    const root = await fixture();
    let first: Awaited<ReturnType<typeof startManagedAppServers>> | undefined;
    let second: Awaited<ReturnType<typeof startManagedAppServers>> | undefined;
    let pending:
      | Promise<Awaited<ReturnType<typeof startManagedAppServers>>>
      | undefined;
    try {
      first = await startManagedAppServers(
        root,
        {
          runId: "a".repeat(32),
          databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
        },
        { calculator: {}, "cost-tracker": {} },
      );
      pending = startManagedAppServers(
        root,
        {
          runId: "b".repeat(32),
          databaseUrl: `postgres://localhost/mail_check_${"b".repeat(32)}`,
        },
        { calculator: {}, "cost-tracker": {} },
      ).then((value) => {
        second = value;
        return value;
      });
      expect(
        await Promise.race([
          pending.then(() => "started"),
          new Promise((resolve) => setTimeout(() => resolve("waiting"), 1000)),
        ]),
      ).toBe("waiting");
      for (const app of ["calculator", "cost-tracker"])
        expect(
          await readFile(join(root, "apps", app, "next-env.d.ts"), "utf8"),
        ).toContain("a".repeat(32));
      await first.stop();
      second = await pending;
      for (const app of ["calculator", "cost-tracker"])
        expect(
          await readFile(join(root, "apps", app, "next-env.d.ts"), "utf8"),
        ).toContain("b".repeat(32));
      await second.stop();
      await assertStopped(root);
    } finally {
      await first?.stop().catch(() => {});
      if (pending) await pending.then((value) => value.stop()).catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
  it.each(["timeout", "abort"])(
    "bounds ownership acquisition on %s without releasing another run's lock",
    async (mode) => {
      const root = await fixture();
      const controller = new AbortController();
      const first = await startManagedAppServers(
        root,
        {
          runId: "a".repeat(32),
          databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
        },
        { calculator: {}, "cost-tracker": {} },
      );
      try {
        const pending = startManagedAppServers(
          root,
          {
            runId: "b".repeat(32),
            databaseUrl: `postgres://localhost/mail_check_${"b".repeat(32)}`,
          },
          { calculator: {}, "cost-tracker": {} },
          {
            signal: controller.signal,
            ownershipTimeoutMs: mode === "timeout" ? 100 : 5000,
          },
        );
        const rejected = expect(pending).rejects.toThrow(
          mode === "timeout" ? /acquisition timed out/ : /abort/i,
        );
        if (mode === "abort") controller.abort();
        await rejected;
        expect(
          await readFile(join(root, "apps/calculator/next-env.d.ts"), "utf8"),
        ).toContain("a".repeat(32));
        await first.stop();
        await assertStopped(root);
      } finally {
        await first.stop();
        await rm(root, { recursive: true, force: true });
      }
    },
    30_000,
  );
  it.each(["abort", "observation failure"])(
    "releases ownership and restores declarations after an aborted startup (%s)",
    async (mode) => {
      const root = await fixture();
      const controller = new AbortController();
      const fetch = globalThis.fetch;
      const readiness = vi.spyOn(globalThis, "fetch");
      const observed = new Promise<void>((resolve) => {
        readiness.mockImplementation(async (...args) => {
          const response = await fetch(...args);
          if (
            response.status === 503 &&
            response.headers.get("X-Greendex-Test-Run") === "a".repeat(32)
          )
            resolve();
          return response;
        });
      });
      const pending = startManagedAppServers(
        root,
        {
          runId: "a".repeat(32),
          databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
        },
        { calculator: { NOT_READY: "true" }, "cost-tracker": {} },
        { signal: controller.signal },
      );
      let recovered:
        | Awaited<ReturnType<typeof startManagedAppServers>>
        | undefined;
      let observationError: unknown;
      try {
        try {
          await Promise.race([observed, pending]);
          if (mode === "observation failure")
            throw new Error("Readiness observation failed");
        } catch (error) {
          observationError = error;
        } finally {
          controller.abort();
          await pending.then(
            (servers) => servers.stop(),
            () => {},
          );
        }
        expect(observationError).toEqual(
          mode === "observation failure"
            ? new Error("Readiness observation failed")
            : undefined,
        );
        await expect(pending).rejects.toThrow(/startup failed/);
        const pid = Number(
          await readFile(join(root, "apps/calculator/owned-pid"), "utf8"),
        );
        expect(() => process.kill(pid, 0)).toThrow();
        expect(
          await readFile(join(root, "apps/calculator/next-env.d.ts"), "utf8"),
        ).toBe("dev baseline");
        await expect(
          readFile(join(root, ".turbo/managed-app-declarations.lock")),
        ).rejects.toThrow();
        recovered = await startManagedAppServers(
          root,
          {
            runId: "a".repeat(32),
            databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
          },
          { calculator: {}, "cost-tracker": {} },
        );
        await recovered.stop();
        await assertStopped(root);
      } finally {
        await recovered?.stop();
        readiness.mockRestore();
        await rm(root, { recursive: true, force: true });
      }
    },
    30_000,
  );
  it("refuses to release a replaced ownership record", async () => {
    const root = await fixture();
    const servers = await startManagedAppServers(
      root,
      {
        runId: "a".repeat(32),
        databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
      },
      { calculator: {}, "cost-tracker": {} },
    );
    try {
      const lock = join(root, ".turbo/managed-app-declarations.lock");
      await rm(lock);
      await writeFile(lock, "external owner");
      await expect(servers.stop()).rejects.toThrow("cleanup failed");
      expect(await readFile(lock, "utf8")).toBe("external owner");
      await assertStopped(root);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
  it("preserves concurrent external declarations and reports cleanup failure", async () => {
    const root = await fixture();
    let servers: Awaited<ReturnType<typeof startManagedAppServers>> | undefined;
    try {
      servers = await startManagedAppServers(
        root,
        {
          runId: "a".repeat(32),
          databaseUrl: `postgres://localhost/mail_check_${"a".repeat(32)}`,
        },
        { calculator: {}, "cost-tracker": {} },
      );
      const path = join(root, "apps/calculator/next-env.d.ts");
      await writeFile(path, "external dev update");
      await expect(servers.stop()).rejects.toThrow("cleanup failed");
      expect(await readFile(path, "utf8")).toBe("external dev update");
    } finally {
      await servers?.stop().catch(() => {});
      await rm(root, { recursive: true, force: true });
    }
  }, 30_000);
  it("stops only a process handle with an owned process group", async () => {
    await expect(
      stopOwnedProcess({ pid: process.pid, owned: false }),
    ).rejects.toThrow();
  });
});
