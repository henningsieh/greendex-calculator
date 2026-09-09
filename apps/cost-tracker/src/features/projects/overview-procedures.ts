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
} from "@/features/projects/project-overview-cursor.server";
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

type CommonOverviewInput = {
  search?: string;
  window: "all" | "open" | "closed";
  dateFrom?: Date;
  dateTo?: Date;
  sort: "operational" | "start-asc" | "start-desc" | "end-asc" | "end-desc";
  cursor?: string;
  pageSize: 25 | 50 | 100;
};

function getProjectFilters(input: CommonOverviewInput): SQL[] {
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

function getProjectOrder(input: CommonOverviewInput): SQL[] {
  switch (input.sort) {
    case "start-desc":
      return [desc(projectsTable.startDate), asc(projectsTable.id)];
    case "end-asc":
      return [asc(projectsTable.endDate), asc(projectsTable.id)];
    case "end-desc":
      return [desc(projectsTable.endDate), asc(projectsTable.id)];
    case "start-asc":
      return [asc(projectsTable.startDate), asc(projectsTable.id)];
    default:
      return [
        sql`${projectsTable.costSubmissionWindowOpen} desc nulls last`,
        asc(projectsTable.startDate),
        asc(projectsTable.id),
      ];
  }
}

function getCursorFilter(
  input: CommonOverviewInput,
  cursor: {
    id: string;
    date: string;
    open?: boolean;
  },
): SQL {
  const date = new Date(cursor.date);

  switch (input.sort) {
    case "start-desc":
      return or(
        lt(projectsTable.startDate, date),
        and(eq(projectsTable.startDate, date), gt(projectsTable.id, cursor.id)),
      )!;
    case "end-asc":
      return or(
        gt(projectsTable.endDate, date),
        and(eq(projectsTable.endDate, date), gt(projectsTable.id, cursor.id)),
      )!;
    case "end-desc":
      return or(
        lt(projectsTable.endDate, date),
        and(eq(projectsTable.endDate, date), gt(projectsTable.id, cursor.id)),
      )!;
    case "start-asc":
      return or(
        gt(projectsTable.startDate, date),
        and(eq(projectsTable.startDate, date), gt(projectsTable.id, cursor.id)),
      )!;
    default:
      return or(
        lt(projectsTable.costSubmissionWindowOpen, cursor.open ?? false),
        and(
          eq(projectsTable.costSubmissionWindowOpen, cursor.open ?? false),
          or(
            gt(projectsTable.startDate, date),
            and(
              eq(projectsTable.startDate, date),
              gt(projectsTable.id, cursor.id),
            ),
          ),
        ),
      )!;
  }
}

function getCursorDate(
  input: CommonOverviewInput,
  row: { startDate: Date; endDate: Date },
) {
  return input.sort.startsWith("end-") ? row.endDate : row.startDate;
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

function parseCursor(
  input: CommonOverviewInput,
  fingerprint: string,
  errors: { BAD_REQUEST: (options?: { message?: string }) => Error },
) {
  if (!input.cursor) return undefined;

  const cursor = decodeProjectOverviewCursor(input.cursor, fingerprint);
  if (!cursor || cursor.sort !== input.sort) {
    throw errors.BAD_REQUEST({
      message: "The Project page cursor is invalid for these filters.",
    });
  }

  return cursor;
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
    const wholeFilters = [
      eq(projectsTable.organizationId, activeOrganizationId),
      eq(projectsTable.archived, false),
    ];
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
    if (cursor) pageFilters.push(getCursorFilter(input, cursor));

    const metricsSelection = {
      projectCount: countDistinct(projectsTable.id),
      openWindowCount:
        sql<number>`count(distinct case when ${projectsTable.costSubmissionWindowOpen} then ${projectsTable.id} end)`.mapWith(
          Number,
        ),
      partnerOrganizationCount: countDistinct(
        projectPartnerOrganizationsTable.organizationId,
      ),
    };

    const [pageRows, wholeMetricRows, filteredMetricRows, partnerOptions] =
      await Promise.all([
        db
          .select(rowSelection)
          .from(projectsTable)
          .where(and(...pageFilters))
          .orderBy(...getProjectOrder(input))
          .limit(input.pageSize + 1),
        db
          .select(metricsSelection)
          .from(projectsTable)
          .leftJoin(
            projectPartnerOrganizationsTable,
            eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
          )
          .where(and(...wholeFilters)),
        db
          .select(metricsSelection)
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

    const rows = pageRows.slice(0, input.pageSize);
    const lastRow = pageRows.length > input.pageSize ? rows.at(-1) : undefined;
    const mapMetrics = (value: (typeof wholeMetricRows)[number] | undefined) => ({
      projectCount: value?.projectCount ?? 0,
      openWindowCount: value?.openWindowCount ?? 0,
      partnerOrganizationCount: value?.partnerOrganizationCount ?? 0,
    });

    return {
      scope: "hosted" as const,
      rows,
      nextCursor: lastRow
        ? encodeProjectOverviewCursor({
            version: 1,
            fingerprint,
            sort: input.sort,
            id: lastRow.id,
            date: getCursorDate(input, lastRow).toISOString(),
            open:
              input.sort === "operational"
                ? lastRow.costSubmissionWindowOpen
                : undefined,
          })
        : undefined,
      metrics: {
        whole: mapMetrics(wholeMetricRows[0]),
        filtered: mapMetrics(filteredMetricRows[0]),
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
    const wholeFilters = [
      eq(projectPartnerOrganizationsTable.organizationId, activeOrganizationId),
      eq(projectsTable.archived, false),
    ];
    const filteredScopeFilters = [...wholeFilters, ...getProjectFilters(input)];
    const pageFilters = [...filteredScopeFilters];
    if (cursor) pageFilters.push(getCursorFilter(input, cursor));

    const metricSelection = {
      projectCount: countDistinct(projectsTable.id),
      openWindowCount:
        sql<number>`count(distinct case when ${projectsTable.costSubmissionWindowOpen} then ${projectsTable.id} end)`.mapWith(
          Number,
        ),
    };
    const [pageRows, wholeMetricRows, filteredMetricRows] = await Promise.all([
      db
        .select(rowSelection)
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          projectsTable,
          eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
        )
        .where(and(...pageFilters))
        .orderBy(...getProjectOrder(input))
        .limit(input.pageSize + 1),
      db
        .select(metricSelection)
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          projectsTable,
          eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
        )
        .where(and(...wholeFilters)),
      db
        .select(metricSelection)
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          projectsTable,
          eq(projectsTable.id, projectPartnerOrganizationsTable.projectId),
        )
        .where(and(...filteredScopeFilters)),
    ]);

    const rows = pageRows.slice(0, input.pageSize);
    const lastRow = pageRows.length > input.pageSize ? rows.at(-1) : undefined;
    const mapMetrics = (value: (typeof wholeMetricRows)[number] | undefined) => ({
      projectCount: value?.projectCount ?? 0,
      openWindowCount: value?.openWindowCount ?? 0,
    });

    return {
      scope: "partner" as const,
      rows,
      nextCursor: lastRow
        ? encodeProjectOverviewCursor({
            version: 1,
            fingerprint,
            sort: input.sort,
            id: lastRow.id,
            date: getCursorDate(input, lastRow).toISOString(),
            open:
              input.sort === "operational"
                ? lastRow.costSubmissionWindowOpen
                : undefined,
          })
        : undefined,
      metrics: {
        whole: mapMetrics(wholeMetricRows[0]),
        filtered: mapMetrics(filteredMetricRows[0]),
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
            .where(
              and(
                eq(projectsTable.organizationId, activeOrganizationId),
                eq(projectsTable.archived, false),
              ),
            )
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
            .where(
              and(
                eq(
                  projectPartnerOrganizationsTable.organizationId,
                  activeOrganizationId,
                ),
                eq(projectsTable.archived, false),
              ),
            )
            .limit(1)
        : [],
    ]);

    return { hosted: hostedRows.length > 0, partner: partnerRows.length > 0 };
  });
