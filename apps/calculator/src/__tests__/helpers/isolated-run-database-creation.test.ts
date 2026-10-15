// @vitest-environment node
import { inspect } from "node:util";

import { beforeEach, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    query = admin.query;
    end = admin.end;
  },
}));
import {
  createIsolatedRunDatabase,
  disposeIsolatedRunDatabase,
  IsolatedRunCreationError,
} from "@/__tests__/helpers/isolated-run-database";

const options = {
  baseDatabaseUrl: "postgres://postgres@localhost/postgres",
  prefix: "creation_check",
};
beforeEach(() => {
  vi.resetAllMocks();
  admin.end.mockResolvedValue(undefined);
});
it("keeps credential-bearing disposal handles out of thrown error diagnostics", async () => {
  const password = "credential-leak-regression";
  admin.query
    .mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(new Error("marker failed"))
    .mockRejectedValueOnce(new Error("rollback failed"));
  const error = await createIsolatedRunDatabase({
    ...options,
    baseDatabaseUrl: `postgres://postgres:${password}@localhost/postgres`,
  }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(IsolatedRunCreationError);
  if (!(error instanceof IsolatedRunCreationError))
    throw new Error("Missing handle");
  expect(Object.getOwnPropertyDescriptor(error, "handle")?.enumerable).toBe(
    false,
  );
  expect(error.name).toBe("IsolatedRunCreationError");
  expect(error.message).toContain("rollback failed");
  for (const diagnostic of [
    JSON.stringify(error),
    JSON.stringify(error.toJSON()),
    inspect(error),
    String(error),
  ]) {
    expect(diagnostic).not.toContain(password);
    expect(diagnostic).not.toContain(error.handle.databaseUrl);
    expect(diagnostic).not.toContain(error.handle.baseDatabaseUrl);
  }
  expect(error.handle.databaseUrl).toContain(password);
  admin.query
    .mockResolvedValueOnce({
      rows: [{ marker: `greendex-test-run:${error.handle.runId}` }],
    })
    .mockResolvedValueOnce({ rows: [] });
  await disposeIsolatedRunDatabase(error.handle);
  expect(admin.query.mock.lastCall?.[0]).toMatch(/^DROP DATABASE/);
});

it("completes marker-failure disposal while retaining a credential-safe error handle", async () => {
  const password = "marker-failure-credential";
  const dropped: string[] = [];
  let closed = false;
  admin.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith("COMMENT")) throw new Error("marker failed");
    if (sql.startsWith("DROP")) dropped.push(sql);
    return { rows: [] };
  });
  admin.end.mockImplementation(async () => {
    closed = true;
  });
  const error = await createIsolatedRunDatabase({
    ...options,
    baseDatabaseUrl: `postgres://postgres:${password}@localhost/postgres`,
  }).catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(IsolatedRunCreationError);
  if (!(error instanceof IsolatedRunCreationError))
    throw new Error("Missing handle");
  expect(error.rollback).toBe("disposed");
  expect(dropped).toEqual([
    `DROP DATABASE "${error.handle.databaseName}" WITH (FORCE)`,
  ]);
  expect(closed).toBe(true);
  expect(error.handle.databaseUrl).toContain(password);
  expect(error.handle.baseDatabaseUrl).toContain(password);
  for (const diagnostic of [
    JSON.stringify(error),
    JSON.stringify(error.toJSON()),
    inspect(error),
    String(error),
  ]) {
    expect(diagnostic).not.toContain(password);
    expect(diagnostic).not.toContain(error.handle.databaseUrl);
    expect(diagnostic).not.toContain(error.handle.baseDatabaseUrl);
  }
});

it("focused lifecycle retries only failed creation rollback", async () => {
  let prepare: (() => Promise<void>) | undefined;
  vi.doMock("vitest", async (importOriginal) => ({
    ...(await importOriginal<typeof import("vitest")>()),
    beforeAll: (hook: () => Promise<void>) => {
      prepare = hook;
    },
    afterAll: vi.fn(),
    describe: vi.fn(),
  }));
  vi.stubEnv("GREENDEX_AGGREGATE_TEST_RUN", "false");
  try {
    await import("@/__tests__/isolated-lifecycle.integration.test");
    if (!prepare) throw new Error("Missing lifecycle preparation hook");
    for (const rollback of ["failed", "disposed"] as const) {
      let marker: string | undefined;
      let attempts = 0;
      let completed = 0;
      admin.query.mockImplementation(async (sql: string) => {
        if (sql.startsWith("COMMENT")) {
          marker = sql.split("'")[1];
          throw new Error("marker failed");
        }
        if (sql.startsWith("SELECT")) return { rows: [{ marker }] };
        if (sql.startsWith("DROP")) {
          attempts++;
          if (rollback === "failed" && attempts === 1)
            throw new Error("rollback failed");
          completed++;
          marker = undefined;
        }
        return { rows: [] };
      });
      const error = await prepare().catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(IsolatedRunCreationError);
      if (!(error instanceof IsolatedRunCreationError))
        throw new Error("Missing creation error");
      expect(error.rollback).toBe(rollback);
      expect(attempts).toBe(rollback === "failed" ? 2 : 1);
      expect(completed).toBe(1);
    }
  } finally {
    vi.doUnmock("vitest");
    vi.unstubAllEnvs();
  }
});

it("rolls back successful CREATE if writing the marker fails", async () => {
  admin.query
    .mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(new Error("marker failed"))
    .mockResolvedValueOnce({ rows: [] });
  await expect(createIsolatedRunDatabase(options)).rejects.toMatchObject({
    rollback: "disposed",
    handle: { databaseName: expect.stringMatching(/^creation_check_/) },
  });
  expect(admin.query.mock.calls[2]![0]).toMatch(
    /^DROP DATABASE "creation_check_[a-f0-9]{32}" WITH \(FORCE\)$/,
  );
});
it("rolls back successful CREATE if marker readback fails", async () => {
  admin.query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(new Error("readback failed"))
    .mockResolvedValueOnce({ rows: [] });
  await expect(createIsolatedRunDatabase(options)).rejects.toMatchObject({
    rollback: "disposed",
  });
  expect(admin.query.mock.calls[3]![0]).toMatch(/^DROP DATABASE/);
});
it("retains a disposable handle when connection close fails after preparation", async () => {
  admin.query.mockImplementation(async (sql: string) => {
    if (sql.startsWith("SELECT")) {
      const comment = admin.query.mock.calls.find(([statement]) =>
        statement.startsWith("COMMENT"),
      )![0] as string;
      return {
        rows: [{ marker: comment.match(/greendex-test-run:[a-f0-9]{32}/)![0] }],
      };
    }
    return { rows: [] };
  });
  admin.end.mockRejectedValueOnce(new Error("connection close failed"));
  const error = await createIsolatedRunDatabase(options).catch(
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(IsolatedRunCreationError);
  if (!(error instanceof IsolatedRunCreationError))
    throw new Error("Missing handle");
  expect(error.rollback).toBe("failed");
  await disposeIsolatedRunDatabase(error.handle);
  expect(admin.query.mock.lastCall?.[0]).toMatch(/^DROP DATABASE/);
});

it("never drops a database whose CREATE failed", async () => {
  admin.query.mockRejectedValueOnce(new Error("creation failed"));
  await expect(createIsolatedRunDatabase(options)).rejects.toThrow(
    "creation failed",
  );
  expect(admin.query).toHaveBeenCalledTimes(1);
});
it("retains the disposal handle and cleanup failure if rollback fails", async () => {
  admin.query
    .mockResolvedValueOnce({ rows: [] })
    .mockRejectedValueOnce(new Error("marker failed"))
    .mockRejectedValueOnce(new Error("rollback failed"));
  await expect(createIsolatedRunDatabase(options)).rejects.toMatchObject({
    rollback: "failed",
    handle: { databaseName: expect.stringMatching(/^creation_check_/) },
    cause: expect.any(AggregateError),
  });
});
