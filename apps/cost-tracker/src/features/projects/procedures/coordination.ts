import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  member,
  hostProjectAssignmentsTable as hostAssignments,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

import {
  createSituationErrors,
  type ScopeErrorConstructors,
} from "@/lib/orpc/errors";

type Denial = ScopeErrorConstructors;

/** Verifies hosted Project membership and explicit Host-side coordination. */
export async function requireHostCoordination(
  projectId: string,
  actorId: string,
  activeOrganizationId: string | null | undefined,
  errors: Denial,
  executor: Pick<typeof db, "select"> = db,
) {
  const situation = createSituationErrors(errors);
  if (!activeOrganizationId) throw situation.selectOrganization();
  const [project] = await executor
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.organizationId, activeOrganizationId ?? ""),
        eq(projects.archived, false),
      ),
    )
    .limit(1);
  const [membership] = activeOrganizationId
    ? await executor
        .select({ role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, activeOrganizationId),
            eq(member.userId, actorId),
          ),
        )
        .limit(1)
    : [];
  if (!membership) throw situation.notMember();
  if (!project) throw situation.projectNotFound();
  if (
    hasOrganizationRole(membership.role, ORGANIZATION_ROLES.OrganizationOwner) ||
    hasOrganizationRole(membership.role, ORGANIZATION_ROLES.OrganizationAdmin)
  )
    return project;
  if (
    hasOrganizationRole(membership.role, ORGANIZATION_ROLES.ProjectCoordinator)
  ) {
    const [assignment] = await executor
      .select({ userId: hostAssignments.userId })
      .from(hostAssignments)
      .where(
        and(
          eq(hostAssignments.projectId, projectId),
          eq(hostAssignments.userId, actorId),
        ),
      )
      .limit(1);
    if (assignment) return project;
  }
  throw situation.hostCoordinationRequired();
}
