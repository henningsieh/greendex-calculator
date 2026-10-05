// @vitest-environment node
import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";

import { situationCatalog } from "@/lib/orpc/error-contract";
import { createSituationErrors } from "@/lib/orpc/errors";

const errors = createSituationErrors();

describe("derived situation refusals", () => {
  it("exposes exactly one refusal per declared situation", () => {
    expect(Object.keys(errors).sort()).toEqual(
      Object.keys(situationCatalog).sort(),
    );
  });

  it.each([
    "unauthenticated",
    "notMember",
    "hostingSideRequired",
    "proofFileTooLarge",
    "internalFailure",
  ] as const)("builds %s from its catalog declaration", (name) => {
    const situation = situationCatalog[name];
    expect(errors[name]()).toMatchObject({
      code: situation.code,
      status: situation.status,
      message: situation.message,
      data: { reason: situation.reason },
    });
  });

  it("builds refusals through the transport constructors a procedure injects", () => {
    const FORBIDDEN = vi.fn(
      (options: { message: string; data: { reason: string } }) =>
        new ORPCError("FORBIDDEN", options),
    );
    createSituationErrors({ FORBIDDEN }).notMember();
    expect(FORBIDDEN).toHaveBeenCalledWith({
      message: situationCatalog.notMember.message,
      data: { reason: situationCatalog.notMember.reason },
    });
  });

  it("keeps the funding band issue on the derived journey refusal", () => {
    expect(errors.journeyDistanceOutsideBands().data).toEqual({
      reason: situationCatalog.journeyDistanceOutsideBands.reason,
      issues: [
        {
          path: ["erasmusDistanceKm"],
          message: situationCatalog.journeyDistanceOutsideBands.message,
        },
      ],
    });
  });

  it("projectCompletionBlocked preserves scoped names and statuses without changing 400 policy", () => {
    expect(
      errors.projectCompletionBlocked([
        { name: "Group A", status: "submitted" },
        { name: "Group B", status: null },
      ]),
    ).toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message:
        "Cannot complete Project: Group A (submitted), Group B (no Claim).",
      data: { reason: "PROJECT_COMPLETION_BLOCKED" },
    });
  });

  it("submissionIncomplete preserves server-produced field issues", () => {
    const issues = [
      { path: ["entries", "entry-id"], message: "Add a Proof Document." },
    ];
    expect(errors.submissionIncomplete(issues)).toMatchObject({
      code: situationCatalog.submissionIncomplete.code,
      status: situationCatalog.submissionIncomplete.status,
      message: situationCatalog.submissionIncomplete.message,
      data: { reason: situationCatalog.submissionIncomplete.reason, issues },
    });
  });
});
