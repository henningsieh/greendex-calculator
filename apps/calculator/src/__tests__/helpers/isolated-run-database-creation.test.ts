// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn() }));
vi.mock("pg", () => ({
  Pool: class {
    query = admin.query;
    end = admin.end;
  },
}));
import { createIsolatedRunDatabase } from "@/__tests__/helpers/isolated-run-database";

const options = {
  baseDatabaseUrl: "postgres://postgres@localhost/postgres",
  prefix: "creation_check",
};
beforeEach(() => {
  vi.resetAllMocks();
  admin.end.mockResolvedValue(undefined);
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
