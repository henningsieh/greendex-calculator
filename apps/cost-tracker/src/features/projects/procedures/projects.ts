import "server-only";
import { hasOrganizationRole } from "@greendex/auth";
import { db } from "@greendex/database";
import {
  claimsTable,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as partnerAssignments,
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
import { z } from "zod";

import { requireHostCoordination } from "@/features/projects/procedures/coordination";
import {
  decodeProjectListCursor,
  encodeProjectListCursor,
  getProjectListFingerprint,
  type ProjectListCursor,
} from "@/features/projects/project-list-cursor.server";
import type {
  PartnerProjectList,
  ProjectListInput,
} from "@/features/projects/types";
import {
  HostedProjectListInputSchema,
  HostedProjectListSchema,
  PartnerProjectListInputSchema,
  PartnerProjectListSchema,
  ProjectDetailInputSchema,
  ProjectDetailSchema,
  ProjectListScopeAvailabilitySchema,
} from "@/features/projects/validation-schemas";
import {
  authorized,
  hasCostTrackerPermissions,
  requireCostTrackerPermissions,
} from "@/lib/orpc/middleware";

function getProjectFilters(input: ProjectListInput): SQL[] {
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

type ProjectCursorDirection = ProjectListCursor["direction"];
type ProjectCursorPosition = Pick<
  ProjectListCursor,
  "date" | "direction" | "id" | "open"
>;
type ProjectListCursorRow = {
  costSubmissionWindowOpen: boolean;
  endDate: Date;
  id: string;
  startDate: Date;
};

type ProjectSortDescription = {
  getCursorFilter: (cursor: ProjectCursorPosition) => SQL;
  getCursorValues: (
    row: ProjectListCursorRow,
  ) => Pick<ProjectListCursor, "date" | "open">;
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
  getCursorDate: (row: ProjectListCursorRow) => Date;
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
} satisfies Record<ProjectListInput["sort"], ProjectSortDescription>;

function getProjectSortDescription(
  sort: ProjectListInput["sort"],
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

type ProjectMetricRow = PartnerProjectList["metrics"]["whole"];

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

/**
 * Partnerships in one Organization explicitly assigned to one coordinator.
 * Assignment scope narrows Partner discovery: it never widens it.
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

function parseCursor(
  input: ProjectListInput,
  fingerprint: string,
  errors: { BAD_REQUEST: (options?: { message?: string }) => Error },
): ProjectListCursor | undefined {
  if (!input.cursor) return undefined;

  const decodedCursor = decodeProjectListCursor(input.cursor, fingerprint);
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
  const sortDescription = getProjectSortDescription(input.sort);
  const createCursor = (
    direction: ProjectCursorDirection,
    row: ProjectListCursorRow,
  ) =>
    encodeProjectListCursor({
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

export type ProjectRelationship =
  | { kind: "inaccessible" }
  | {
      kind: "hosted";
      projectId: string;
      name: string;
      startDate: Date;
      endDate: Date;
      location: string;
      country: string;
      archived: boolean;
      costSubmissionWindowOpen: boolean;
      completedAt: Date | null;
      completedByUserId: string | null;
      hostingOrganization: { id: string; name: string };
    }
  | {
      kind: "partner";
      projectId: string;
      name: string;
      startDate: Date;
      endDate: Date;
      location: string;
      country: string;
      archived: boolean;
      costSubmissionWindowOpen: boolean;
      completedAt: Date | null;
      completedByUserId: string | null;
      hostingOrganization: { id: string; name: string };
      partnershipId: string;
      assignedAt: Date;
      assignmentUpdatedAt: Date;
    };

export async function resolveRelationship({
  activeOrganizationId,
  projectId,
}: {
  activeOrganizationId: string;
  projectId: string;
}): Promise<ProjectRelationship> {
  const [row] = await db
    .select({
      projectId: projectsTable.id,
      name: projectsTable.name,
      startDate: projectsTable.startDate,
      endDate: projectsTable.endDate,
      location: projectsTable.location,
      country: projectsTable.country,
      archived: projectsTable.archived,
      costSubmissionWindowOpen: projectsTable.costSubmissionWindowOpen,
      completedAt: projectsTable.completedAt,
      completedByUserId: projectsTable.completedByUserId,
      hostingOrganizationId: organization.id,
      hostingOrganizationName: organization.name,
      partnershipId: projectPartnerOrganizationsTable.id,
      partnershipCreatedAt: projectPartnerOrganizationsTable.createdAt,
      partnershipUpdatedAt: projectPartnerOrganizationsTable.updatedAt,
    })
    .from(projectsTable)
    .innerJoin(organization, eq(organization.id, projectsTable.organizationId))
    .leftJoin(
      projectPartnerOrganizationsTable,
      and(
        eq(projectPartnerOrganizationsTable.projectId, projectsTable.id),
        eq(projectPartnerOrganizationsTable.organizationId, activeOrganizationId),
      ),
    )
    .where(
      and(
        eq(projectsTable.id, projectId),
        or(
          eq(projectsTable.organizationId, activeOrganizationId),
          eq(
            projectPartnerOrganizationsTable.organizationId,
            activeOrganizationId,
          ),
        ),
      ),
    )
    .limit(1);

  if (!row) return { kind: "inaccessible" };

  const common = {
    projectId: row.projectId,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    location: row.location,
    country: row.country,
    archived: row.archived,
    costSubmissionWindowOpen: row.costSubmissionWindowOpen,
    completedAt: row.completedAt,
    completedByUserId: row.completedByUserId,
    hostingOrganization: {
      id: row.hostingOrganizationId,
      name: row.hostingOrganizationName,
    },
  };

  if (row.hostingOrganizationId === activeOrganizationId) {
    return { kind: "hosted", ...common };
  }

  if (row.partnershipId && row.partnershipCreatedAt && row.partnershipUpdatedAt) {
    return {
      kind: "partner",
      ...common,
      partnershipId: row.partnershipId,
      assignedAt: row.partnershipCreatedAt,
      assignmentUpdatedAt: row.partnershipUpdatedAt,
    };
  }

  return { kind: "inaccessible" };
}

export const listHosted = authorized
  .use(requireCostTrackerPermissions({ project: ["read"] }))
  .input(HostedProjectListInputSchema)
  .output(HostedProjectListSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId!;
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
    if (
      !membership ||
      !(
        hasOrganizationRole(membership.role, "owner") ||
        hasOrganizationRole(membership.role, "admin")
      )
    ) {
      throw errors.FORBIDDEN({
        message: "Hosted Project overview is unavailable.",
      });
    }
    const fingerprint = getProjectListFingerprint({
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
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw errors.FORBIDDEN({
        message:
          "Select an active Organization before accessing Cost Tracker data.",
      });
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
    if (!canReadPartner && assignedIds.length === 0) {
      throw errors.FORBIDDEN({
        message:
          "The active Organization role cannot access this Cost Tracker resource.",
      });
    }
    const fingerprint = getProjectListFingerprint({
      scope: "partner",
      ...input,
    });
    const cursor = parseCursor(input, fingerprint, errors);
    const wholeFilters = getPartnerProjectScopeFilters(activeOrganizationId);
    if (assignedIds.length > 0)
      wholeFilters.push(
        inArray(projectPartnerOrganizationsTable.id, assignedIds),
      );
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

export const availableScopes = authorized
  .output(ProjectListScopeAvailabilitySchema)
  .handler(async ({ context, errors }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw errors.FORBIDDEN({
        message: "Select an active Organization before accessing Projects.",
      });
    }

    const [canReadHostedPermission, canReadPartnerPermission] = await Promise.all(
      [
        hasCostTrackerPermissions(context.headers, { project: ["read"] }),
        hasCostTrackerPermissions(context.headers, {
          project: ["read"],
          projectPartnership: ["read"],
        }),
      ],
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
    const canReadHosted =
      canReadHostedPermission &&
      !!membership &&
      (hasOrganizationRole(membership.role, "owner") ||
        hasOrganizationRole(membership.role, "admin"));
    // Assigned coordinators discover exactly their Partnerships; the role
    // alone still grants no Organization-wide overview.
    const assignedIds = canReadPartnerPermission
      ? []
      : await assignedPartnershipIds(context.user.id, activeOrganizationId);
    const canReadPartner = canReadPartnerPermission || assignedIds.length > 0;
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

    return {
      hosted: hostedRows.length > 0,
      partner: partnerRows.length > 0,
      canCreate: !!membership,
    };
  });

/**
 * Returns the active Organization's relationship-specific Project view.
 *
 * Hosted views include assigned Partner Organizations, while the Partnership
 * portion of Partner views exposes only the Hosting Organization and the active
 * Organization's assignment. Requests without relationship-specific access are
 * rejected.
 */
export const getProject = authorized
  .input(ProjectDetailInputSchema)
  .output(ProjectDetailSchema)
  .handler(async ({ context, errors, input }) => {
    const activeOrganizationId = context.session.activeOrganizationId;
    if (!activeOrganizationId) {
      throw errors.FORBIDDEN({
        message: "Select an active Organization before opening a Project.",
      });
    }

    const [canReadHosted, canReadPartner] = await Promise.all([
      hasCostTrackerPermissions(context.headers, { project: ["read"] }),
      hasCostTrackerPermissions(context.headers, {
        project: ["read"],
        projectPartnership: ["read"],
      }),
    ]);
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
    const canCoordinateHosted =
      membership &&
      (hasOrganizationRole(membership.role, "owner") ||
        hasOrganizationRole(membership.role, "admin") ||
        hasOrganizationRole(membership.role, "project-coordinator"));
    if (!(canReadHosted || canReadPartner || canCoordinateHosted)) {
      throw errors.FORBIDDEN({
        message: "The active Organization role cannot read this Project.",
      });
    }

    const relationship = await resolveRelationship({
      activeOrganizationId,
      projectId: input.projectId,
    });
    if (relationship.kind === "inaccessible") {
      throw errors.FORBIDDEN({
        message: "The active Organization cannot access this Project.",
      });
    }

    const project = {
      id: relationship.projectId,
      name: relationship.name,
      startDate: relationship.startDate,
      endDate: relationship.endDate,
      location: relationship.location,
      country: relationship.country,
      archived: relationship.archived,
      costSubmissionWindowOpen: relationship.costSubmissionWindowOpen,
      completedAt: relationship.completedAt,
      completedByUserId: relationship.completedByUserId,
    };

    if (relationship.kind === "partner") {
      if (!canReadPartner) {
        // Assignment-scoped coordinators may read exactly the Partnership
        // they are assigned to; membership plus assignment, never role alone.
        const [assignment] = await db
          .select({ userId: partnerAssignments.userId })
          .from(partnerAssignments)
          .where(
            and(
              eq(partnerAssignments.partnershipId, relationship.partnershipId),
              eq(partnerAssignments.userId, context.user.id),
            ),
          )
          .limit(1);
        if (!assignment || !membership) {
          throw errors.FORBIDDEN({
            message:
              "The active Organization role cannot read this Project Partnership.",
          });
        }
      }

      const [claim] = await db
        .select({ status: claimsTable.status })
        .from(claimsTable)
        .where(eq(claimsTable.partnershipId, relationship.partnershipId))
        .limit(1);

      return {
        ...project,
        relationship: "partner" as const,
        hostingOrganization: relationship.hostingOrganization,
        partnership: {
          claimStatus: claim?.status ?? null,
          id: relationship.partnershipId,
          assignedAt: relationship.assignedAt,
          updatedAt: relationship.assignmentUpdatedAt,
        },
      };
    }

    if (!canCoordinateHosted) {
      throw errors.FORBIDDEN({
        message: "The active Organization role cannot read this hosted Project.",
      });
    }

    const partnerOrganizations = await db.transaction(async (transaction) => {
      const [hostedProject] = await transaction
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, input.projectId),
            eq(projectsTable.organizationId, activeOrganizationId),
          ),
        )
        .for("share")
        .limit(1);
      if (!hostedProject) {
        throw errors.FORBIDDEN({
          message: "The active Organization cannot access this Project.",
        });
      }
      await requireHostCoordination(
        hostedProject.id,
        context.user.id,
        activeOrganizationId,
        errors,
        transaction,
      );

      return transaction
        .select({
          id: projectPartnerOrganizationsTable.id,
          organizationId: organization.id,
          organizationName: organization.name,
          assignedAt: projectPartnerOrganizationsTable.createdAt,
          updatedAt: projectPartnerOrganizationsTable.updatedAt,
          claimStatus: claimsTable.status,
        })
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          organization,
          eq(organization.id, projectPartnerOrganizationsTable.organizationId),
        )
        .leftJoin(
          claimsTable,
          eq(claimsTable.partnershipId, projectPartnerOrganizationsTable.id),
        )
        .where(eq(projectPartnerOrganizationsTable.projectId, hostedProject.id))
        .orderBy(asc(organization.name), asc(organization.id));
    });

    return {
      ...project,
      relationship: "hosted" as const,
      partnerOrganizations,
    };
  });

/** Record one completion transition after checking fresh Partnership states. */
export const complete = authorized
  .input(ProjectDetailInputSchema)
  .output(
    z.object({
      projectId: z.string(),
      completed: z.literal(true),
      completedAt: z.date(),
      completedByUserId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    const orgId = context.session.activeOrganizationId;
    if (!orgId) throw errors.FORBIDDEN();

    return db.transaction(async (tx) => {
      const [project] = await tx
        .select({
          id: projectsTable.id,
          completedAt: projectsTable.completedAt,
        })
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, input.projectId),
            eq(projectsTable.organizationId, orgId),
            eq(projectsTable.archived, false),
          ),
        )
        .for("update")
        .limit(1);
      if (!project)
        throw errors.FORBIDDEN({ message: "Hosted Project is unavailable." });
      await requireHostCoordination(
        project.id,
        context.user.id,
        orgId,
        errors,
        tx,
      );
      if (project.completedAt)
        throw errors.BAD_REQUEST({ message: "Project is already completed." });

      const partnerships = await tx
        .select({ name: organization.name, status: claimsTable.status })
        .from(projectPartnerOrganizationsTable)
        .innerJoin(
          organization,
          eq(organization.id, projectPartnerOrganizationsTable.organizationId),
        )
        .leftJoin(
          claimsTable,
          eq(claimsTable.partnershipId, projectPartnerOrganizationsTable.id),
        )
        .where(eq(projectPartnerOrganizationsTable.projectId, project.id))
        .orderBy(asc(organization.name), asc(organization.id));
      const blockers = partnerships.filter(
        ({ status }) => status !== "paid" && status !== "rejected",
      );
      if (blockers.length)
        throw errors.BAD_REQUEST({
          message: `Cannot complete Project: ${blockers.map(({ name, status }) => `${name} (${status ?? "no Claim"})`).join(", ")}.`,
        });
      const [completed] = await tx
        .update(projectsTable)
        .set({ completedAt: new Date(), completedByUserId: context.user.id })
        .where(
          and(
            eq(projectsTable.id, project.id),
            eq(projectsTable.organizationId, orgId),
          ),
        )
        .returning({
          completedAt: projectsTable.completedAt,
          completedByUserId: projectsTable.completedByUserId,
        });
      if (!completed?.completedAt || !completed.completedByUserId)
        throw errors.INTERNAL_SERVER_ERROR();
      return {
        projectId: project.id,
        completed: true as const,
        completedAt: completed.completedAt,
        completedByUserId: completed.completedByUserId,
      };
    });
  });
