// @vitest-environment node
import {
  claimsTable as claims,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { lockClaimScope } from "@/features/projects/procedures/claim-locks";

const tableNames = new Map<unknown, string>([
  [projects, "projects"],
  [partnerships, "partnerships"],
  [claims, "claims"],
]);

/** Records the order in which a transaction holds the shared Claim-scope rows. */
function recorder(rows: Record<string, unknown[]>) {
  const held: string[] = [];
  const tx = {
    select: () => ({
      from: (table: unknown) => {
        const name = tableNames.get(table) ?? "unknown";
        const query: Record<string, unknown> = {
          where: () => query,
          for: () => {
            held.push(name);
            return query;
          },
          limit: async () => rows[name] ?? [],
        };
        return query;
      },
    }),
  };
  return { tx: tx as never, held };
};

const scope = {
  projectId: "project",
  partnershipId: "partnership",
  partnerOrganizationId: "partner",
};
const allRows = {
  projects: [{ id: "project" }],
  partnerships: [{ id: "partnership" }],
  claims: [
    {
      id: "claim",
      partnershipId: "partnership",
      status: "correction_requested",
      approvedAmountEur: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("shared Claim lock order", () => {
  it("takes Project before Partnership before Claim for Project-scoped writes", async () => {
    const { tx, held } = recorder(allRows);
    await lockClaimScope(tx, scope, {}, "project");
    expect(held).toEqual(["projects", "partnerships", "claims"]);
  });

  it("takes Partnership before Claim for Partnership-scoped writes", async () => {
    const { tx, held } = recorder(allRows);
    await lockClaimScope(tx, scope, {}, "partnership");
    expect(held).toEqual(["partnerships", "claims"]);
  });

  it("takes only the Claim for Claim-owned writes", async () => {
    const { tx, held } = recorder(allRows);
    await lockClaimScope(tx, scope, {}, "claim");
    expect(held).toEqual(["claims"]);
  });

  it("returns the locked Claim row that the shared editing rule reads", async () => {
    const { tx } = recorder(allRows);
    const { claim } = await lockClaimScope(tx, scope, {}, "claim");
    expect(claim).toEqual(allRows.claims[0]);
  });

  it("reports an absent Claim as undefined instead of inventing one", async () => {
    const { tx } = recorder({ ...allRows, claims: [] });
    const { claim } = await lockClaimScope(tx, scope, {}, "claim");
    expect(claim).toBeUndefined();
  });

  it.each([
    ["project", { projects: [] }],
    ["partnership", { partnerships: [] }],
  ] as const)(
    "refuses a missing covered row for %s coverage",
    async (coverage, missing) => {
      const { tx, held } = recorder({ ...allRows, ...missing });
      await expect(lockClaimScope(tx, scope, {}, coverage)).rejects.toMatchObject(
        { code: "NOT_FOUND", data: { reason: "PROJECT_PARTNERSHIP_NOT_FOUND" } },
      );
      // The Claim is never locked once a covered row is missing.
      expect(held).not.toContain("claims");
    },
  );
});