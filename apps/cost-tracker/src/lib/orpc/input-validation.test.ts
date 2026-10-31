import { ORPCError, ValidationError } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { SafeFieldIssueSchema } from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";
import { normalizeInputValidationError } from "@/lib/orpc/input-validation";

const errors = createSituationErrors();

describe("input validation normalization", () => {
  it("deduplicates field failures and never returns vendor messages", () => {
    const cause = new ValidationError({
      message: "private",
      invalidData: { projectParticipantId: "p1" },
      issues: [
        { path: ["erasmusDistanceKm"], message: "journeyDistanceRequired" },
        { path: ["erasmusDistanceKm"], message: "journeyDistanceRequired" },
        { path: ["unknown"], message: "vendor three" },
      ],
    });
    const result = normalizeInputValidationError(
      new ORPCError("BAD_REQUEST", { cause }),
      errors,
    );
    expect(result?.data).toEqual({
      reason: "INVALID_INPUT",
      issues: [
        {
          id: "journeyDistanceRequired",
          path: ["erasmusDistanceKm"],
          message: "Enter a positive exact Erasmus distance.",
        },
      ],
    });
  });

  it("returns known relative fields even when identifiers are absent", () => {
    const cause = new ValidationError({
      message: "private",
      invalidData: {},
      issues: [{ path: ["origin"], message: "journeyOriginRequired" }],
    });
    expect(
      normalizeInputValidationError(
        new ORPCError("BAD_REQUEST", { cause }),
        errors,
      )?.data,
    ).toEqual({
      reason: "INVALID_INPUT",
      issues: [
        {
          id: "journeyOriginRequired",
          path: ["origin"],
          message: "Enter a Journey origin.",
        },
      ],
    });
  });

  it("retains numeric allocation paths and rejects private or mismatched messages", () => {
    const cause = new ValidationError({
      message: "private",
      invalidData: { entryId: "private-entry" },
      issues: [
        {
          path: ["allocations", 2, "percentage"],
          message: "allocationSharesInvalid",
        },
        {
          path: ["allocations", 2, "projectParticipantId"],
          message: "allocationSharesInvalid",
        },
        { path: ["amountEur"], message: "private" },
        { path: ["amountEur"], message: "journeyOriginRequired" },
      ],
    });
    expect(
      normalizeInputValidationError(
        new ORPCError("BAD_REQUEST", { cause }),
        errors,
      )?.data,
    ).toEqual({
      reason: "INVALID_INPUT",
      issues: [
        {
          id: "allocationSharesInvalid",
          path: ["allocations", 2, "percentage"],
          message:
            "Use positive exact shares of the chosen method that total the entry amount (or 100%).",
        },
        {
          id: "allocationSharesInvalid",
          path: ["allocations", 2, "projectParticipantId"],
          message:
            "Use positive exact shares of the chosen method that total the entry amount (or 100%).",
        },
      ],
    });
  });

  it("accepts only matching input or checklist paths for Journey details", () => {
    const issue = { id: "journeyOriginRequired", message: "private" };
    expect(
      SafeFieldIssueSchema.safeParse({ ...issue, path: ["origin"] }).success,
    ).toBe(true);
    expect(
      SafeFieldIssueSchema.safeParse({
        ...issue,
        path: ["participations", "p1", "journey", "origin"],
      }).success,
    ).toBe(true);
    expect(
      SafeFieldIssueSchema.safeParse({ ...issue, path: ["destination"] }).success,
    ).toBe(false);
  });

  it("passes known refusals through and safely normalizes other input failures", () => {
    expect(
      normalizeInputValidationError(errors.journeyDistanceOutsideBands(), errors),
    ).toBeUndefined();
    const cause = new ValidationError({
      message: "private",
      invalidData: {},
      issues: [{ path: ["unknown"], message: "private" }],
    });
    expect(
      normalizeInputValidationError(
        new ORPCError("BAD_REQUEST", { cause }),
        errors,
      )?.data,
    ).toEqual({ reason: "INVALID_INPUT" });
  });
});
