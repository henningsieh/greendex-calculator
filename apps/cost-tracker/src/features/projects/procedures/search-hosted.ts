import { hasOrganizationRole } from "@greendex/auth";
import "server-only";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as assignments,
  member,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, asc, desc, eq, exists, or, sql } from "drizzle-orm";
import { z } from "zod";

import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized } from "@/lib/orpc/middleware";

/**
 * Picker search over hosted Projects. Two modes share one endpoint:
 * - Empty search (""): browse preload, newest first — the projects most
 *   likely awaiting a Partner Organization assignment surface on top.
 * - Typed search: server-filtered over the full table, alphabetical, so a
 *   2+ character query reaches any hosted project.
 * Both modes cap at 20 rows. The cap never blocks assignment (the filter
 * runs before the limit); it only bounds the browse view.
 */
export const searchHosted = authorized
  .input(
    z.object({
      search: z
        .string()
        .trim()
        .max(128)
        .refine((value) => value.length !== 1),
    }),
  )
  .output(z.array(z.object({ id: z.string(), name: z.string() })).max(20))
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId)
      throw createSituationErrors(errors).selectOrganization();
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
    const isManager =
      hasOrganizationRole(
        membership.role,
        ORGANIZATION_ROLES.OrganizationOwner,
      ) ||
      hasOrganizationRole(membership.role, ORGANIZATION_ROLES.OrganizationAdmin);
    if (
      !isManager &&
      !hasOrganizationRole(membership.role, ORGANIZATION_ROLES.ProjectCoordinator)
    )
      throw createSituationErrors(errors).hostingStaffRequired();

    const escaped = input.search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    return (
      db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(
          and(
            eq(projects.organizationId, activeOrganizationId),
            eq(projects.archived, false),
            input.search
              ? or(
                  sql`lower(${projects.name}) like lower(${pattern}) escape '\\'`,
                  sql`lower(${projects.id}) like lower(${pattern}) escape '\\'`,
                )
              : undefined,
            isManager
              ? undefined
              : exists(
                  db
                    .select({ userId: assignments.userId })
                    .from(assignments)
                    .where(
                      and(
                        eq(assignments.projectId, projects.id),
                        eq(assignments.userId, context.user.id),
                      ),
                    ),
                ),
          ),
        )
        .orderBy(
          // Browse mode surfaces newest projects first; typed search stays
          // alphabetical so matches scan predictably.
          ...(input.search
            ? [asc(projects.name), asc(projects.id)]
            : [desc(projects.createdAt), asc(projects.id)]),
        )
        // Picker page size — the filter above runs first, so typing reaches
        // every hosted project regardless of this cap.
        .limit(20)
    );
  });
