import { addOrganizationRole, hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable,
  member,
  projectsTable,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { ProjectCreateInputSchema } from "@/features/projects/validation-schemas";
import { authorized } from "@/lib/orpc/middleware";

export const create = authorized
  .input(ProjectCreateInputSchema)
  .output(z.object({ id: z.string() }))
  .handler(async ({ context, errors, input }) => {
    const organizationId = context.session.activeOrganizationId;
    if (!organizationId) {
      throw errors.FORBIDDEN({ message: "Select an active Organization first." });
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
        throw errors.FORBIDDEN({
          message: "Hosting Organization membership is required.",
        });
      }

      const [project] = await tx
        .insert(projectsTable)
        .values({ ...input, organizationId })
        .returning({ id: projectsTable.id });
      if (!project) throw errors.INTERNAL_SERVER_ERROR();

      await tx.insert(hostProjectAssignmentsTable).values({
        projectId: project.id,
        userId: context.user.id,
      });
      if (
        !hasOrganizationRole(membership.role, "owner") &&
        !hasOrganizationRole(membership.role, "admin")
      ) {
        const role = addOrganizationRole(membership.role, "project-coordinator");
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
