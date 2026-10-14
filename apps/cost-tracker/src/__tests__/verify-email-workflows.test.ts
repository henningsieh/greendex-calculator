// @vitest-environment node
/* eslint-disable import/no-relative-parent-imports -- Focused runner regression across app contexts. */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const lifecycle = vi.hoisted(() => ({
  create: vi.fn(),
  dispose: vi.fn(),
  write: vi.fn(),
}));
vi.mock(
  "../../../calculator/src/__tests__/helpers/isolated-run-database",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("../../../calculator/src/__tests__/helpers/isolated-run-database")
    >()),
    createIsolatedRunDatabase: lifecycle.create,
    disposeIsolatedRunDatabase: lifecycle.dispose,
  }),
);
vi.mock("../../../../scripts/managed-app-servers", () => ({
  readLocalEnvironment: async () => ({
    DATABASE_URL: "postgres://postgres@localhost/postgres",
  }),
  startManagedAppServers: vi.fn(),
}));
vi.mock("../../scripts/email-run-safety", () => ({
  validateMailboxEnvironment: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  readFile: async () => "seed",
  writeFile: lifecycle.write,
}));

import {
  IsolatedRunCreationError,
  type IsolatedRunHandle,
} from "../../../calculator/src/__tests__/helpers/isolated-run-database";
import { verifyEmailWorkflows } from "../../scripts/verify-email-workflows";

beforeEach(() => {
  vi.clearAllMocks();
  lifecycle.dispose.mockResolvedValue(undefined);
});

describe("verify-email-workflows creation failure cleanup", () => {
  it.each(["connection-close-after-prepare", "failed rollback"])(
    "captures and disposes the handle after %s",
    async () => {
      const handle: IsolatedRunHandle = {
        runId: "a".repeat(32),
        databaseName: `email_check_${"a".repeat(32)}`,
        databaseUrl: "postgres://postgres@localhost/owned",
        baseDatabaseUrl: "postgres://postgres@localhost/postgres",
        baseDatabaseName: "postgres",
        serviceHost: "localhost",
        servicePort: "5432",
        createdAt: new Date().toISOString(),
      };
      lifecycle.create.mockRejectedValueOnce(
        new IsolatedRunCreationError(handle, "failed", new Error("private")),
      );
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        expect(await verifyEmailWorkflows()).toBe(false);
        expect(lifecycle.dispose).toHaveBeenCalledWith(handle);
        const report = JSON.parse(lifecycle.write.mock.lastCall![1]);
        expect(report.cleanup.database).toBe("disposed");
        expect(report.runId).toBe(handle.runId);
      } finally {
        log.mockRestore();
      }
    },
  );

  it("reports failed disposal rather than not-created when recovery fails", async () => {
    const handle = {
      runId: "a".repeat(32),
      databaseName: "owned",
    } as IsolatedRunHandle;
    lifecycle.create.mockRejectedValueOnce(
      new IsolatedRunCreationError(handle, "failed", new Error("private")),
    );
    lifecycle.dispose.mockRejectedValueOnce(
      new Error("private disposal failure"),
    );
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(await verifyEmailWorkflows()).toBe(false);
      expect(lifecycle.dispose).toHaveBeenCalledWith(handle);
      const report = JSON.parse(lifecycle.write.mock.lastCall![1]);
      expect(report.cleanup.database).toBe("failed");
    } finally {
      log.mockRestore();
    }
  });
});

const source = readFileSync(
  new URL("../../scripts/verify-email-workflows.ts", import.meta.url),
  "utf8",
);

describe("verify-email-workflows failure diagnostics", () => {
  it("reports only finite static stages and never the caught error", () => {
    const stages = [
      "assertion",
      "session",
      "send-accept",
      "inbox-receipt",
      "link-exercise",
      "acceptance",
    ];
    const assignments = [...source.matchAll(/failureStage = "([^"]+)"/g)];
    expect(assignments.length).toBeGreaterThan(stages.length);
    for (const assignment of assignments) expect(stages).toContain(assignment[1]);
    expect(source).toContain('failureStage = "assertion";\n    try {');
    expect(source).toContain(
      'catch {\n      results.push({\n        workflow,\n        failureStage,\n        status: "failed",',
    );
    const check = source.slice(
      source.indexOf("  const check = async ("),
      source.indexOf("    const environments = {"),
    );
    expect(check).not.toMatch(/catch\s*\(/);
  });
});
