import { addOrganizationRole, hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  member,
  projectsTable,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireCostTrackerRole } from "@/features/organizations/roles";
import { ProjectCreateInputSchema } from "@/features/projects/validation-schemas";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

export const create = authorized
  .input(ProjectCreateInputSchema)
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, errors, input }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }

    return db.transaction(async (tx) => {
      const [membership] = await tx
        .select({ id: member.id, role: member.role })
        .from(member)
        .where(
          and(
            eq(member.organizationId, organizationId),
            eq(member.userId, context.user.id),
          ),
        )
        .for("update")
        .limit(1);
      if (!membership) {
        throw createSituationErrors(errors).notMember();
      }

      requireCostTrackerRole(membership.role, () =>
        createSituationErrors(errors).invalidOrganizationRole(),
      );
      const [project] = await tx
        .insert(projectsTable)
        .values({ ...input, organizationId })
        .returning({ id: projectsTable.id });
      if (!project) throw createSituationErrors(errors).internalFailure();

      await tx.insert(hostProjectAssignmentsTable).values({
        projectId: project.id,
        userId: context.user.id,
      });
      if (
        !hasOrganizationRole(
          membership.role,
          ORGANIZATION_ROLES.OrganizationOwner,
        ) &&
        !hasOrganizationRole(
          membership.role,
          ORGANIZATION_ROLES.OrganizationAdmin,
        )
      ) {
        const role = addOrganizationRole(
          membership.role,
          ORGANIZATION_ROLES.ProjectCoordinator,
        );
        if (role !== membership.role) {
          await tx
            .update(member)
            .set({ role })
            .where(eq(member.id, membership.id));
        }
      }
      return project;
    });
  });
