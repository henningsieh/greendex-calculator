import { hasOrganizationRole } from "@greendex/auth";
import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import "server-only";
import { db } from "@greendex/database";
import {
  claimsTable,
  member,
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
import { openapi } from "@orpc/openapi";
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  exists,
  gt,
  gte,
  inArray,
  lt,
  lte,
  notExists,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { assignedPartnershipIds } from "@/features/partnerships/procedures/assigned-partnerships";
import {
  decodeProjectListCursor,
  encodeProjectListCursor,
  getProjectListFingerprint,
  type ProjectListCursor,
} from "@/features/projects/list-cursor.server";
import { assignedHostProjectIds } from "@/features/projects/procedures/assigned-host-projects";
import type {
  PartnerProjectList,
  ProjectListInput,
} from "@/features/projects/types";
import {
  HostedProjectListInputSchema,
  HostedProjectListSchema,
  PartnerProjectListInputSchema,
  PartnerProjectListSchema,
} from "@/features/projects/validation-schemas";
import { enforceListingLimit } from "@/features/quotas/procedures/counters";
import {
  createSituationErrors,
  type SituationErrorConstructors,
} from "@/lib/orpc/errors";
import { authorized, hasCostTrackerPermissions } from "@/lib/orpc/middleware";

const blockers = db
  .select({ id: projectPartnerOrganizationsTable.id })
  .from(projectPartnerOrganizationsTable)
  .where(
    and(
      eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
      notExists(
        db
          .select({ id: claimsTable.id })
          .from(claimsTable)
          .where(
            and(
              eq(claimsTable.partnershipId, projectPartnerOrganizationsTable.id),
              inArray(claimsTable.status, ["paid", "rejected"]),
            ),
          ),
      ),
    ),
  );
const settlementRank =
  sql<number>`case when ${projectsTable.costTrackerArchived} then 2 when ${exists(blockers)} then 0 else 1 end`.mapWith(
    Number,
  );

function getProjectFilters(input: ProjectListInput): SQL[] {
  const filters: SQL[] = [];

  if (input.search) {
    const escapedSearch = input.search.replace(/[\\%_]/g, "\\$&");
    filters.push(
      sql`lower(${projectsTable.name}) like ${`%${escapedSearch}%`} escape '\\'`,
    );
  }
  if (input.dateFrom) filters.push(gte(projectsTable.endDate, input.dateFrom));
  if (input.dateTo) filters.push(lte(projectsTable.startDate, input.dateTo));

  if (input.archive !== "all") {
    filters.push(
      eq(projectsTable.costTrackerArchived, input.archive === "archived"),
    );
  }
  if (input.settlement !== "all") {
    filters.push(eq(projectsTable.costTrackerArchived, false));
    filters.push(
      input.settlement === "open" ? exists(blockers) : notExists(blockers),
    );
  }

  return filters;
}

type ProjectCursorDirection = ProjectListCursor["direction"];
type ProjectListCursorRow = Pick<
  typeof projectsTable.$inferSelect,
  "endDate" | "id" | "startDate" | "name"
> & { settlementRank: number };

function allOf(...conditions: SQL[]): SQL {
  const condition = and(...conditions);
  if (!condition) throw new Error("Expected at least one SQL condition.");
  return condition;
}

function anyOf(...conditions: SQL[]): SQL {
  const condition = or(...conditions);
  if (!condition) throw new Error("Expected at least one SQL condition.");
  return condition;
}

const PROJECT_SORT_DESCRIPTORS = {
  settlement: {
    expression: settlementRank,
    value: (row: ProjectListCursorRow) => ({
      field: "settlement" as const,
      value: row.settlementRank,
    }),
  },
  name: {
    expression: projectsTable.name,
    value: () => ({
      field: "name" as const,
    }),
  },
  startDate: {
    expression: projectsTable.startDate,
    value: (row: ProjectListCursorRow) => ({
      field: "startDate" as const,
      value: row.startDate.toISOString(),
    }),
  },
  endDate: {
    expression: projectsTable.endDate,
    value: (row: ProjectListCursorRow) => ({
      field: "endDate" as const,
      value: row.endDate.toISOString(),
    }),
  },
};

function getOrder(
  sort: ProjectListInput["sort"],
  direction: ProjectCursorDirection,
) {
  return [
    ...sort.map(({ field, direction: order }) => {
      const expression = PROJECT_SORT_DESCRIPTORS[field].expression;
      return (order === "asc") === (direction === "next")
        ? asc(expression)
        : desc(expression);
    }),
    direction === "next" ? asc(projectsTable.id) : desc(projectsTable.id),
  ];
}

function getCursorFilter(
  sort: ProjectListInput["sort"],
  cursor: ProjectListCursor,
  cursorName: string | undefined,
): SQL {
  const equals: SQL[] = [];
  const alternatives: SQL[] = [];
  for (const [index, criterion] of sort.entries()) {
    const value = cursor.values[index];
    if (
      !value ||
      value.field !== criterion.field ||
      (value.field === "name" && cursorName === undefined)
    )
      throw new Error("Invalid cursor sort values");
    const expression = PROJECT_SORT_DESCRIPTORS[criterion.field].expression;
    const parameter =
      value.field === "name"
        ? cursorName
        : value.field === "startDate"
          ? sql.param(new Date(value.value), projectsTable.startDate)
          : value.field === "endDate"
            ? sql.param(new Date(value.value), projectsTable.endDate)
            : value.value;
    const forward =
      (criterion.direction === "asc") === (cursor.direction === "next");
    alternatives.push(
      allOf(
        ...equals,
        forward
          ? sql`${expression} > ${parameter}`
          : sql`${expression} < ${parameter}`,
      ),
    );
    equals.push(sql`${expression} = ${parameter}`);
  }
  alternatives.push(
    allOf(
      ...equals,
      cursor.direction === "next"
        ? gt(projectsTable.id, cursor.id)
        : lt(projectsTable.id, cursor.id),
    ),
  );
  return anyOf(...alternatives);
}

const rowSelection = {
  id: projectsTable.id,
  name: projectsTable.name,
  startDate: projectsTable.startDate,
  endDate: projectsTable.endDate,
  location: projectsTable.location,
  country: projectsTable.country,
  settlementRank,
};

const projectMetricsSelection = {
  projectCount: countDistinct(projectsTable.id),
};
const hostedProjectMetricsSelection = {
  ...projectMetricsSelection,
  partnerOrganizationCount: countDistinct(
    projectPartnerOrganizationsTable.organizationId,
  ),
};

type ProjectMetricRow = PartnerProjectList["metrics"]["whole"];

function mapProjectMetrics(value: ProjectMetricRow | undefined) {
  return {
    projectCount: value?.projectCount ?? 0,
  };
}

function mapHostedProjectMetrics(
  value: (ProjectMetricRow & { partnerOrganizationCount: number }) | undefined,
) {
  return {
    ...mapProjectMetrics(value),
    partnerOrganizationCount: value?.partnerOrganizationCount ?? 0,
  };
}

export function getHostedProjectScopeFilters(
  activeOrganizationId: string,
): SQL[] {
  return [eq(projectsTable.organizationId, activeOrganizationId)];
}

export function getPartnerProjectScopeFilters(
  activeOrganizationId: string,
): SQL[] {
  return [
    eq(projectPartnerOrganizationsTable.organizationId, activeOrganizationId),
  ];
}

function parseCursor(
  input: ProjectListInput,
  fingerprint: string,
  errors: Pick<SituationErrorConstructors, "BAD_REQUEST">,
): ProjectListCursor | undefined {
  if (!input.cursor) return undefined;

  const decodedCursor = decodeProjectListCursor(input.cursor, fingerprint);
  if (decodedCursor.status === "unsupported-version") return undefined;

  if (
    decodedCursor.status === "invalid" ||
    decodedCursor.cursor.values.length !== input.sort.length ||
    decodedCursor.cursor.values.some(
      (value, index) => value.field !== input.sort[index]?.field,
    )
  ) {
    throw createSituationErrors(errors).invalidProjectCursor();
  }

  return decodedCursor.cursor;
}

function finalizeProjectListPage<T extends ProjectListCursorRow>(
  pageRows: T[],
  input: ProjectListInput,
  cursor: ProjectListCursor | undefined,
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
  const createCursor = (
    direction: ProjectCursorDirection,
    row: ProjectListCursorRow,
  ) =>
    encodeProjectListCursor({
      version: 4,
      direction,
      fingerprint,
      id: row.id,
      values: input.sort.map(({ field }) =>
        PROJECT_SORT_DESCRIPTORS[field].value(row),
      ),
    });

  return {
    rows: rows.map(({ settlementRank: rank, ...row }) => ({
      ...row,
      settlement:
        rank === 0
          ? ("open" as const)
          : rank === 1
            ? ("ready" as const)
            : ("archived" as const),
    })),
    previousCursor:
      hasPrevious && firstRow ? createCursor("previous", firstRow) : undefined,
    nextCursor: hasNext && lastRow ? createCursor("next", lastRow) : undefined,
  };
}

export const listHosted = authorized
  .input(HostedProjectListInputSchema)
  .output(HostedProjectListSchema)
  .meta(
    openapi({
      tags: ["Projects"],
      summary: "List hosted projects",
    }),
  )
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }
    // Organization-wide readers see every hosted Project; assigned
    // coordinators see exactly their assigned Projects and nothing else.
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
    // The assignment path is Project Coordinator-only: Participant and other
    // roles are denied exactly as before, never narrowed into scope.
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
    const fingerprint = getProjectListFingerprint({
      scope: "hosted",
      ...input,
    });
    const cursor = parseCursor(input, fingerprint, errors);
    await enforceListingLimit(
      { userId: context.user.id, organizationId: activeOrganizationId },
      errors,
    );
    const wholeFilters = getHostedProjectScopeFilters(activeOrganizationId);
    if (assignedIds.length > 0) {
      wholeFilters.push(inArray(projectsTable.id, assignedIds));
    }
    const filteredScopeFilters = [...wholeFilters, ...getProjectFilters(input)];

    if (input.partnerOrganizationIds.length > 0) {
      filteredScopeFilters.push(
        exists(
          db
            .select({ id: projectPartnerOrganizationsTable.id })
            .from(projectPartnerOrganizationsTable)
            .where(
              and(
                eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
                inArray(
                  projectPartnerOrganizationsTable.organizationId,
                  input.partnerOrganizationIds,
                ),
              ),
            ),
        ),
      );
    }
    const pageFilters = [...filteredScopeFilters];
    if (cursor) {
      let cursorName: string | undefined;
      if (input.sort.some(({ field }) => field === "name")) {
        const [anchor] = await db
          .select({ name: projectsTable.name })
          .from(projectsTable)
          .where(and(...wholeFilters, eq(projectsTable.id, cursor.id)))
          .limit(1);
        if (!anchor) throw createSituationErrors(errors).invalidProjectCursor();
        cursorName = anchor.name;
      }
      pageFilters.push(getCursorFilter(input.sort, cursor, cursorName));
    }

    const [pageRows, wholeMetricRows, filteredMetricRows, partnerOptions] =
      await Promise.all([
        db
          .select(rowSelection)
          .from(projectsTable)
          .where(and(...pageFilters))
          .orderBy(...getOrder(input.sort, cursor?.direction ?? "next"))
          .limit(input.pageSize + 1),
        db
          .select(hostedProjectMetricsSelection)
          .from(projectsTable)
          .leftJoin(
            projectPartnerOrganizationsTable,
            eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
          )
          .where(and(...wholeFilters)),
        db
          .select(hostedProjectMetricsSelection)
          .from(projectsTable)
          .leftJoin(
            projectPartnerOrganizationsTable,
            eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
          )
          .where(and(...filteredScopeFilters)),
        db
          .selectDistinct({ id: organization.id, name: organization.name })
          .from(projectPartnerOrganizationsTable)
          .innerJoin(
            projectsTable,
            eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
          )
          .innerJoin(
            organization,
            eq(organization.id, projectPartnerOrganizationsTable.organizationId),
          )
          .where(and(...wholeFilters))
          .orderBy(asc(organization.name), asc(organization.id)),
      ]);

    const page = finalizeProjectListPage(pageRows, input, cursor, fingerprint);

    return {
      scope: "hosted" as const,
      ...page,
      metrics: {
        whole: mapHostedProjectMetrics(wholeMetricRows[0]),
        filtered: mapHostedProjectMetrics(filteredMetricRows[0]),
      },
      partnerOptions,
    };
  });

export const listPartner = authorized
  .input(PartnerProjectListInputSchema)
  .output(PartnerProjectListSchema)
  .meta(
    openapi({
      tags: ["Projects"],
      summary: "List partnered projects",
    }),
  )
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw createSituationErrors(errors).selectOrganization();
    }
    // Organization-wide readers see every Partnership; assigned coordinators
    // see exactly their assigned Partnerships and nothing else.
    const canReadPartner = await hasCostTrackerPermissions(context.headers, {
      project: ["read"],
      projectPartnership: ["read"],
    });
    const assignedIds = canReadPartner
      ? []
      : await assignedPartnershipIds(context.user.id, activeOrganizationId);
    // #377: accessDenied stays distinct from selectOrganization on purpose.
    // Both describe the caller's own access state (need-to-know UX used
    // app-wide), never another principal's data: every query below is
    // tenant-scoped, and invisible-vs-nonexistent searches share one empty
    // shape (see "no search oracle" regression test).
    if (!canReadPartner && assignedIds.length === 0) {
      throw createSituationErrors(errors).accessDenied();
    }
    const fingerprint = getProjectListFingerprint({
      scope: "partner",
      ...input,
    });
    const cursor = parseCursor(input, fingerprint, errors);
    await enforceListingLimit(
      { userId: context.user.id, organizationId: activeOrganizationId },
      errors,
    );
    const wholeFilters = getPartnerProjectScopeFilters(activeOrganizationId);
    if (assignedIds.length > 0)
      wholeFilters.push(
        inArray(projectPartnerOrganizationsTable.id, assignedIds),
      );
    const filteredScopeFilters = [...wholeFilters, ...getProjectFilters(input)];
    const pageFilters = [...filteredScopeFilters];
    if (cursor) {
      let cursorName: string | undefined;
      if (input.sort.some(({ field }) => field === "name")) {
        const [anchor] = await db
          .select({ name: projectsTable.name })
          .from(projectPartnerOrganizationsTable)
          .innerJoin(
            projectsTable,
            eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
          )
          .where(and(...wholeFilters, eq(projectsTable.id, cursor.id)))
          .limit(1);
        if (!anchor) throw createSituationErrors(errors).invalidProjectCursor();
        cursorName = anchor.name;
      }
      pageFilters.push(getCursorFilter(input.sort, cursor, cursorName));
    }

    const [pageRows, wholeMetricRows, filteredMetricRows] = await Promise.all([
      db
        .select(rowSelection)
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          projectsTable,
          eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
        )
        .where(and(...pageFilters))
        .orderBy(...getOrder(input.sort, cursor?.direction ?? "next"))
        .limit(input.pageSize + 1),
      db
        .select(projectMetricsSelection)
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          projectsTable,
          eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
        )
        .where(and(...wholeFilters)),
      db
        .select(projectMetricsSelection)
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          projectsTable,
          eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
        )
        .where(and(...filteredScopeFilters)),
    ]);

    const page = finalizeProjectListPage(pageRows, input, cursor, fingerprint);

    return {
      scope: "partner" as const,
      ...page,
      metrics: {
        whole: mapProjectMetrics(wholeMetricRows[0]),
        filtered: mapProjectMetrics(filteredMetricRows[0]),
      },
    };
  });
