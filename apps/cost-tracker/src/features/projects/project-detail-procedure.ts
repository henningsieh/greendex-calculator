import { db } from "@greendex/database";
import {
  organization,
  projectPartnerOrganizationsTable,
} from "@greendex/database/schema";
import { asc, eq } from "drizzle-orm";

import { resolveProjectRelationship } from "@/features/projects/project-relationship-procedure";
import {
  ProjectDetailInputSchema,
  ProjectDetailSchema,
} from "@/features/projects/validation-schemas";
import { authorized, hasCostTrackerPermissions } from "@/lib/orpc/middleware";

export const projectDetail = authorized
  .input(ProjectDetailInputSchema)
  .output(ProjectDetailSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw errors.FORBIDDEN({
        message: "Select an active Organization before opening a Project.",
      });
    }

    const [canReadHosted, canReadPartner] = await Promise.all([
      hasCostTrackerPermissions(context.headers, { project: ["read"] }),
      hasCostTrackerPermissions(context.headers, {
        project: ["read"],
        projectPartnership: ["read"],
      }),
    ]);
    if (!(canReadHosted || canReadPartner)) {
      throw errors.FORBIDDEN({
        message: "The active Organization role cannot read this Project.",
      });
    }

    const relationship = await resolveProjectRelationship({
      activeOrganizationId,
      projectId: input.projectId,
    });
    if (relationship.kind === "inaccessible") {
      throw errors.FORBIDDEN({
        message: "The active Organization cannot access this Project.",
      });
    }

    const project = {
      id: relationship.projectId,
      name: relationship.name,
      startDate: relationship.startDate,
      endDate: relationship.endDate,
      location: relationship.location,
      country: relationship.country,
      archived: relationship.archived,
      costSubmissionWindowOpen: relationship.costSubmissionWindowOpen,
    };

    if (relationship.kind === "partner") {
      if (!canReadPartner) {
        throw errors.FORBIDDEN({
          message:
            "The active Organization role cannot read this Project Partnership.",
        });
      }

      return {
        ...project,
        relationship: "partner" as const,
        hostingOrganization: relationship.hostingOrganization,
        partnership: {
          id: relationship.partnershipId,
          assignedAt: relationship.assignedAt,
          updatedAt: relationship.assignmentUpdatedAt,
        },
      };
    }

    if (!canReadHosted) {
      throw errors.FORBIDDEN({
        message: "The active Organization role cannot read this hosted Project.",
      });
    }

    const partnerOrganizations = await db
      .select({
        id: projectPartnerOrganizationsTable.id,
        organizationId: organization.id,
        organizationName: organization.name,
        assignedAt: projectPartnerOrganizationsTable.createdAt,
        updatedAt: projectPartnerOrganizationsTable.updatedAt,
      })
      .from(projectPartnerOrganizationsTable)
      .innerJoin(
        organization,
        eq(organization.id, projectPartnerOrganizationsTable.organizationId),
      )
      .where(eq(projectPartnerOrganizationsTable.projectId, input.projectId))
      .orderBy(asc(organization.name), asc(organization.id));

    return {
      ...project,
      relationship: "hosted" as const,
      partnerOrganizations,
    };
  });
