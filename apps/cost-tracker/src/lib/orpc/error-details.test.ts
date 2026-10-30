// @vitest-environment node
import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import { validFieldIssues } from "@/__tests__/field-issue-fixtures";
import { ClaimStatusSchema } from "@/features/claims/validation-schemas";
import {
  createSafeFieldIssue,
  fieldIssueCatalog,
  getSafeErrorSituation,
  ProjectCompletionBlockerSchema,
  SafeFieldIssueSchema,
  SafeErrorDataSchema,
} from "@/lib/orpc/error-contract";
import { getORPCRequestErrorMessage } from "@/lib/orpc/error-message";
import { getErrorStatus } from "@/lib/orpc/error-status";
import { createSituationErrors } from "@/lib/orpc/errors";

const errors = createSituationErrors();

describe("structured error details", () => {
  it("carries the same closed checklist details to the safe client boundary", () => {
    const error = errors.submissionIncomplete([
      createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"]),
      createSafeFieldIssue("entryRequired", ["entries"]),
    ]);
    expect(SafeErrorDataSchema.parse(error.data)).toEqual({
      reason: "CLAIM_SUBMISSION_INCOMPLETE",
      issues: [
        {
          id: "payoutAccountRequired",
          path: ["payoutAccount"],
          message: "Select a Partner Payout Account.",
        },
        {
          id: "entryRequired",
          path: ["entries"],
          message: "Add at least one Travel Cost Entry.",
        },
      ],
    });
    expect(getSafeErrorSituation(error)?.reason).toBe(
      "CLAIM_SUBMISSION_INCOMPLETE",
    );
    expect(getORPCRequestErrorMessage(error)).toEqual({
      sessionExpired: false,
      text: "Claim submission checklist is incomplete.",
    });
  });

  it("covers every closed detail with a valid producer path", () => {
    expect(validFieldIssues.map(({ id }) => id).sort()).toEqual(
      Object.keys(fieldIssueCatalog).sort(),
    );
  });

  it.each(validFieldIssues)("round-trips the closed $id detail", (issue) => {
    const error = errors.submissionIncomplete([issue]);
    expect(SafeErrorDataSchema.parse(error.data)).toMatchObject({
      reason: "CLAIM_SUBMISSION_INCOMPLETE",
      issues: [issue],
    });
    expect(getSafeErrorSituation(error)?.reason).toBe(
      "CLAIM_SUBMISSION_INCOMPLETE",
    );
  });

  it.each(validFieldIssues)(
    "rejects mismatched or empty paths for $id",
    (issue) => {
      for (const path of [[], ["unknown"], [...issue.path, "extra"]]) {
        const invalid = { ...issue, path };
        expect(SafeFieldIssueSchema.safeParse(invalid).success).toBe(false);
        expect(
          getSafeErrorSituation(
            new ORPCError("BAD_REQUEST", {
              data: { reason: "CLAIM_SUBMISSION_INCOMPLETE", issues: [invalid] },
            }),
          ),
        ).toBeUndefined();
      }
    },
  );

  it("rejects a payout correction directed at a cost entry", () => {
    expect(
      SafeFieldIssueSchema.safeParse({
        id: "payoutAccountRequired",
        path: ["entries", "entry-id"],
        message: fieldIssueCatalog.payoutAccountRequired,
      }).success,
    ).toBe(false);
  });

  it("accepts every persisted Claim status and no Claim for completion blockers", () => {
    for (const status of ClaimStatusSchema.options) {
      expect(
        ProjectCompletionBlockerSchema.safeParse({ name: "Group", status })
          .success,
      ).toBe(true);
    }
    expect(
      ProjectCompletionBlockerSchema.safeParse({ name: "Group", status: null })
        .success,
    ).toBe(true);
    expect(
      ProjectCompletionBlockerSchema.safeParse({
        name: "Group",
        status: "unknown",
      }).success,
    ).toBe(false);
  });

  it("transports completion blockers without presenting an unfinished prefix", () => {
    const error = errors.projectCompletionBlocked([
      { name: "Gruppe Süd", status: "submitted" },
      { name: "No Claim", status: null },
    ]);
    expect(getErrorStatus(error.code)).toBe(409);
    expect(SafeErrorDataSchema.parse(error.data)).toEqual({
      reason: "PROJECT_COMPLETION_BLOCKED",
      blockers: [
        { name: "Gruppe Süd", status: "submitted" },
        { name: "No Claim", status: null },
      ],
    });
    expect(getORPCRequestErrorMessage(error)).toEqual({
      sessionExpired: false,
      text: "The resource state conflicts with this request. Reload and try again.",
    });
  });

  it.each([
    { issues: [{ id: "UNKNOWN", path: ["entries"], message: "private" }] },
    { issues: [{ id: "entryRequired", path: ["entries"], message: "private" }] },
    {
      issues: [
        {
          id: "entryRequired",
          path: [123],
          message: "Add at least one Travel Cost Entry.",
        },
      ],
    },
    {
      issues: [
        {
          id: "entryRequired",
          path: ["entries"],
          message: "Add at least one Travel Cost Entry.",
          secret: "private",
        },
      ],
    },
    { blockers: [{ name: "Group", status: "unknown" }] },
    { blockers: [{ name: "", status: null }] },
    { blockers: [{ name: "Group", status: null, secret: "private" }] },
  ])("rejects malformed detail data %j", (details) => {
    const hasBlockers = "blockers" in details;
    const error = new ORPCError(hasBlockers ? "CONFLICT" : "BAD_REQUEST", {
      message: "private",
      data: {
        reason: hasBlockers
          ? "PROJECT_COMPLETION_BLOCKED"
          : "CLAIM_SUBMISSION_INCOMPLETE",
        ...details,
      },
    });
    expect(getSafeErrorSituation(error)).toBeUndefined();
    expect(getORPCRequestErrorMessage(error)).toEqual({
      sessionExpired: false,
      text: hasBlockers
        ? "The resource state conflicts with this request. Reload and try again."
        : "We could not complete that request. Check your details and try again.",
    });
    expect(
      getSafeErrorSituation(
        errors.submissionIncomplete([
          createSafeFieldIssue("entryRequired", ["entries"]),
        ]),
      )?.reason,
    ).toBe("CLAIM_SUBMISSION_INCOMPLETE");
  });

  it.each([
    createSafeFieldIssue("payoutAccountRequired", ["payoutAccount"]),
    createSafeFieldIssue("journeyDistanceOutsideBands", ["payoutAccount"]),
    createSafeFieldIssue("journeyDistanceOutsideBands", [
      "erasmusDistanceKm",
      "extra",
    ]),
  ])("rejects a mismatched Journey distance detail %j", (issue) => {
    const error = new ORPCError("BAD_REQUEST", {
      data: {
        reason: "JOURNEY_DISTANCE_OUTSIDE_BANDS",
        issues: [issue],
      },
    });
    expect(getSafeErrorSituation(error)).toBeUndefined();
    expect(getORPCRequestErrorMessage(error)).toEqual({
      sessionExpired: false,
      text: "We could not complete that request. Check your details and try again.",
    });
    expect(
      getSafeErrorSituation(errors.journeyDistanceOutsideBands())?.reason,
    ).toBe("JOURNEY_DISTANCE_OUTSIDE_BANDS");
  });

  it("does not attach business details to session recovery", () => {
    const error = new ORPCError("FORBIDDEN", {
      data: {
        reason: "HOST_COORDINATION_REQUIRED",
        issues: [createSafeFieldIssue("entryRequired", ["entries"])],
      },
    });
    expect(getSafeErrorSituation(error)).toBeUndefined();
    expect(getSafeErrorSituation(errors.unauthenticated())?.reason).toBe(
      "SESSION_REQUIRED",
    );
  });
});
