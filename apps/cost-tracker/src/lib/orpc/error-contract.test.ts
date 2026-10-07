// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  SafeErrorDataSchema,
  getSafeErrorSituation,
  situationCatalog,
  situationReasons,
} from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";

const errors = createSituationErrors();

describe("safe error contract validation", () => {
  it.each(Object.entries(situationCatalog))(
    "accepts the declared %s metadata at the boundary",
    (_name, situation) => {
      expect(
        SafeErrorDataSchema.safeParse({ reason: situation.reason }).success,
      ).toBe(true);
    },
  );

  it("declares each reason exactly once", () => {
    expect(situationReasons.length).toBe(Object.keys(situationCatalog).length);
  });

  it.each([
    { reason: "UNKNOWN" },
    { reason: 123 },
    {},
    { reason: "SESSION_REQUIRED", vendor: "private" },
  ])("rejects unknown client metadata %j", (data) => {
    expect(SafeErrorDataSchema.safeParse(data).success).toBe(false);
    expect(getSafeErrorSituation({ code: "FORBIDDEN", data })).toBeUndefined();
  });

  it("rejects forged reason/code combinations", () => {
    const notMember = errors.notMember();
    const forged = [
      { ...notMember, code: "NOT_FOUND" },
      { code: "FORBIDDEN", data: { reason: "PROJECT_NOT_FOUND" } },
      { code: "FORBIDDEN", data: { reason: "SESSION_REQUIRED" } },
      { code: "FORBIDDEN" },
    ];
    for (const candidate of forged)
      expect(getSafeErrorSituation(candidate)).toBeUndefined();
  });
});
