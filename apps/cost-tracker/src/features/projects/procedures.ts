import { db } from "@greendex/database";
import { z } from "zod";

import {
  PartnerOrganizationListItemSchema,
  ProjectListItemSchema,
} from "@/features/projects/validation-schemas";
import { authorized, requireCostTrackerPermissions } from "@/lib/orpc/middleware";

export const listProjects = authorized
  .use(requireCostTrackerPermissions({ project: ["read"] }))
  .route({ method: "GET", path: "/projects", summary: "List active Projects" })
  .output(z.array(ProjectListItemSchema))
  .handler(async ({ context }) => {
    const projects = await db.query.projectsTable.findMany({
      where: (project, { and, eq }) =>
        and(
          eq(project.organizationId, context.session.activeOrganizationId!),
          eq(project.archived, false),
        ),
      orderBy: (project, { asc }) => [asc(project.startDate)],
      columns: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        location: true,
        costSubmissionWindowOpen: true,
      },
      with: {
        partnerOrganizations: { columns: { id: true } },
      },
    });

    return projects.map(({ partnerOrganizations, ...project }) => ({
      ...project,
      partnerOrganizationCount: partnerOrganizations.length,
    }));
  });

export const listPartnerOrganizations = authorized
  .use(
    requireCostTrackerPermissions({
      project: ["read"],
      projectPartnership: ["read"],
    }),
  )
  .route({
    method: "GET",
    path: "/partner-organizations",
    summary: "List Partner Organizations assigned to active Projects",
  })
  .output(z.array(PartnerOrganizationListItemSchema))
  .handler(async ({ context }) => {
    const projects = await db.query.projectsTable.findMany({
      where: (project, { and, eq }) =>
        and(
          eq(project.organizationId, context.session.activeOrganizationId!),
          eq(project.archived, false),
        ),
      columns: { name: true },
      with: {
        partnerOrganizations: {
          columns: {},
          with: { organization: { columns: { id: true, name: true } } },
        },
      },
    });

    const organizations = new Map<
      string,
      { id: string; name: string; projectNames: string[] }
    >();

    for (const project of projects) {
      for (const partnership of project.partnerOrganizations) {
        const existing = organizations.get(partnership.organization.id);
        if (existing) {
          existing.projectNames.push(project.name);
        } else {
          organizations.set(partnership.organization.id, {
            id: partnership.organization.id,
            name: partnership.organization.name,
            projectNames: [project.name],
          });
        }
      }
    }

    return [...organizations.values()].sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  });
