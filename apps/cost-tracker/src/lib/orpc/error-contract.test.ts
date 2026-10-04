// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  ErrorReasonSchema,
  SafeErrorDataSchema,
  getSafeErrorSituation,
  situationCatalog,
} from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";

const errors = createSituationErrors();

describe("safe error contract validation", () => {
  it.each(Object.entries(situationCatalog))(
    "accepts the declared %s metadata",
    (_name, situation) => {
      expect(ErrorReasonSchema.parse(situation.reason)).toBe(situation.reason);
      expect(
        SafeErrorDataSchema.safeParse({ reason: situation.reason }).success,
      ).toBe(true);
    },
  );

  it.each([
    { reason: "UNKNOWN" },
    { reason: 123 },
    {},
    { reason: "SESSION_REQUIRED", vendor: "private" },
  ])("rejects unknown client metadata %j", (data) => {
    expect(SafeErrorDataSchema.safeParse(data).success).toBe(false);
    expect(
      getSafeErrorSituation({ code: "FORBIDDEN", status: 403, data }),
    ).toBeUndefined();
  });

  it("rejects forged reason/code/status combinations", () => {
    const notMember = errors.notMember();
    const forged = [
      { ...notMember, code: "NOT_FOUND" },
      { ...notMember, status: 404 },
      { code: "FORBIDDEN", status: 403, data: { reason: "PROJECT_NOT_FOUND" } },
      { code: "FORBIDDEN", status: 403, data: { reason: "SESSION_REQUIRED" } },
      { code: "FORBIDDEN", status: 403 },
    ];
    for (const candidate of forged)
      expect(getSafeErrorSituation(candidate)).toBeUndefined();
  });
});
