import { ORPCError, ValidationError } from "@orpc/server";

import { createSafeFieldIssue } from "@/lib/orpc/error-contract";
import { type SituationErrors } from "@/lib/orpc/errors";

const journeyFieldToIssueId = {
  origin: "journeyOriginRequired",
  destination: "journeyDestinationRequired",
  tripType: "journeyTripTypeRequired",
  erasmusDistanceKm: "journeyDistanceRequired",
} as const;

const costFieldToIssueId = {
  transportProfile: "transportProfileOutsideRules",
  amountEur: "entryAmountRequired",
} as const;

function normalizeCostInput(
  error: ORPCError<string, unknown>,
  input: unknown,
  errors: SituationErrors,
) {
  const cause = error.cause;
  if (!(cause instanceof ValidationError)) return errors.badInput();
  const entryId =
    typeof input === "object" &&
    input !== null &&
    "entryId" in input &&
    typeof input.entryId === "string" &&
    /\S/.test(input.entryId)
      ? input.entryId
      : "new";
  const allocationsEmpty =
    typeof input !== "object" ||
    input === null ||
    !("allocations" in input) ||
    !Array.isArray(input.allocations) ||
    input.allocations.length === 0;
  const fields = new Set<string>();
  for (const issue of cause.issues) {
    const first = issue.path?.[0];
    if (typeof first !== "string") continue;
    if (Object.hasOwn(costFieldToIssueId, first)) fields.add(first);
    else if (first === "allocations") fields.add("allocations");
  }
  const issues = [...fields].map((field) => {
    if (field === "allocations")
      return createSafeFieldIssue(
        allocationsEmpty ? "allocationRequired" : "allocationSharesInvalid",
        ["entries", entryId, "allocations"],
      );
    return createSafeFieldIssue(
      costFieldToIssueId[field as keyof typeof costFieldToIssueId],
      ["entries", entryId, field],
    );
  });
  return issues.length
    ? errors.invalidInputWithIssues(issues)
    : errors.badInput();
}

export function normalizeInputValidationError(
  error: unknown,
  path: readonly string[],
  errors: SituationErrors,
) {
  if (
    !(error instanceof ORPCError) ||
    error.code !== "BAD_REQUEST" ||
    !(error.cause instanceof ValidationError)
  )
    return undefined;

  const input = error.cause.invalidData;
  if (path.length === 2 && path[0] === "costs" && path[1] === "save")
    return normalizeCostInput(error, input, errors);
  if (
    path.length !== 2 ||
    path[0] !== "journeys" ||
    !["save", "update"].includes(path[1]) ||
    typeof input !== "object" ||
    input === null ||
    !("projectParticipantId" in input) ||
    typeof input.projectParticipantId !== "string" ||
    !/\S/.test(input.projectParticipantId)
  )
    return errors.badInput();

  const participantId = input.projectParticipantId;
  const fields = new Set(
    error.cause.issues.flatMap((issue) =>
      issue.path?.length === 1 &&
      typeof issue.path[0] === "string" &&
      Object.hasOwn(journeyFieldToIssueId, issue.path[0])
        ? [issue.path[0] as keyof typeof journeyFieldToIssueId]
        : [],
    ),
  );
  const issues = [...fields].map((field) =>
    createSafeFieldIssue(journeyFieldToIssueId[field], [
      "participations",
      participantId,
      "journey",
      field,
    ]),
  );
  return issues.length
    ? errors.invalidInputWithIssues(issues)
    : errors.badInput();
}
