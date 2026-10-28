import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));

import {
  ClaimDraftSchema,
  ClaimInputSchema,
  ClaimPartnershipInputSchema,
  ClaimScopeInputSchema,
  ClaimStatusSchema,
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
