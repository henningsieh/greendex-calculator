import { ORPCError, ValidationError } from "@orpc/server";
import { describe, expect, it } from "vitest";

import { createSituationErrors } from "@/lib/orpc/errors";
import { normalizeInputValidationError } from "@/lib/orpc/input-validation";

const errors = createSituationErrors();

describe("input validation normalization", () => {
  it("deduplicates field failures and never returns vendor messages", () => {
    const cause = new ValidationError({
      message: "private",
      invalidData: { projectParticipantId: "p1" },
      issues: [
        { path: ["erasmusDistanceKm"], message: "vendor one" },
        { path: ["erasmusDistanceKm"], message: "vendor two" },
        { path: ["unknown"], message: "vendor three" },
      ],
    });
    const result = normalizeInputValidationError(
      new ORPCError("BAD_REQUEST", { cause }),
      ["journeys", "update"],
      errors,
    );
    expect(result?.data).toEqual({
      reason: "INVALID_INPUT",
      issues: [
        {
          id: "journeyDistanceRequired",
          path: ["participations", "p1", "journey", "erasmusDistanceKm"],
          message: "Enter a positive exact Erasmus distance.",
        },
      ],
    });
  });

  it("passes known refusals through and safely normalizes other input failures", () => {
    expect(
      normalizeInputValidationError(
        errors.journeyDistanceOutsideBands(),
        ["journeys", "update"],
        errors,
      ),
    ).toBeUndefined();
    const cause = new ValidationError({
      message: "private",
      invalidData: {},
      issues: [{ path: ["origin"], message: "private" }],
    });
    expect(
      normalizeInputValidationError(
        new ORPCError("BAD_REQUEST", { cause }),
        ["journeys", "save"],
        errors,
      )?.data,
    ).toEqual({ reason: "INVALID_INPUT" });
  });
});
