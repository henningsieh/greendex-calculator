// @vitest-environment node
import { readFileSync } from "node:fs";
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

it("captures preparation-error handles for focused lifecycle disposal", () => {
  const source = readFileSync(
    new URL("../isolated-lifecycle.integration.test.ts", import.meta.url),
    "utf8",
  );
  const catchBlock = source.slice(
    source.indexOf("  } catch (error) {", source.indexOf("beforeAll(async")),
  );
  expect(catchBlock).toMatch(
    /if \(error instanceof IsolatedRunCreationError\)\s*handle = error\.handle;/,
  );
  expect(catchBlock).toContain("else if (handle && !aggregate)");
  expect(catchBlock).toContain("await disposeIsolatedRunDatabase(handle)");
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
