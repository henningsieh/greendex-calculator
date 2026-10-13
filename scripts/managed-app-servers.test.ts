import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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
