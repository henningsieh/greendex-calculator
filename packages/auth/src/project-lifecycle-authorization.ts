import type { db } from "@greendex/database";
import {
  member,
  projectsTable,
  hostProjectAssignmentsTable,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

import { parseOrganizationRoles } from "./organization-roles";
import {
  calculatorOrganizationRoles,
  costTrackerOrganizationRoles,
  projectLifecycleScope,
  type ProjectLifecyclePermission,
  type ProjectLifecycleResource,
} from "./permissions";

export type ProjectLifecycleExecutor = Pick<typeof db, "select">;
export type ProjectLifecycleRequest = {
  executor: ProjectLifecycleExecutor;
  actorId: typeof member.$inferSelect.userId | null | undefined;
  activeOrganizationId:
    | typeof member.$inferSelect.organizationId
    | null
    | undefined;
  projectId: typeof projectsTable.$inferSelect.id;
  action: ProjectLifecyclePermission;
};
export type ProjectLifecycleDecision =
  | {
      allowed: true;
      projectId: typeof projectsTable.$inferSelect.id;
      scope: NonNullable<ReturnType<typeof projectLifecycleScope>>;
    }
  | {
      allowed: false;
      reason:
        | "unauthenticated"
        | "activeOrganizationRequired"
        | "membershipRequired"
        | "actionDenied"
        | "projectNotFound"
        | "assignmentRequired";
    };

export function bindProjectLifecycleAuthorization(
  resource: ProjectLifecycleResource,
) {
  return async function authorizeProjectLifecycle({
    executor,
    actorId,
    activeOrganizationId,
    projectId,
    action,
  }: ProjectLifecycleRequest): Promise<ProjectLifecycleDecision> {
    if (!actorId) return { allowed: false, reason: "unauthenticated" };
    if (!activeOrganizationId)
      return { allowed: false, reason: "activeOrganizationRequired" };
    const [membership] = await executor
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.userId, actorId),
          eq(member.organizationId, activeOrganizationId),
        ),
      )
      .limit(1);
    if (!membership) return { allowed: false, reason: "membershipRequired" };
    const roles = parseOrganizationRoles(membership.role);
    const granted = roles.some((role) =>
      resource === "calculatorProjectLifecycle"
        ? calculatorOrganizationRoles[role].authorize({
            calculatorProjectLifecycle: [action],
          }).success
        : costTrackerOrganizationRoles[role].authorize({
            costTrackerProjectLifecycle: [action],
          }).success,
    );
    const scope = projectLifecycleScope(resource, membership.role, action);
    if (!granted || !scope) return { allowed: false, reason: "actionDenied" };
    const [project] = await executor
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, projectId),
          eq(projectsTable.organizationId, activeOrganizationId),
        ),
      )
      .limit(1);
    if (!project) return { allowed: false, reason: "projectNotFound" };
    if (scope === "assigned") {
      const [assignment] = await executor
        .select({ userId: hostProjectAssignmentsTable.userId })
        .from(hostProjectAssignmentsTable)
        .where(
          and(
            eq(hostProjectAssignmentsTable.projectId, projectId),
            eq(hostProjectAssignmentsTable.userId, actorId),
          ),
        )
        .limit(1);
      if (!assignment) return { allowed: false, reason: "assignmentRequired" };
    }
    return { allowed: true, projectId: project.id, scope };
  };
}
