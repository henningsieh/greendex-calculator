import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));

import {
  ClaimDraftSchema,
  ClaimInputSchema,
  ClaimPartnershipInputSchema,
  ClaimScopeInputSchema,
  ClaimStatusSchema,
  TravelCostEntryIdSchema,
  PayoutAccountIdSchema,
  ProofDocumentIdSchema,
} from "@/features/claims/validation-schemas";

describe("Claim validation schemas", () => {
  it("accepts the persisted Claim statuses and rejects unknown statuses", () => {
    for (const status of [
      "editable",
      "submitted",
      "correction_requested",
      "approved",
      "rejected",
      "paid",
    ]) {
      expect(ClaimStatusSchema.parse(status)).toBe(status);
    }
    expect(ClaimStatusSchema.safeParse("unknown").success).toBe(false);
  });

  it("normalizes and validates Partnership IDs in each input", () => {
    for (const schema of [
      ClaimInputSchema,
      ClaimPartnershipInputSchema,
      ClaimScopeInputSchema,
    ]) {
      expect(schema.parse({ partnershipId: "  partner  ", extra: true })).toEqual(
        { partnershipId: "partner" },
      );
      expect(schema.safeParse({ partnershipId: " " }).success).toBe(false);
      expect(schema.safeParse({ partnershipId: "a".repeat(129) }).success).toBe(
        false,
      );
    }
  });

  it("limits draft output to editable statuses", () => {
    for (const status of ["editable", "correction_requested"]) {
      expect(
        ClaimDraftSchema.parse({ id: "claim", partnershipId: "partner", status }),
      ).toEqual({ id: "claim", partnershipId: "partner", status });
    }
    expect(
      ClaimDraftSchema.safeParse({
        id: "claim",
        partnershipId: "partner",
        status: "submitted",
      }).success,
    ).toBe(false);
  });
});

describe("TravelCostEntryIdSchema", () => {
  it("trims identifiers before validating their length", () => {
    expect(TravelCostEntryIdSchema.parse("  id  ")).toBe("id");
    expect(TravelCostEntryIdSchema.parse("a".repeat(128))).toBe("a".repeat(128));
    expect(TravelCostEntryIdSchema.parse("  " + "a".repeat(128) + "  ")).toBe(
      "a".repeat(128),
    );
  });

  it.each(["", "   ", "a".repeat(129), "  " + "a".repeat(129) + "  "])(
    "rejects invalid identifier %s",
    (value) => {
      expect(TravelCostEntryIdSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe.each([PayoutAccountIdSchema, ProofDocumentIdSchema])(
  "entity identifier",
  (schema) => {
    it("trims and enforces the identifier boundaries", () => {
      expect(schema.parse("  id  ")).toBe("id");
      expect(schema.parse("x".repeat(128))).toBe("x".repeat(128));
      expect(schema.safeParse(" ").success).toBe(false);
      expect(schema.safeParse("x".repeat(129)).success).toBe(false);
    });
  },
);
