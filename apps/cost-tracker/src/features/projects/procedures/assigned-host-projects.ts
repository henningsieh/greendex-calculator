import "server-only";
import { db } from "@greendex/database";
import {
  hostProjectAssignmentsTable as hostAssignments,
  projectsTable,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

/**
 * Hosted Projects in one Organization explicitly assigned to one coordinator.
 * DB-only helper shared by procedure gates so every gate enforces the same
 * assignment scope. Assignment scope narrows Hosted discovery: it never
 * widens it. Archived Projects never count, mirroring the visibility
 * predicates listHosted already applies — availability must not promise
 * what the list will not show.
 */
export async function assignedHostProjectIds(
  userId: string,
  organizationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: hostAssignments.projectId })
    .from(hostAssignments)
    .innerJoin(projectsTable, eq(projectsTable.id, hostAssignments.projectId))
    .where(
      and(
        eq(hostAssignments.userId, userId),
        eq(projectsTable.organizationId, organizationId),
        eq(projectsTable.costTrackerArchived, false),
      ),
    );
  return rows.map((row) => row.id);
}
