// @vitest-environment node
import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";

import {
  createSafeFieldIssue,
  fieldIssueCatalog,
  getSafeErrorSituation,
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

  it.each(Object.keys(fieldIssueCatalog) as (keyof typeof fieldIssueCatalog)[])(
    "round-trips the closed %s detail",
    (id) => {
      const error = errors.submissionIncomplete([
        createSafeFieldIssue(id, ["entries", "entry-id"]),
      ]);
      expect(SafeErrorDataSchema.parse(error.data)).toMatchObject({
        reason: "CLAIM_SUBMISSION_INCOMPLETE",
        issues: [{ id, path: ["entries", "entry-id"] }],
      });
      expect(getSafeErrorSituation(error)?.reason).toBe(
        "CLAIM_SUBMISSION_INCOMPLETE",
      );
    },
  );

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
    const error = new ORPCError("BAD_REQUEST", {
      message: "private",
      data: { reason: "CLAIM_SUBMISSION_INCOMPLETE", ...details },
    });
    expect(getSafeErrorSituation(error)).toBeUndefined();
    expect(getORPCRequestErrorMessage(error)).toEqual({
      sessionExpired: false,
      text: "We could not complete that request. Check your details and try again.",
    });
    expect(
      getSafeErrorSituation(
        errors.submissionIncomplete([
          createSafeFieldIssue("entryRequired", ["entries"]),
        ]),
      )?.reason,
    ).toBe("CLAIM_SUBMISSION_INCOMPLETE");
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
