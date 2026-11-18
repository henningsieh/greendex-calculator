import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  claimsTable,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as partnerAssignments,
  projectPartnerOrganizationsTable,
  projectParticipantsTable,
  projectsTable,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import { and, asc, count, eq, isNull, or } from "drizzle-orm";

import { assignedPartnershipIds } from "@/features/partnerships/procedures/assigned-partnerships";
import { assignedHostProjectIds } from "@/features/projects/procedures/assigned-host-projects";
import { requireHostCoordination } from "@/features/projects/procedures/coordination";
import { authorizeCostTrackerProjectLifecycle } from "@/features/projects/procedures/lifecycle-authorization";
import {
  getHostedProjectScopeFilters,
  getPartnerProjectScopeFilters,
} from "@/features/projects/procedures/list";
import {
  ProjectDetailInputSchema,
  ProjectDetailSchema,
  ProjectListScopeAvailabilitySchema,
} from "@/features/projects/validation-schemas";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized, hasCostTrackerPermissions } from "@/lib/orpc/middleware";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ProjectRelationship =
  | { kind: "inaccessible" }
  | {
      kind: "hosted";
      projectId: string;
      name: string;
      startDate: Date;
      endDate: Date;
      location: string;
      country: string;
      archived: boolean;
      participantCount: number;
      hostingOrganization: { id: string; name: string };
    }
  | {
      kind: "partner";
      projectId: string;
      name: string;
      startDate: Date;
      endDate: Date;
      location: string;
      country: string;
      archived: boolean;
      participantCount: number;
      hostingOrganization: { id: string; name: string };
      partnershipId: string;
      assignedAt: Date;
      assignmentUpdatedAt: Date;
    };

export async function resolveRelationship({
  activeOrganizationId,
  projectId,
}: {
  activeOrganizationId: string;
  projectId: string;
}): Promise<ProjectRelationship> {
  const [row] = await db
    .select({
      projectId: projectsTable.id,
      name: projectsTable.name,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      location: projectsTable.location,
      country: projectsTable.country,
      archived: projectsTable.costTrackerArchived,
      hostingOrganizationId: organization.id,
      hostingOrganizationName: organization.name,
      partnershipId: projectPartnerOrganizationsTable.id,
      partnershipCreatedAt: projectPartnerOrganizationsTable.createdAt,
      partnershipUpdatedAt: projectPartnerOrganizationsTable.updatedAt,
    })
    .from(projectsTable)
    .innerJoin(organization, eq(organization.id, projectsTable.organizationId))
    .leftJoin(
      projectPartnerOrganizationsTable,
      and(
        eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
        eq(projectPartnerOrganizationsTable.organizationId, activeOrganizationId),
      ),
    )
    .where(
      and(
        eq(projectsTable.id, projectId),
        or(
          eq(projectsTable.organizationId, activeOrganizationId),
          eq(
            projectPartnerOrganizationsTable.organizationId,
            activeOrganizationId,
          ),
        ),
      ),
    )
    .limit(1);

  if (!row) return { kind: "inaccessible" };

  const common = {
    projectId: row.projectId,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.location,
    country: row.country,
    archived: row.archived,
    hostingOrganization: {
      id: row.hostingOrganizationId,
      name: row.hostingOrganizationName,
    },
  };

  // Participant headcount for the workspace stats. Scoped exactly like the
  // relationship itself: hosts see the whole Project, partners see only the
  // Participants their Organization represents. Merged duplicates never count.
  const participantFilters = [
    eq(projectParticipantsTable.projectId, row.projectId),
    isNull(projectParticipantsTable.mergedIntoParticipantId),
  ];
  if (row.hostingOrganizationId !== activeOrganizationId) {
    participantFilters.push(
      eq(
        projectParticipantsTable.representedOrganizationId,
        activeOrganizationId,
      ),
    );
  }
  const [participantCountRow] = await db
    .select({ value: count() })
    .from(projectParticipantsTable)
    .where(and(...participantFilters));
  const commonWithCount = {
    ...common,
    participantCount: participantCountRow?.value ?? 0,
  };

  if (row.hostingOrganizationId === activeOrganizationId) {
    return { kind: "hosted", ...commonWithCount };
  }

  if (row.partnershipId && row.partnershipCreatedAt && row.partnershipUpdatedAt) {
    return {
      kind: "partner",
      ...commonWithCount,
      partnershipId: row.partnershipId,
      assignedAt: row.partnershipCreatedAt,
      assignmentUpdatedAt: row.partnershipUpdatedAt,
    };
  }

  return { kind: "inaccessible" };
}

export const availableScopes = authorized
  .output(ProjectListScopeAvailabilitySchema)
  .meta(
    openapi({
      tags: ["Projects"],
      summary: "List available project scopes",
    }),
  )
  .handler(async ({ context, errors }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }

    const [canReadHostedPermission, canReadPartnerPermission] = await Promise.all(
      [
        hasCostTrackerPermissions(context.headers, { project: ["read"] }),
        hasCostTrackerPermissions(context.headers, {
          project: ["read"],
          projectPartnership: ["read"],
        }),
      ],
    );
    const [membership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, activeOrganizationId),
          eq(member.userId, context.user.id),
        ),
      )
      .limit(1);
    const canReadHosted =
      canReadHostedPermission &&
      !!membership &&
      (hasOrganizationRole(
        membership.role,
        ORGANIZATION_ROLES.OrganizationOwner,
      ) ||
        hasOrganizationRole(
          membership.role,
          ORGANIZATION_ROLES.OrganizationAdmin,
        ));
    // Assigned coordinators discover exactly their Partnerships; the role
    // alone still grants no Organization-wide overview.
    const assignedIds = canReadPartnerPermission
      ? []
      : await assignedPartnershipIds(context.user.id, activeOrganizationId);
    const canReadPartner = canReadPartnerPermission || assignedIds.length > 0;
    // The assignment path is Project Coordinator-only, mirroring listHosted:
    // Participant and other roles never take the assignment path, so the
    // signal can never announce a tab the list procedure would deny.
    const assignedHostIds =
      !canReadHosted &&
      !!membership &&
      hasOrganizationRole(membership.role, ORGANIZATION_ROLES.ProjectCoordinator)
        ? await assignedHostProjectIds(context.user.id, activeOrganizationId)
        : [];
    const [hostedRows, partnerRows] = await Promise.all([
      canReadHosted
        ? db
            .select({ id: projectsTable.id })
            .from(projectsTable)
            .where(and(...getHostedProjectScopeFilters(activeOrganizationId)))
            .limit(1)
        : [],
      canReadPartner
        ? db
            .select({ id: projectPartnerOrganizationsTable.id })
            .from(projectPartnerOrganizationsTable)
            .innerJoin(
              projectsTable,
              eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
            )
            .where(and(...getPartnerProjectScopeFilters(activeOrganizationId)))
            .limit(1)
        : [],
    ]);

    return {
      hosted: hostedRows.length > 0 || assignedHostIds.length > 0,
      partner: partnerRows.length > 0,
    };
  });

/**
 * Returns the active Organization's relationship-specific Project view.
 *
 * Hosted views include assigned Partner Organizations, while the Partnership
 * portion of Partner views exposes only the Hosting Organization and the active
 * Organization's assignment. Requests without relationship-specific access are
 * rejected.
 */
export const getProject = authorized
  .input(ProjectDetailInputSchema)
  .output(ProjectDetailSchema)
  .meta(
    openapi({
      tags: ["Projects"],
      summary: "Get project details",
    }),
  )
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }

    const [canReadHosted, canReadPartner] = await Promise.all([
      hasCostTrackerPermissions(context.headers, { project: ["read"] }),
      hasCostTrackerPermissions(context.headers, {
        project: ["read"],
        projectPartnership: ["read"],
      }),
    ]);
    const [membership] = await db
      .select({ role: member.role })
      .from(member)
      .where(
        and(
          eq(member.organizationId, activeOrganizationId),
          eq(member.userId, context.user.id),
        ),
      )
      .limit(1);
    if (!membership) throw createSituationErrors(errors).notMember();
    const canCoordinateHosted =
      membership &&
      (hasOrganizationRole(
        membership.role,
        ORGANIZATION_ROLES.OrganizationOwner,
      ) ||
        hasOrganizationRole(
          membership.role,
          ORGANIZATION_ROLES.OrganizationAdmin,
        ) ||
        hasOrganizationRole(
          membership.role,
          ORGANIZATION_ROLES.ProjectCoordinator,
        ));
    if (!(canReadHosted || canReadPartner || canCoordinateHosted)) {
      throw createSituationErrors(errors).projectReadRequired();
    }

    const relationship = await resolveRelationship({
      activeOrganizationId,
      projectId: input.projectId,
    });
    if (relationship.kind === "inaccessible") {
      throw createSituationErrors(errors).projectNotFound();
    }

    // Whole days until endDate, never -0: inside the final 24 hours after
    // expiry Math.ceil collapses to -0, which the workspace reads as
    // "0 days left" instead of "Ended". Every other past date keeps its
    // negative magnitude.
    const msLeft = relationship.endDate.getTime() - Date.now();
    const roundedDays = Math.ceil(msLeft / MS_PER_DAY);
    const daysLeft = roundedDays === 0 && msLeft < 0 ? -1 : roundedDays;
    const project = {
      id: relationship.projectId,
      name: relationship.name,
      startDate: relationship.startDate,
      endDate: relationship.endDate,
      location: relationship.location,
      country: relationship.country,
      archived: relationship.archived,
      participantCount: relationship.participantCount,
      daysLeft,
    };

    if (relationship.kind === "partner") {
      if (!canReadPartner) {
        // Assignment-scoped coordinators may read exactly the Partnership
        // they are assigned to; membership plus assignment, never role alone.
        const [assignment] = await db
          .select({ userId: partnerAssignments.userId })
          .from(partnerAssignments)
          .where(
            and(
              eq(partnerAssignments.partnershipId, relationship.partnershipId),
              eq(partnerAssignments.userId, context.user.id),
            ),
          )
          .limit(1);
        if (!assignment || !membership) {
          throw createSituationErrors(errors).partnerCoordinationRequired();
        }
      }

      const [claim] = await db
        .select({ status: claimsTable.status })
        .from(claimsTable)
        .where(eq(claimsTable.partnershipId, relationship.partnershipId))
        .limit(1);

      return {
        ...project,
        relationship: "partner" as const,
        hostingOrganization: relationship.hostingOrganization,
        partnership: {
          claimStatus: claim?.status ?? null,
          id: relationship.partnershipId,
          assignedAt: relationship.assignedAt,
          updatedAt: relationship.assignmentUpdatedAt,
        },
      };
    }

    if (!canCoordinateHosted) {
      throw createSituationErrors(errors).hostingStaffRequired();
    }

    const hostedDetail = await db.transaction(async (transaction) => {
      const [hostedProject] = await transaction
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, input.projectId),
            eq(projectsTable.organizationId, activeOrganizationId),
          ),
        )
        .for("share")
        .limit(1);
      if (!hostedProject) {
        throw createSituationErrors(errors).projectNotFound();
      }
      await requireHostCoordination(
        hostedProject.id,
        context.user.id,
        activeOrganizationId,
        errors,
        transaction,
      );

      const partnerOrganizations = await transaction
        .select({
          id: projectPartnerOrganizationsTable.id,
          organizationId: organization.id,
          organizationName: organization.name,
          assignedAt: projectPartnerOrganizationsTable.createdAt,
          updatedAt: projectPartnerOrganizationsTable.updatedAt,
          claimStatus: claimsTable.status,
        })
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          organization,
          eq(organization.id, projectPartnerOrganizationsTable.organizationId),
        )
        .leftJoin(
          claimsTable,
          eq(claimsTable.partnershipId, projectPartnerOrganizationsTable.id),
        )
        .where(eq(projectPartnerOrganizationsTable.projectId, hostedProject.id))
        .orderBy(asc(organization.name), asc(organization.id));
      const request = {
        executor: transaction,
        projectId: hostedProject.id,
        actorId: context.user.id,
        activeOrganizationId,
      };
      const [archive, reopen] = await Promise.all([
        authorizeCostTrackerProjectLifecycle({ ...request, action: "archive" }),
        authorizeCostTrackerProjectLifecycle({ ...request, action: "reopen" }),
      ]);
      return {
        partnerOrganizations,
        canArchive: archive.allowed,
        canReopen: reopen.allowed,
      };
    });

    return {
      ...project,
      relationship: "hosted" as const,
      ...hostedDetail,
    };
  });
