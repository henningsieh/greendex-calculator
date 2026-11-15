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
 * widens it.
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
      ),
    );
  return rows.map((row) => row.id);
}
