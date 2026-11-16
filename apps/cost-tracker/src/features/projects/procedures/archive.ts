import { db } from "@greendex/database";
import {
  claimsTable,
  costTrackerProjectArchiveEventsTable as archiveEvents,
  organization,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { canCompleteProject } from "@/features/claims/claim-lifecycle";
import { requireHostCoordination } from "@/features/projects/procedures/coordination";
import {
  ProjectDetailInputSchema,
  ReopenProjectInputSchema,
} from "@/features/projects/validation-schemas";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized, requireCostTrackerPermissions } from "@/lib/orpc/middleware";

const transitionResult = z.object({
  projectId: z.string(),
  archived: z.boolean(),
});

export const archiveProject = authorized
  .input(ProjectDetailInputSchema)
  .output(transitionResult)
  .meta(
    openapi({
      tags: ["Projects"],
      summary: "Archive a settled Cost Tracker project",
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw createSituationErrors(errors).selectOrganization();
    return db.transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id, archived: projects.costTrackerArchived })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, organizationId),
          ),
        )
        .for("update")
        .limit(1);
      if (!project) throw createSituationErrors(errors).projectNotFound();
      await requireHostCoordination(
        project.id,
        context.user.id,
        organizationId,
        errors,
        tx,
      );
      if (project.archived)
        throw createSituationErrors(errors).projectAlreadyArchived();
      const rows = await tx
        .select({ name: organization.name, status: claimsTable.status })
        .from(partnerships)
        .innerJoin(organization, eq(organization.id, partnerships.organizationId))
        .leftJoin(claimsTable, eq(claimsTable.partnershipId, partnerships.id))
        .where(eq(partnerships.projectId, project.id))
        .orderBy(asc(organization.name), asc(organization.id));
      if (!canCompleteProject(rows.map(({ status }) => status)))
        throw createSituationErrors(errors).projectArchiveBlocked();
      await tx
        .update(projects)
        .set({ costTrackerArchived: true })
        .where(eq(projects.id, project.id));
      await tx.insert(archiveEvents).values({
        projectId: project.id,
        userId: context.user.id,
        action: "archive",
      });
      return { projectId: project.id, archived: true };
    });
  });

export const reopenProject = authorized
  .use(requireCostTrackerPermissions({ project: ["reopen"] }))
  .input(ReopenProjectInputSchema)
  .output(transitionResult)
  .meta(openapi({ tags: ["Projects"], summary: "Reopen a Cost Tracker project" }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId!;
    return db.transaction(async (tx) => {
      const [project] = await tx
        .select({ id: projects.id, archived: projects.costTrackerArchived })
        .from(projects)
        .where(
          and(
            eq(projects.id, input.projectId),
            eq(projects.organizationId, organizationId),
          ),
        )
        .for("update")
        .limit(1);
      if (!project) throw createSituationErrors(errors).projectNotFound();
      await requireHostCoordination(
        project.id,
        context.user.id,
        organizationId,
        errors,
        tx,
      );
      if (!project.archived)
        throw createSituationErrors(errors).projectNotArchived();
      await tx
        .update(projects)
        .set({ costTrackerArchived: false })
        .where(eq(projects.id, project.id));
      await tx.insert(archiveEvents).values({
        projectId: project.id,
        userId: context.user.id,
        action: "reopen",
        reason: input.reason,
      });
      return { projectId: project.id, archived: false };
    });
  });
