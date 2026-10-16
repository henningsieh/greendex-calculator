// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import type { IsolatedRunHandle } from "@/__tests__/helpers/isolated-run-database";
import { cleanupLifecycleResources } from "@/__tests__/helpers/lifecycle-cleanup";

const handle: IsolatedRunHandle = {
  runId: "a".repeat(32),
  databaseName: "owned",
  databaseUrl: "postgres://localhost/owned",
  baseDatabaseUrl: "postgres://localhost/postgres",
  baseDatabaseName: "postgres",
  serviceHost: "localhost",
  servicePort: "5432",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("lifecycle resource cleanup", () => {
  it.each(["pool", "database", "both"])(
    "retains %s failures and retries only incomplete resources",
    async (failure) => {
      const poolError = new Error("pool close failed");
      const databaseError = new Error("database disposal failed");
      const remaining = new Set(["pool", "database"]);
      const end = vi.fn(async () => {
        remaining.delete("pool");
      });
      const dispose = vi.fn(async () => {
        remaining.delete("database");
      });
      if (failure !== "database") end.mockRejectedValueOnce(poolError);
      if (failure !== "pool") dispose.mockRejectedValueOnce(databaseError);
      const state = { pool: { end }, handle, results: { cleanedUp: false } };
      const expectedErrors =
        failure === "both"
          ? [poolError, databaseError]
          : [failure === "pool" ? poolError : databaseError];
      await expect(
        cleanupLifecycleResources(state, dispose),
      ).rejects.toMatchObject({ errors: expectedErrors });
      expect(state.results.cleanedUp).toBe(false);
      expect([...remaining]).toEqual(
        failure === "both" ? ["pool", "database"] : [failure],
      );
      await cleanupLifecycleResources(state, dispose);
      expect(state.results.cleanedUp).toBe(true);
      expect([...remaining]).toEqual([]);
      expect(end.mock.calls).toHaveLength(failure === "database" ? 1 : 2);
      expect(dispose.mock.calls).toHaveLength(failure === "pool" ? 1 : 2);
    },
  );
});
