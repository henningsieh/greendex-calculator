import "server-only";
import { db } from "@greendex/database";
import {
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
import { and, eq, or } from "drizzle-orm";

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
      costSubmissionWindowOpen: boolean;
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
      costSubmissionWindowOpen: boolean;
      hostingOrganization: { id: string; name: string };
      partnershipId: string;
      assignedAt: Date;
      assignmentUpdatedAt: Date;
    };

export async function resolveProjectRelationship({
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
      archived: projectsTable.archived,
      costSubmissionWindowOpen: projectsTable.costSubmissionWindowOpen,
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
    costSubmissionWindowOpen: row.costSubmissionWindowOpen,
    hostingOrganization: {
      id: row.hostingOrganizationId,
      name: row.hostingOrganizationName,
    },
  };

  if (row.hostingOrganizationId === activeOrganizationId) {
    return { kind: "hosted", ...common };
  }

  if (row.partnershipId && row.partnershipCreatedAt && row.partnershipUpdatedAt) {
    return {
      kind: "partner",
      ...common,
      partnershipId: row.partnershipId,
      assignedAt: row.partnershipCreatedAt,
      assignmentUpdatedAt: row.partnershipUpdatedAt,
    };
  }

  return { kind: "inaccessible" };
}
