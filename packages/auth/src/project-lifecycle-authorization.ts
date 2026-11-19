import type { db } from "@greendex/database";
import {
  member,
  projectsTable,
  hostProjectAssignmentsTable,
} from "@greendex/database/schema";
import { and, eq, inArray } from "drizzle-orm";

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

export type ProjectLifecycleBatchRequest = Omit<
  ProjectLifecycleRequest,
  "projectId" | "action"
> & {
  projectIds: readonly ProjectLifecycleRequest["projectId"][];
  actions: readonly ProjectLifecyclePermission[];
};

export function bindProjectLifecycleAuthorization(
  resource: ProjectLifecycleResource,
) {
  async function batch({
    executor,
    actorId,
    activeOrganizationId,
    projectIds,
    actions,
  }: ProjectLifecycleBatchRequest) {
    const decisions = new Map<
      ProjectLifecycleRequest["projectId"],
      Map<ProjectLifecyclePermission, ProjectLifecycleDecision>
    >();
    const ids = [...new Set(projectIds)];
    const scopes = new Map<
      ProjectLifecyclePermission,
      ReturnType<typeof projectLifecycleScope>
    >();
    const ownedIds = new Set<ProjectLifecycleRequest["projectId"]>();
    const assignedIds = new Set<ProjectLifecycleRequest["projectId"]>();
    function decisionFor(
      projectId: ProjectLifecycleRequest["projectId"],
      action: ProjectLifecyclePermission,
    ): ProjectLifecycleDecision {
      const scope = scopes.get(action);
      if (!scope) return { allowed: false, reason: "actionDenied" };
      if (
        scope === "assigned" &&
        (!ownedIds.has(projectId) || !assignedIds.has(projectId))
      )
        return { allowed: false, reason: "assignmentRequired" };
      if (!ownedIds.has(projectId))
        return { allowed: false, reason: "projectNotFound" };
      return { allowed: true, projectId, scope };
    }
    function result(denial?: ProjectLifecycleDecision) {
      for (const projectId of ids) {
        const perAction = new Map<
          ProjectLifecyclePermission,
          ProjectLifecycleDecision
        >();
        for (const action of actions) {
          perAction.set(action, denial ?? decisionFor(projectId, action));
        }
        decisions.set(projectId, perAction);
      }
      return decisions;
    }
    if (!ids.length || !actions.length) return decisions;
    if (!actorId) return result({ allowed: false, reason: "unauthenticated" });
    if (!activeOrganizationId)
      return result({ allowed: false, reason: "activeOrganizationRequired" });
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
    if (!membership)
      return result({ allowed: false, reason: "membershipRequired" });
    const roles = parseOrganizationRoles(membership.role);
    for (const action of actions) {
      const granted = roles.some((role) =>
        resource === "calculatorProjectLifecycle"
          ? calculatorOrganizationRoles[role].authorize({
              calculatorProjectLifecycle: [action],
            }).success
          : costTrackerOrganizationRoles[role].authorize({
              costTrackerProjectLifecycle: [action],
            }).success,
      );
      if (granted)
        scopes.set(
          action,
          projectLifecycleScope(resource, membership.role, action),
        );
    }
    if (![...scopes.values()].some(Boolean)) return result();
    const projects = await executor
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(
        and(
          inArray(projectsTable.id, ids),
          eq(projectsTable.organizationId, activeOrganizationId),
        ),
      );
    for (const project of projects) ownedIds.add(project.id);
    if (ownedIds.size && [...scopes.values()].includes("assigned")) {
      const assignments = await executor
        .select({ projectId: hostProjectAssignmentsTable.projectId })
        .from(hostProjectAssignmentsTable)
        .where(
          and(
            inArray(hostProjectAssignmentsTable.projectId, [...ownedIds]),
            eq(hostProjectAssignmentsTable.userId, actorId),
          ),
        );
      for (const assignment of assignments) assignedIds.add(assignment.projectId);
    }
    return result();
  }

  return Object.assign(
    async (
      request: ProjectLifecycleRequest,
    ): Promise<ProjectLifecycleDecision> => {
      const decisions = await batch({
        ...request,
        projectIds: [request.projectId],
        actions: [request.action],
      });
      const decision = decisions.get(request.projectId)?.get(request.action);
      if (!decision) throw new Error("Missing Project lifecycle decision");
      return decision;
    },
    { batch },
  );
}
