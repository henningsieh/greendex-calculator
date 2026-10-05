import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  member,
  hostProjectAssignmentsTable as hostAssignments,
  partnerCoordinatorAssignmentsTable as assignments,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireCostTrackerRole } from "@/features/organizations/roles";
import {
  createSituationErrors,
  type ScopeErrorConstructors,
} from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export const coordinationId = z.string().trim().min(1).max(128);

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
  if (hasOrganizationRole(membership.role, ORGANIZATION_ROLES.ProjectCoordinator)) {
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

/** Verifies both the active Organization and the actor's persisted staff scope. */
export async function requirePartnerCoordination(
  partnershipId: string,
  actorId: string,
  activeOrganizationId: string | null | undefined,
  errors: Denial,
) {
  const situation = createSituationErrors(errors);
  if (!activeOrganizationId) throw situation.selectOrganization();
  const [scope] = await db
    .select({
      projectId: partnerships.projectId,
      partnerId: partnerships.organizationId,
      hostId: projects.organizationId,
    })
    .from(partnerships)
    .innerJoin(projects, eq(projects.id, partnerships.projectId))
    .where(and(eq(partnerships.id, partnershipId), eq(projects.archived, false)))
    .limit(1);
  if (
    !scope ||
    (activeOrganizationId !== scope.partnerId &&
      activeOrganizationId !== scope.hostId)
  )
    throw situation.partnershipNotFound();
  const [membership] = await db
    .select({ role: member.role })
    .from(member)
    .where(
      and(
        eq(member.userId, actorId),
        eq(member.organizationId, activeOrganizationId),
      ),
    )
    .limit(1);
  if (!membership) throw situation.notMember();
  if (
    hasOrganizationRole(membership.role, ORGANIZATION_ROLES.OrganizationOwner) ||
    hasOrganizationRole(membership.role, ORGANIZATION_ROLES.OrganizationAdmin)
  )
    return scope;
  if (!hasOrganizationRole(membership.role, ORGANIZATION_ROLES.ProjectCoordinator))
    throw situation.partnerCoordinationRequired();
  if (activeOrganizationId === scope.partnerId) {
    const [assignment] = await db
      .select({ userId: assignments.userId })
      .from(assignments)
      .where(
        and(
          eq(assignments.partnershipId, partnershipId),
          eq(assignments.userId, actorId),
        ),
      )
      .limit(1);
    if (assignment) return scope;
  } else {
    await requireHostCoordination(
      scope.projectId,
      actorId,
      activeOrganizationId,
      errors,
    );
    return scope;
  }
  throw situation.partnerCoordinationRequired();
}

/** Organization owners/admins appoint and revoke Partner coordinators without altering roles. */
export const assignPartnerCoordinator = authorized
  .input(z.object({ partnershipId: coordinationId, userId: coordinationId }))
  .output(z.object({ assigned: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const situation = createSituationErrors(errors);
    const orgId = context.session.activeOrganizationId;
    if (!orgId) throw situation.selectOrganization();
    const [partnership] = await db
      .select({ organizationId: partnerships.organizationId })
      .from(partnerships)
      .innerJoin(
        projects,
        and(
          eq(projects.id, partnerships.projectId),
          eq(projects.archived, false),
        ),
      )
      .where(eq(partnerships.id, input.partnershipId))
      .limit(1);
    if (!partnership || partnership.organizationId !== orgId)
      throw situation.partnershipNotFound();
    const [actor] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(eq(member.organizationId, orgId), eq(member.userId, context.user.id)),
      )
      .limit(1);
    if (!actor) throw situation.notMember();
    if (
      !(
        hasOrganizationRole(actor.role, ORGANIZATION_ROLES.OrganizationOwner) ||
        hasOrganizationRole(actor.role, ORGANIZATION_ROLES.OrganizationAdmin)
      )
    )
      throw situation.organizationManagementRequired();
    const [target] = await db
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(
        and(eq(member.organizationId, orgId), eq(member.userId, input.userId)),
      )
      .limit(1);
    if (target)
      requireCostTrackerRole(target.role, () =>
        situation.invalidOrganizationRole(),
      );
    if (
      !target ||
      !target.role
        .split(",")
        .some((role) =>
          [ORGANIZATION_ROLES.OrganizationOwner, ORGANIZATION_ROLES.OrganizationAdmin, ORGANIZATION_ROLES.ProjectCoordinator].some((knownRole) => knownRole === role.trim()),
        )
    )
      throw situation.coordinatorSelectionRequired();
    await db.insert(assignments).values(input).onConflictDoNothing();
    return { assigned: true as const };
  });

export const removePartnerCoordinator = authorized
  .input(z.object({ partnershipId: coordinationId, userId: coordinationId }))
  .output(z.object({ removed: z.literal(true) }))
  .handler(async ({ input, context, errors }) => {
    const situation = createSituationErrors(errors);
    const orgId = context.session.activeOrganizationId;
    if (!orgId) throw situation.selectOrganization();
    const [partnership] = await db
      .select({ organizationId: partnerships.organizationId })
      .from(partnerships)
      .innerJoin(
        projects,
        and(
          eq(projects.id, partnerships.projectId),
          eq(projects.archived, false),
        ),
      )
      .where(eq(partnerships.id, input.partnershipId))
      .limit(1);
    if (!partnership || partnership.organizationId !== orgId)
      throw situation.partnershipNotFound();
    const [actor] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(eq(member.organizationId, orgId), eq(member.userId, context.user.id)),
      )
      .limit(1);
    if (!actor) throw situation.notMember();
    if (
      !(
        hasOrganizationRole(actor.role, ORGANIZATION_ROLES.OrganizationOwner) ||
        hasOrganizationRole(actor.role, ORGANIZATION_ROLES.OrganizationAdmin)
      )
    )
      throw situation.organizationManagementRequired();
    await db
      .delete(assignments)
      .where(
        and(
          eq(assignments.partnershipId, input.partnershipId),
          eq(assignments.userId, input.userId),
        ),
      );
    return { removed: true as const };
  });
