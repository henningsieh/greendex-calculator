import "server-only";
import { db } from "@greendex/database";
import {
  partnerCoordinatorAssignmentsTable as partnerAssignments,
  projectPartnerOrganizationsTable,
} from "@greendex/database/schema";
import { and, eq } from "drizzle-orm";

/**
 * Partnerships in one Organization explicitly assigned to one coordinator.
 * DB-only helper shared by procedure gates and presentation gates so both
 * sides enforce the same assignment scope. Assignment scope narrows Partner
 * discovery: it never widens it.
 */
export async function assignedPartnershipIds(
  userId: string,
  organizationId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: projectPartnerOrganizationsTable.id })
    .from(partnerAssignments)
    .innerJoin(
      projectPartnerOrganizationsTable,
      eq(projectPartnerOrganizationsTable.id, partnerAssignments.partnershipId),
    )
    .where(
      and(
        eq(partnerAssignments.userId, userId),
        eq(projectPartnerOrganizationsTable.organizationId, organizationId),
      ),
    );
  return rows.map((row) => row.id);
}
