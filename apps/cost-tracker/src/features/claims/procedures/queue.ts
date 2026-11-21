import "server-only";
import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  claimsTable,
  member,
  organization,
  projectPartnerOrganizationsTable as partnerships,
  projectsTable,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  gt,
  inArray,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  decodeClaimQueueCursor,
  encodeClaimQueueCursor,
  getClaimQueueFingerprint,
  type ClaimQueueCursor,
} from "@/features/claims/queue-cursor.server";
import {
  ClaimQueueInputSchema,
  ClaimQueueOutputSchema,
  type ClaimQueueInput,
  type ClaimQueueRow,
  type ClaimQueueSort,
} from "@/features/claims/queue-schemas";
import { assignedHostProjectIds } from "@/features/projects/procedures/assigned-host-projects";
import { enforceListingLimit } from "@/features/quotas/procedures/counters";
import { createSituationErrors } from "@/lib/orpc/errors";
import { authorized, hasCostTrackerPermissions } from "@/lib/orpc/middleware";

type SortField = "submitted" | "project" | "partner";
type SortDirection = "asc" | "desc";

function sortField(sort: ClaimQueueSort): SortField {
  return sort.startsWith("submitted")
    ? "submitted"
    : sort.startsWith("project")
      ? "project"
      : "partner";
}

function sortDirection(sort: ClaimQueueSort): SortDirection {
  return sort.endsWith("-desc") ? "desc" : "asc";
}

function getSortExpression(field: SortField) {
  if (field === "submitted") return claimsTable.updatedAt;
  if (field === "project") return sql<string>`lower(${projectsTable.name})`;
  return sql<string>`lower(${organization.name})`;
}

function getOrder(
  sort: ClaimQueueSort,
  direction: ClaimQueueCursor["direction"] = "next",
) {
  const field = sortField(sort);
  const ascending = sortDirection(sort) === "asc";
  const expression = getSortExpression(field);
  const order = ascending === (direction === "next") ? asc : desc;
  return [order(expression), order(claimsTable.id)];
}

function getCursorFilter(sort: ClaimQueueSort, cursor: ClaimQueueCursor): SQL {
  const field = sortField(sort);
  const direction = sortDirection(sort);
  const expression = getSortExpression(field);
  const value = field === "submitted" ? new Date(cursor.value) : cursor.value;
  const forward =
    cursor.direction === "next" ? direction === "asc" : direction === "desc";

  return or(
    forward ? sql`${expression} > ${value}` : sql`${expression} < ${value}`,
    and(
      sql`${expression} = ${value}`,
      forward ? gt(claimsTable.id, cursor.id) : lt(claimsTable.id, cursor.id),
    ),
  ) as SQL;
}

function getSearchFilter(search: string): SQL {
  const escaped = search.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;
  return sql`(lower(${projectsTable.name}) like ${pattern} escape '\\' or lower(${organization.name}) like ${pattern} escape '\\')`;
}

function getScopeFilters(
  activeOrganizationId: string,
  assignedIds: string[],
): SQL[] {
  const filters: SQL[] = [
    eq(projectsTable.organizationId, activeOrganizationId),
    eq(claimsTable.status, "submitted"),
    eq(projectsTable.costTrackerArchived, false),
  ];
  if (assignedIds.length > 0) {
    filters.push(inArray(projectsTable.id, assignedIds));
  }
  return filters;
}

function getFilteredFilters(
  scopeFilters: SQL[],
  input: ClaimQueueInput,
  search: string | undefined,
): SQL[] {
  const filters = [...scopeFilters];
  if (search) filters.push(getSearchFilter(search));
  if (input.partnerOrganizationId)
    filters.push(eq(organization.id, input.partnerOrganizationId));
  return filters;
}

function getRowSelection() {
  return {
    partnershipId: partnerships.id,
    projectId: projectsTable.id,
    projectName: projectsTable.name,
    organizationId: organization.id,
    organizationName: organization.name,
    status: claimsTable.status,
    submittedAt: claimsTable.updatedAt,
    payableAmountEur: claimsTable.approvedAmountEur,
  };
}

function metricSelection() {
  return {
    claimCount: countDistinct(claimsTable.id),
    projectCount: countDistinct(projectsTable.id),
    partnerOrganizationCount: countDistinct(organization.id),
  };
}

function mapMetrics(
  value:
    | {
        claimCount: number;
        projectCount: number;
        partnerOrganizationCount: number;
      }
    | undefined,
) {
  return {
    claimCount: value?.claimCount ?? 0,
    projectCount: value?.projectCount ?? 0,
    partnerOrganizationCount: value?.partnerOrganizationCount ?? 0,
  };
}

function finalizePage(
  pageRows: ClaimQueueRow[],
  input: ClaimQueueInput,
  cursor: ClaimQueueCursor | undefined,
  fingerprint: string,
) {
  const isPreviousPage = cursor?.direction === "previous";
  const hasAdditionalRows = pageRows.length > input.pageSize;
  const rows = pageRows.slice(0, input.pageSize);
  if (isPreviousPage) rows.reverse();

  const firstRow = rows[0];
  const lastRow = rows.at(-1);
  const hasPrevious = isPreviousPage ? hasAdditionalRows : Boolean(cursor);
  const hasNext = isPreviousPage ? Boolean(cursor) : hasAdditionalRows;
  const cursorValue = (row: ClaimQueueRow) =>
    sortField(input.sort) === "submitted"
      ? row.submittedAt.toISOString()
      : sortField(input.sort) === "project"
        ? row.projectName.toLowerCase()
        : row.organizationName.toLowerCase();
  const createCursor = (
    direction: ClaimQueueCursor["direction"],
    row: ClaimQueueRow,
  ) =>
    encodeClaimQueueCursor({
      version: 1,
      direction,
      fingerprint,
      id: row.partnershipId,
      value: cursorValue(row),
    });

  return {
    rows,
    previousCursor:
      hasPrevious && firstRow ? createCursor("previous", firstRow) : undefined,
    nextCursor: hasNext && lastRow ? createCursor("next", lastRow) : undefined,
  };
}

export const listReviewQueue = authorized
  .input(ClaimQueueInputSchema)
  .output(ClaimQueueOutputSchema)
  .meta(
    openapi({
      tags: ["Claims"],
      summary: "List submitted claims awaiting hosting review",
    }),
  )
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }

    const canReadHostedPermission = await hasCostTrackerPermissions(
      context.headers,
      { project: ["read"] },
    );
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

    const canReadHosted =
      canReadHostedPermission &&
      (hasOrganizationRole(
        membership.role,
        ORGANIZATION_ROLES.OrganizationOwner,
      ) ||
        hasOrganizationRole(
          membership.role,
          ORGANIZATION_ROLES.OrganizationAdmin,
        ));
    let assignedIds: string[] = [];
    if (
      !canReadHosted &&
      hasOrganizationRole(membership.role, ORGANIZATION_ROLES.ProjectCoordinator)
    ) {
      assignedIds = await assignedHostProjectIds(
        context.user.id,
        activeOrganizationId,
      );
    }
    if (!canReadHosted && assignedIds.length === 0) {
      throw createSituationErrors(errors).organizationManagementRequired();
    }

    await enforceListingLimit(
      { userId: context.user.id, organizationId: activeOrganizationId },
      errors,
    );

    const search = input.search?.trim().toLocaleLowerCase("en") || undefined;
    const fingerprint = getClaimQueueFingerprint({
      ...input,
      search,
    });
    const cursor = input.cursor
      ? (decodeClaimQueueCursor(input.cursor, fingerprint) ?? undefined)
      : undefined;
    if (input.cursor && !cursor) {
      throw createSituationErrors(errors).invalidClaimQueueCursor();
    }

    const wholeFilters = getScopeFilters(activeOrganizationId, assignedIds);
    const filteredFilters = getFilteredFilters(wholeFilters, input, search);
    const pageFilters = [...filteredFilters];
    if (cursor) pageFilters.push(getCursorFilter(input.sort, cursor));

    const [pageRows, wholeMetricRows, filteredMetricRows, partnerOptions] =
      await Promise.all([
        db
          .select(getRowSelection())
          .from(claimsTable)
          .innerJoin(partnerships, eq(partnerships.id, claimsTable.partnershipId))
          .innerJoin(projectsTable, eq(projectsTable.id, partnerships.projectId))
          .innerJoin(
            organization,
            eq(organization.id, partnerships.organizationId),
          )
          .where(and(...pageFilters))
          .orderBy(...getOrder(input.sort, cursor?.direction))
          .limit(input.pageSize + 1),
        db
          .select(metricSelection())
          .from(claimsTable)
          .innerJoin(partnerships, eq(partnerships.id, claimsTable.partnershipId))
          .innerJoin(projectsTable, eq(projectsTable.id, partnerships.projectId))
          .innerJoin(
            organization,
            eq(organization.id, partnerships.organizationId),
          )
          .where(and(...wholeFilters)),
        db
          .select(metricSelection())
          .from(claimsTable)
          .innerJoin(partnerships, eq(partnerships.id, claimsTable.partnershipId))
          .innerJoin(projectsTable, eq(projectsTable.id, partnerships.projectId))
          .innerJoin(
            organization,
            eq(organization.id, partnerships.organizationId),
          )
          .where(and(...filteredFilters)),
        db
          .selectDistinct({ id: organization.id, name: organization.name })
          .from(claimsTable)
          .innerJoin(partnerships, eq(partnerships.id, claimsTable.partnershipId))
          .innerJoin(projectsTable, eq(projectsTable.id, partnerships.projectId))
          .innerJoin(
            organization,
            eq(organization.id, partnerships.organizationId),
          )
          .where(and(...wholeFilters))
          .orderBy(asc(organization.name), asc(organization.id)),
      ]);

    return {
      ...finalizePage(pageRows, input, cursor, fingerprint),
      metrics: {
        whole: mapMetrics(wholeMetricRows[0]),
        filtered: mapMetrics(filteredMetricRows[0]),
      },
      partnerOptions,
    };
  });
