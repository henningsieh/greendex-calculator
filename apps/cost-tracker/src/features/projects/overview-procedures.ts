import { db } from "@greendex/database";
import {
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
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
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  decodeProjectOverviewCursor,
  encodeProjectOverviewCursor,
  getProjectOverviewFingerprint,
  type ProjectOverviewCursor,
} from "@/features/projects/project-overview-cursor.server";
import type {
  PartnerProjectOverview,
  ProjectOverviewInput,
} from "@/features/projects/types";
import {
  HostedProjectOverviewInputSchema,
  HostedProjectOverviewSchema,
  PartnerProjectOverviewInputSchema,
  PartnerProjectOverviewSchema,
  ProjectScopeAvailabilitySchema,
} from "@/features/projects/validation-schemas";
import {
  authorized,
  hasCostTrackerPermissions,
  requireCostTrackerPermissions,
} from "@/lib/orpc/middleware";

function getProjectFilters(input: ProjectOverviewInput): SQL[] {
  const filters: SQL[] = [];

  if (input.search) {
    const escapedSearch = input.search.replace(/[\\%_]/g, "\\$&");
    filters.push(
      sql`lower(${projectsTable.name}) like ${`%${escapedSearch}%`} escape '\\'`,
    );
  }
  if (input.window !== "all") {
    filters.push(
      eq(projectsTable.costSubmissionWindowOpen, input.window === "open"),
    );
  }
  if (input.dateFrom) filters.push(gte(projectsTable.endDate, input.dateFrom));
  if (input.dateTo) filters.push(lte(projectsTable.startDate, input.dateTo));

  return filters;
}

type ProjectCursorDirection = ProjectOverviewCursor["direction"];
type ProjectCursorPosition = Pick<
  ProjectOverviewCursor,
  "date" | "direction" | "id" | "open"
>;
type ProjectOverviewCursorRow = {
  costSubmissionWindowOpen: boolean;
  endDate: Date;
  id: string;
  startDate: Date;
};

type ProjectSortDescription = {
  getCursorFilter: (cursor: ProjectCursorPosition) => SQL;
  getCursorValues: (
    row: ProjectOverviewCursorRow,
  ) => Pick<ProjectOverviewCursor, "date" | "open">;
  getOrder: (direction: ProjectCursorDirection) => SQL[];
};

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

function createChronologicalSortDescriptions({
  ascendingOrder,
  descendingOrder,
  getCursorDate,
  isAfter,
  isBefore,
  isEqual,
}: {
  ascendingOrder: SQL;
  descendingOrder: SQL;
  getCursorDate: (row: ProjectOverviewCursorRow) => Date;
  isAfter: (date: Date) => SQL;
  isBefore: (date: Date) => SQL;
  isEqual: (date: Date) => SQL;
}) {
  const createDescription = (ascending: boolean): ProjectSortDescription => ({
    getCursorFilter(cursor) {
      const date = new Date(cursor.date);
      const movingForward = cursor.direction === "next";
      const compareDate =
        ascending === movingForward ? isAfter(date) : isBefore(date);
      const compareId = movingForward
        ? gt(projectsTable.id, cursor.id)
        : lt(projectsTable.id, cursor.id);

      return anyOf(compareDate, allOf(isEqual(date), compareId));
    },
    getCursorValues: (row) => ({ date: getCursorDate(row).toISOString() }),
    getOrder(direction) {
      const movingForward = direction === "next";
      return [
        ascending === movingForward ? ascendingOrder : descendingOrder,
        movingForward ? asc(projectsTable.id) : desc(projectsTable.id),
      ];
    },
  });

  return {
    ascending: createDescription(true),
    descending: createDescription(false),
  };
}

const startDateSortDescriptions = createChronologicalSortDescriptions({
  ascendingOrder: asc(projectsTable.startDate),
  descendingOrder: desc(projectsTable.startDate),
  getCursorDate: (row) => row.startDate,
  isAfter: (date) => gt(projectsTable.startDate, date),
  isBefore: (date) => lt(projectsTable.startDate, date),
  isEqual: (date) => eq(projectsTable.startDate, date),
});
const endDateSortDescriptions = createChronologicalSortDescriptions({
  ascendingOrder: asc(projectsTable.endDate),
  descendingOrder: desc(projectsTable.endDate),
  getCursorDate: (row) => row.endDate,
  isAfter: (date) => gt(projectsTable.endDate, date),
  isBefore: (date) => lt(projectsTable.endDate, date),
  isEqual: (date) => eq(projectsTable.endDate, date),
});

const PROJECT_SORT_DESCRIPTIONS = {
  operational: {
    getCursorFilter(cursor) {
      const date = new Date(cursor.date);
      const open = cursor.open ?? false;
      const movingForward = cursor.direction === "next";
      const compareWindow = movingForward
        ? lt(projectsTable.costSubmissionWindowOpen, open)
        : gt(projectsTable.costSubmissionWindowOpen, open);
      const compareDate = movingForward
        ? gt(projectsTable.startDate, date)
        : lt(projectsTable.startDate, date);
      const compareId = movingForward
        ? gt(projectsTable.id, cursor.id)
        : lt(projectsTable.id, cursor.id);

      return anyOf(
        compareWindow,
        allOf(
          eq(projectsTable.costSubmissionWindowOpen, open),
          anyOf(compareDate, allOf(eq(projectsTable.startDate, date), compareId)),
        ),
      );
    },
    getCursorValues: (row) => ({
      date: row.startDate.toISOString(),
      open: row.costSubmissionWindowOpen,
    }),
    getOrder: (direction) =>
      direction === "next"
        ? [
            sql`${projectsTable.costSubmissionWindowOpen} desc nulls last`,
            asc(projectsTable.startDate),
            asc(projectsTable.id),
          ]
        : [
            sql`${projectsTable.costSubmissionWindowOpen} asc nulls first`,
            desc(projectsTable.startDate),
            desc(projectsTable.id),
          ],
  },
  "start-asc": startDateSortDescriptions.ascending,
  "start-desc": startDateSortDescriptions.descending,
  "end-asc": endDateSortDescriptions.ascending,
  "end-desc": endDateSortDescriptions.descending,
} satisfies Record<ProjectOverviewInput["sort"], ProjectSortDescription>;

function getProjectSortDescription(
  sort: ProjectOverviewInput["sort"],
): ProjectSortDescription {
  return PROJECT_SORT_DESCRIPTIONS[sort];
}

const rowSelection = {
  id: projectsTable.id,
  name: projectsTable.name,
  startDate: projectsTable.startDate,
  endDate: projectsTable.endDate,
  location: projectsTable.location,
  country: projectsTable.country,
  costSubmissionWindowOpen: projectsTable.costSubmissionWindowOpen,
};

const projectMetricsSelection = {
  projectCount: countDistinct(projectsTable.id),
  openWindowCount:
    sql<number>`count(distinct case when ${projectsTable.costSubmissionWindowOpen} then ${projectsTable.id} end)`.mapWith(
      Number,
    ),
};
const hostedProjectMetricsSelection = {
  ...projectMetricsSelection,
  partnerOrganizationCount: countDistinct(
    projectPartnerOrganizationsTable.organizationId,
  ),
};

type ProjectMetricRow = PartnerProjectOverview["metrics"]["whole"];

function mapProjectMetrics(value: ProjectMetricRow | undefined) {
  return {
    projectCount: value?.projectCount ?? 0,
    openWindowCount: value?.openWindowCount ?? 0,
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

function getHostedProjectScopeFilters(activeOrganizationId: string): SQL[] {
  return [
    eq(projectsTable.organizationId, activeOrganizationId),
    eq(projectsTable.archived, false),
  ];
}

function getPartnerProjectScopeFilters(activeOrganizationId: string): SQL[] {
  return [
    eq(projectPartnerOrganizationsTable.organizationId, activeOrganizationId),
    eq(projectsTable.archived, false),
  ];
}

function parseCursor(
  input: ProjectOverviewInput,
  fingerprint: string,
  errors: { BAD_REQUEST: (options?: { message?: string }) => Error },
): ProjectOverviewCursor | undefined {
  if (!input.cursor) return undefined;

  const decodedCursor = decodeProjectOverviewCursor(input.cursor, fingerprint);
  if (decodedCursor.status === "unsupported-version") return undefined;

  if (
    decodedCursor.status === "invalid" ||
    decodedCursor.cursor.sort !== input.sort
  ) {
    throw errors.BAD_REQUEST({
      message: "The Project page cursor is invalid for these filters.",
    });
  }

  return decodedCursor.cursor;
}

function finalizeProjectOverviewPage<T extends ProjectOverviewCursorRow>(
  pageRows: T[],
  input: ProjectOverviewInput,
  cursor: ProjectOverviewCursor | undefined,
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
  const sortDescription = getProjectSortDescription(input.sort);
  const createCursor = (
    direction: ProjectCursorDirection,
    row: ProjectOverviewCursorRow,
  ) =>
    encodeProjectOverviewCursor({
      version: 2,
      direction,
      fingerprint,
      sort: input.sort,
      id: row.id,
      ...sortDescription.getCursorValues(row),
    });

  return {
    rows,
    previousCursor:
      hasPrevious && firstRow ? createCursor("previous", firstRow) : undefined,
    nextCursor: hasNext && lastRow ? createCursor("next", lastRow) : undefined,
  };
}

export const hostedOverview = authorized
  .use(requireCostTrackerPermissions({ project: ["read"] }))
  .input(HostedProjectOverviewInputSchema)
  .output(HostedProjectOverviewSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId!;
    const fingerprint = getProjectOverviewFingerprint({
      scope: "hosted",
      ...input,
    });
    const cursor = parseCursor(input, fingerprint, errors);
    const wholeFilters = getHostedProjectScopeFilters(activeOrganizationId);
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
    const sortDescription = getProjectSortDescription(input.sort);
    if (cursor) pageFilters.push(sortDescription.getCursorFilter(cursor));

    const [pageRows, wholeMetricRows, filteredMetricRows, partnerOptions] =
      await Promise.all([
        db
          .select(rowSelection)
          .from(projectsTable)
          .where(and(...pageFilters))
          .orderBy(...sortDescription.getOrder(cursor?.direction ?? "next"))
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

    const page = finalizeProjectOverviewPage(
      pageRows,
      input,
      cursor,
      fingerprint,
    );

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

export const partnerOverview = authorized
  .use(
    requireCostTrackerPermissions({
      project: ["read"],
      projectPartnership: ["read"],
    }),
  )
  .input(PartnerProjectOverviewInputSchema)
  .output(PartnerProjectOverviewSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId!;
    const fingerprint = getProjectOverviewFingerprint({
      scope: "partner",
      ...input,
    });
    const cursor = parseCursor(input, fingerprint, errors);
    const wholeFilters = getPartnerProjectScopeFilters(activeOrganizationId);
    const filteredScopeFilters = [...wholeFilters, ...getProjectFilters(input)];
    const pageFilters = [...filteredScopeFilters];
    const sortDescription = getProjectSortDescription(input.sort);
    if (cursor) pageFilters.push(sortDescription.getCursorFilter(cursor));

    const [pageRows, wholeMetricRows, filteredMetricRows] = await Promise.all([
      db
        .select(rowSelection)
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          projectsTable,
          eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
        )
        .where(and(...pageFilters))
        .orderBy(...sortDescription.getOrder(cursor?.direction ?? "next"))
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

    const page = finalizeProjectOverviewPage(
      pageRows,
      input,
      cursor,
      fingerprint,
    );

    return {
      scope: "partner" as const,
      ...page,
      metrics: {
        whole: mapProjectMetrics(wholeMetricRows[0]),
        filtered: mapProjectMetrics(filteredMetricRows[0]),
      },
    };
  });

export const availableProjectScopes = authorized
  .output(ProjectScopeAvailabilitySchema)
  .handler(async ({ context, errors }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw errors.FORBIDDEN({
        message: "Select an active Organization before accessing Projects.",
      });
    }

    const [canReadHosted, canReadPartner] = await Promise.all([
      hasCostTrackerPermissions(context.headers, { project: ["read"] }),
      hasCostTrackerPermissions(context.headers, {
        project: ["read"],
        projectPartnership: ["read"],
      }),
    ]);
    const [hostedRows, partnerRows] = await Promise.all([
      canReadHosted
        ? db
            .select({ id: projectsTable.id })
            .from(projectsTable)
            .where(and(...getHostedProjectScopeFilters(activeOrganizationId)))
            .limit(1)
        : [],
      canReadPartner
        ? db
            .select({ id: projectPartnerOrganizationsTable.id })
            .from(projectPartnerOrganizationsTable)
            .innerJoin(
              projectsTable,
              eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
            )
            .where(and(...getPartnerProjectScopeFilters(activeOrganizationId)))
            .limit(1)
        : [],
    ]);

    return { hosted: hostedRows.length > 0, partner: partnerRows.length > 0 };
  });
