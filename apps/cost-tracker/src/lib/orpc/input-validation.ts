import { ORPCError, ValidationError } from "@orpc/server";

import {
  createSafeFieldIssue,
  FieldIssueIdSchema,
  SafeFieldIssueSchema,
} from "@/lib/orpc/error-contract";
import { type SituationErrors } from "@/lib/orpc/errors";

export function normalizeInputValidationError(
  error: unknown,
  errors: SituationErrors,
) {
  if (
    !(error instanceof ORPCError) ||
    error.code !== "BAD_REQUEST" ||
    !(error.cause instanceof ValidationError)
  )
    return undefined;

  const seen = new Set<string>();
  const issues = error.cause.issues.flatMap((issue) => {
    const id = FieldIssueIdSchema.safeParse(issue.message);
    if (
      !id.success ||
      !issue.path ||
      !issue.path.every(
        (segment) => typeof segment === "string" || typeof segment === "number",
      )
    )
      return [];
    const safeIssue = createSafeFieldIssue(id.data, [...issue.path]);
    if (!SafeFieldIssueSchema.safeParse(safeIssue).success) return [];
    const key = JSON.stringify([safeIssue.id, safeIssue.path]);
    if (seen.has(key)) return [];
    seen.add(key);
    return [safeIssue];
  });
  return issues.length
    ? errors.invalidInputWithIssues(issues)
    : errors.badInput();
}
