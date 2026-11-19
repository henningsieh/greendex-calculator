import {
  bindProjectLifecycleAuthorization,
  type ProjectLifecycleDecision,
} from "@greendex/auth/project-lifecycle-authorization";

import {
  createSituationErrors,
  type ScopeErrorConstructors,
} from "@/lib/orpc/errors";

export const authorizeCostTrackerProjectLifecycle =
  bindProjectLifecycleAuthorization("costTrackerProjectLifecycle");

export function requireLifecycleDecision(
  decision: ProjectLifecycleDecision,
  errors: ScopeErrorConstructors,
) {
  if (decision.allowed) return;
  const situation = createSituationErrors(errors);
  switch (decision.reason) {
    case "unauthenticated":
      throw situation.unauthenticated();
    case "activeOrganizationRequired":
      throw situation.selectOrganization();
    case "membershipRequired":
      throw situation.notMember();
    case "projectNotFound":
      throw situation.projectNotFound();
    case "assignmentRequired":
      throw situation.hostCoordinationRequired();
    case "actionDenied":
      throw situation.accessDenied();
  }
}
