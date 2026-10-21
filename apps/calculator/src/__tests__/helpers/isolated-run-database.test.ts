// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  assertSafeDropTarget,
  buildRunDatabaseName,
  createIsolatedRunDatabase,
  isProtectedDatabaseName,
  ownershipMarkerFor,
  parseOwnershipMarkerValue,
  redactDatabaseUrl,
} from "@/__tests__/helpers/isolated-run-database";

const RUN_ID = "a".repeat(32);

describe("isolated run database names", () => {
  it("builds a unique, pattern-conforming database name", () => {
    expect(buildRunDatabaseName("lifecycle_check", RUN_ID)).toBe(
      `lifecycle_check_${RUN_ID}`,
    );
  });

  it("rejects prefixes outside the fixture alphabet", () => {
    expect(() => buildRunDatabaseName("Lifecycle-Check", RUN_ID)).toThrow(
      /prefix/i,
    );
    expect(() => buildRunDatabaseName("lifecycle check", RUN_ID)).toThrow(
      /prefix/i,
    );
    expect(() => buildRunDatabaseName("", RUN_ID)).toThrow(/prefix/i);
  });

  it("rejects malformed run ids", () => {
    expect(() => buildRunDatabaseName("lifecycle_check", "xyz")).toThrow(
      /run id/i,
    );
    expect(() => buildRunDatabaseName("lifecycle_check", "")).toThrow(/run id/i);
  });
});

describe("isolated run database creation guards", () => {
  it("refuses to create a run database without an explicit service URL", async () => {
    await expect(
      createIsolatedRunDatabase({ baseDatabaseUrl: "", prefix: "lifecycle" }),
    ).rejects.toThrow(/DATABASE_URL/i);
  });

  it("refuses to create a run database with an invalid prefix", async () => {
    await expect(
      createIsolatedRunDatabase({
        baseDatabaseUrl: "postgres://postgres:secret@127.0.0.1:1/postgres",
        prefix: "Lifecycle-Check",
      }),
    ).rejects.toThrow(/prefix/i);
  });

  it("prevents a second concurrent run from claiming a database in this process", async () => {
    const args = {
      baseDatabaseUrl: "postgres://postgres:secret@127.0.0.1:1/postgres",
      prefix: "lifecycle_check",
    } as const;
    const first = createIsolatedRunDatabase(args);
    // Attach a no-op catch immediately so the in-flight rejection stays handled.
    void first.catch(() => {});
    await expect(createIsolatedRunDatabase(args)).rejects.toThrow(
      /already active/i,
    );
    // The failed first attempt releases the slot instead of leaking the guard.
    await expect(first).rejects.toThrow();
    await expect(
      createIsolatedRunDatabase({
        baseDatabaseUrl: "",
        prefix: "lifecycle_check",
      }),
    ).rejects.toThrow(/DATABASE_URL/i);
  });
});

describe("database URL redaction", () => {
  it("strips credentials while keeping the target identifiable", () => {
    expect(
      redactDatabaseUrl("postgres://postgres:super-secret@db:5432/run_abc"),
    ).toBe("postgres://postgres:***@db:5432/run_abc");
  });

  it("leaves credential-free URLs structurally intact", () => {
    expect(redactDatabaseUrl("postgres://db:5432/run_abc")).toBe(
      "postgres://db:5432/run_abc",
    );
  });

  it("never emits the input when it cannot be parsed", () => {
    expect(redactDatabaseUrl("not a url ::")).toBe("[unparseable-database-url]");
  });
});

describe("drop-target safety", () => {
  const target = {
    serviceHost: "db",
    servicePort: "5432",
    databaseName: `lifecycle_check_${RUN_ID}`,
    marker: ownershipMarkerFor(RUN_ID),
    expectedRunId: RUN_ID,
    baseDatabaseName: "postgres",
  };

  it("accepts an owned run database on the expected service", () => {
    expect(() => assertSafeDropTarget(target)).not.toThrow();
  });

  it("refuses protected database names without comparing markers", () => {
    for (const databaseName of [
      "postgres",
      "template0",
      "template1",
      "greendex_development",
    ]) {
      expect(isProtectedDatabaseName(databaseName)).toBe(true);
      expect(() => assertSafeDropTarget({ ...target, databaseName })).toThrow(
        /refusing|protected/i,
      );
    }
    expect(isProtectedDatabaseName(target.databaseName)).toBe(false);
  });

  it("refuses names outside the run-database pattern", () => {
    expect(() =>
      assertSafeDropTarget({ ...target, databaseName: "lifecycle_check" }),
    ).toThrow(/pattern/i);
  });

  it("refuses to drop the service default database", () => {
    expect(() =>
      assertSafeDropTarget({
        ...target,
        databaseName: `postgres_${RUN_ID}`,
        baseDatabaseName: `postgres_${RUN_ID}`,
      }),
    ).toThrow(/refusing/i);
  });

  it("refuses ownership mismatches before any destructive statement", () => {
    expect(() => assertSafeDropTarget({ ...target, marker: null })).toThrow(
      /ownership/i,
    );
    expect(() =>
      assertSafeDropTarget({
        ...target,
        marker: ownershipMarkerFor("b".repeat(32)),
      }),
    ).toThrow(/ownership/i);
    expect(() =>
      assertSafeDropTarget({ ...target, expectedRunId: "b".repeat(32) }),
    ).toThrow(/ownership/i);
  });

  it("round-trips ownership markers and rejects foreign values", () => {
    expect(parseOwnershipMarkerValue(ownershipMarkerFor(RUN_ID))).toBe(RUN_ID);
    expect(parseOwnershipMarkerValue(null)).toBeNull();
    expect(parseOwnershipMarkerValue("greendex-test-run:xyz")).toBeNull();
    expect(parseOwnershipMarkerValue("another-runner:aaa")).toBeNull();
  });
});
