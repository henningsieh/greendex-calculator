import { db } from "@greendex/database";
import {
  claimsTable,
  costTrackerProjectArchiveEventsTable as archiveEvents,
  organization,
  partnerOrganizationSetupLinksTable as setupLinks,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable as projects,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  authorizeCostTrackerProjectLifecycle,
  requireLifecycleDecision,
} from "@/features/projects/procedures/lifecycle-authorization";
import {
  evaluateProjectTransition,
  projectSettlement,
} from "@/features/projects/project-lifecycle";
import {
  ProjectDetailInputSchema,
  ReopenProjectInputSchema,
} from "@/features/projects/validation-schemas";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

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
    requireLifecycleDecision(
      await authorizeCostTrackerProjectLifecycle({
        executor: db,
        projectId: input.projectId,
        actorId: context.user.id,
        activeOrganizationId: organizationId,
        action: "archive",
      }),
      errors,
    );
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
      requireLifecycleDecision(
        await authorizeCostTrackerProjectLifecycle({
          executor: tx,
          projectId: project.id,
          actorId: context.user.id,
          activeOrganizationId: organizationId,
          action: "archive",
        }),
        errors,
      );
      const rows = await tx
        .select({ name: organization.name, status: claimsTable.status })
        .from(partnerships)
        .innerJoin(organization, eq(organization.id, partnerships.organizationId))
        .leftJoin(claimsTable, eq(claimsTable.partnershipId, partnerships.id))
        .where(eq(partnerships.projectId, project.id))
        .orderBy(asc(organization.name), asc(organization.id));
      const decision = evaluateProjectTransition(
        project.archived ? "archived" : "active",
        "archive",
        {
          settled:
            projectSettlement(
              project.archived,
              rows.map(({ status }) => status),
            ) === "ready",
        },
      );
      if (decision.kind === "refused")
        throw decision.reason === "invalidState"
          ? createSituationErrors(errors).projectAlreadyArchived()
          : createSituationErrors(errors).projectArchiveBlocked();
      const archived = decision.state === "archived";
      await tx
        .update(setupLinks)
        .set({ enabled: false })
        .where(eq(setupLinks.projectId, project.id));
      await tx
        .update(projects)
        .set({ costTrackerArchived: archived })
        .where(eq(projects.id, project.id));
      await tx.insert(archiveEvents).values({
        projectId: project.id,
        userId: context.user.id,
        action: "archive",
      });
      return { projectId: project.id, archived };
    });
  });

export const reopenProject = authorized
  .input(ReopenProjectInputSchema)
  .output(transitionResult)
  .meta(openapi({ tags: ["Projects"], summary: "Reopen a Cost Tracker project" }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) throw createSituationErrors(errors).selectOrganization();
    requireLifecycleDecision(
      await authorizeCostTrackerProjectLifecycle({
        executor: db,
        projectId: input.projectId,
        actorId: context.user.id,
        activeOrganizationId: organizationId,
        action: "reopen",
      }),
      errors,
    );
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
      requireLifecycleDecision(
        await authorizeCostTrackerProjectLifecycle({
          executor: tx,
          projectId: project.id,
          actorId: context.user.id,
          activeOrganizationId: organizationId,
          action: "reopen",
        }),
        errors,
      );
      const decision = evaluateProjectTransition(
        project.archived ? "archived" : "active",
        "reopen",
        { reason: Boolean(input.reason) },
      );
      if (decision.kind === "refused")
        throw decision.reason === "invalidState"
          ? createSituationErrors(errors).projectNotArchived()
          : createSituationErrors(errors).badInput();
      const archived = decision.state === "archived";
      await tx
        .update(projects)
        .set({ costTrackerArchived: archived })
        .where(eq(projects.id, project.id));
      await tx.insert(archiveEvents).values({
        projectId: project.id,
        userId: context.user.id,
        action: "reopen",
        reason: input.reason,
      });
      return { projectId: project.id, archived };
    });
  });
