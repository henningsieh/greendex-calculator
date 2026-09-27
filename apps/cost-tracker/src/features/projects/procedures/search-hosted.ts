import "server-only";
import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as assignments,
  member,
  projectsTable as projects,
} from "@greendex/database/schema";
import { and, asc, eq, exists, or, sql } from "drizzle-orm";
import { z } from "zod";

import { authorized } from "@/lib/orpc/middleware";

export const searchHosted = authorized
  .input(z.object({ search: z.string().trim().min(2).max(128) }))
  .output(z.array(z.object({ id: z.string(), name: z.string() })).max(20))
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId)
      throw errors.FORBIDDEN({ message: "Select an active Organization." });
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
    if (!membership)
      throw errors.FORBIDDEN({ message: "Hosted Projects are unavailable." });
    const isManager =
      hasOrganizationRole(membership.role, "owner") ||
      hasOrganizationRole(membership.role, "admin");
    if (
      !isManager &&
      !hasOrganizationRole(membership.role, "project-coordinator")
    )
      throw errors.FORBIDDEN({ message: "Hosted Projects are unavailable." });

    const escaped = input.search.replace(/[\\%_]/g, "\\$&");
    const pattern = `%${escaped}%`;
    return db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.organizationId, activeOrganizationId),
          eq(projects.archived, false),
          or(
            sql`lower(${projects.name}) like lower(${pattern}) escape '\\'`,
            sql`lower(${projects.id}) like lower(${pattern}) escape '\\'`,
          ),
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
      .orderBy(asc(projects.name), asc(projects.id))
      .limit(20);
  });
