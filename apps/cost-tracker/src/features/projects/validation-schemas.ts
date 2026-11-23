import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import {
  IDENTIFIER_MAX_LENGTH,
  claimsTable,
  organization,
  projectPartnerOrganizationsTable,
  projectsTable,
} from "@greendex/database/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

const projectColumns = createSelectSchema(projectsTable);
const organizationColumns = createSelectSchema(organization);

export const HostedProjectSearchInputSchema = z.object({
  search: z
    .string()
    .trim()
    .max(128)
    .refine((value) => value.length !== 1),
});

export const HostedProjectOptionSchema = projectColumns.pick({
  id: true,
  name: true,
});
export type HostedProjectOption = z.infer<typeof HostedProjectOptionSchema>;

export const PROJECT_NAME_MAX_LENGTH = 200;
export const PROJECT_LOCATION_MAX_LENGTH = 200;
export const PROJECT_WELCOME_MAX_LENGTH = 5000;

export type ProjectCreateMessages = {
  nameRequired: string;
  locationRequired: string;
  countryRequired: string;
  startDateRequired: string;
  endDateRequired: string;
  endBeforeStart: string;
  tooLong: (maxLength: number) => string;
};

export function createProjectCreateInputSchema(messages: ProjectCreateMessages) {
  return createInsertSchema(projectsTable)
    .pick({
      name: true,
      startDate: true,
      endDate: true,
      location: true,
      country: true,
      welcomeMessage: true,
    })
    .safeExtend({
      name: z
        .string()
        .trim()
        .min(1, messages.nameRequired)
        .max(PROJECT_NAME_MAX_LENGTH, {
          error: messages.tooLong(PROJECT_NAME_MAX_LENGTH),
        }),
      startDate: z.date({ error: messages.startDateRequired }),
      endDate: z.date({ error: messages.endDateRequired }),
      location: z
        .string()
        .trim()
        .min(1, messages.locationRequired)
        .max(PROJECT_LOCATION_MAX_LENGTH, {
          error: messages.tooLong(PROJECT_LOCATION_MAX_LENGTH),
        }),
      country: z.enum(EU_COUNTRY_CODES, { error: messages.countryRequired }),
      welcomeMessage: z
        .string()
        .max(PROJECT_WELCOME_MAX_LENGTH, {
          error: messages.tooLong(PROJECT_WELCOME_MAX_LENGTH),
        })
        .nullable()
        .optional(),
    })
    .strict()
    .refine(({ startDate, endDate }) => endDate >= startDate, {
      path: ["endDate"],
      message: messages.endBeforeStart,
    });
}

export const ProjectCreateInputSchema = createProjectCreateInputSchema({
  nameRequired: "Name is required",
  locationRequired: "Location is required",
  countryRequired: "Choose a country.",
  startDateRequired: "Choose a start date.",
  endDateRequired: "Choose an end date.",
  endBeforeStart: "End date must not precede start date.",
  tooLong: (maxLength) => `Use ${maxLength} characters or fewer.`,
});

export const PROJECT_LIST_SCOPES = ["hosted", "partner"] as const;
/**
 * One ordered status definition for the list column, filter options and sort
 * rank. The index is the sort rank; add a value here before deriving it.
 */
export const PROJECT_STATUSES = ["open", "ready", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Canonical, order-insensitive form shared by URL state, procedures and cursors. The URL default selection lives with the list query options. */
export function normalizeProjectStatuses(
  statuses: readonly ProjectStatus[],
): ProjectStatus[] {
  const selected = new Set<ProjectStatus>(statuses);
  return PROJECT_STATUSES.filter((status) => selected.has(status));
}

/**
 * One representation for "every status": the full ordered set. Selecting all
 * values, selecting none, and sending no selection all mean the same rows, so
 * URL state, fingerprints and query keys must not encode them differently.
 */
export function canonicalProjectStatuses(
  statuses: readonly ProjectStatus[],
): ProjectStatus[] {
  const normalized = normalizeProjectStatuses(statuses);
  return normalized.length === 0 ? [...PROJECT_STATUSES] : normalized;
}

export const PROJECT_SORT_FIELDS = [
  "status",
  "name",
  "startDate",
  "endDate",
] as const;
export const ProjectSortCriterionSchema = z.object({
  field: z.enum(PROJECT_SORT_FIELDS),
  direction: z.enum(["asc", "desc"]),
});
export const ProjectSortOrderSchema = z
  .array(ProjectSortCriterionSchema)
  .min(1)
  .max(PROJECT_SORT_FIELDS.length)
  .refine(
    (criteria) =>
      new Set(criteria.map(({ field }) => field)).size === criteria.length,
  );
export const DEFAULT_PROJECT_SORT: z.infer<typeof ProjectSortOrderSchema> = [
  { field: "status", direction: "asc" },
  { field: "startDate", direction: "asc" },
];
export const PROJECT_PAGE_SIZES = [25, 50, 100] as const;

const ProjectListInputBaseSchema = z
  .object({
    search: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .transform((value) => value.toLocaleLowerCase("en"))
      .optional(),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    status: z
      .array(z.enum(PROJECT_STATUSES))
      .default([])
      .transform(canonicalProjectStatuses),
    sort: ProjectSortOrderSchema.default(DEFAULT_PROJECT_SORT),
    cursor: z.string().min(1).max(2048).optional(),
    pageSize: z.union([
      z.literal(PROJECT_PAGE_SIZES[0]),
      z.literal(PROJECT_PAGE_SIZES[1]),
      z.literal(PROJECT_PAGE_SIZES[2]),
    ]),
  })
  .refine(
    ({ dateFrom, dateTo }) =>
      !(dateFrom && dateTo) || dateFrom.getTime() <= dateTo.getTime(),
    { message: "The Project date range is invalid." },
  );

export const HostedProjectListInputSchema = ProjectListInputBaseSchema.safeExtend(
  {
    partnerOrganizationIds: z
      .array(z.string().trim().min(1).max(IDENTIFIER_MAX_LENGTH))
      .max(20)
      .default([])
      .transform((ids) => [...new Set(ids)].sort()),
  },
);

export const PartnerProjectListInputSchema = ProjectListInputBaseSchema;

export const ProjectListRowSchema = projectColumns
  .pick({
    id: true,
    name: true,
    startDate: true,
    endDate: true,
    location: true,
    country: true,
  })
  .extend({ status: z.enum(PROJECT_STATUSES) });

const ProjectListMetricsSchema = z.object({
  projectCount: z.number().int().nonnegative(),
});

export const HostedProjectListSchema = z.object({
  scope: z.literal("hosted"),
  rows: z.array(ProjectListRowSchema).max(100),
  previousCursor: z.string().optional(),
  nextCursor: z.string().optional(),
  metrics: z.object({
    whole: ProjectListMetricsSchema.extend({
      partnerOrganizationCount: z.number().int().nonnegative(),
    }),
    filtered: ProjectListMetricsSchema.extend({
      partnerOrganizationCount: z.number().int().nonnegative(),
    }),
  }),
  partnerOptions: z.array(
    z.object({ id: organizationColumns.shape.id, name: z.string() }),
  ),
});

export const PartnerProjectListSchema = z.object({
  scope: z.literal("partner"),
  rows: z.array(ProjectListRowSchema).max(100),
  previousCursor: z.string().optional(),
  nextCursor: z.string().optional(),
  metrics: z.object({
    whole: ProjectListMetricsSchema,
    filtered: ProjectListMetricsSchema,
  }),
});

export const ProjectListScopeAvailabilitySchema = z.object({
  hosted: z.boolean(),
  partner: z.boolean(),
});

export const ProjectIdSchema = createSelectSchema(projectsTable)
  .shape.id.trim()
  .min(1, "projectIdRequired")
  .max(IDENTIFIER_MAX_LENGTH, "projectIdTooLong");

export const ProjectDetailInputSchema = z.object({
  projectId: ProjectIdSchema,
});

export const ReopenProjectInputSchema = ProjectDetailInputSchema.extend({
  reason: z.string().trim().min(1).max(2000),
});

const ProjectDetailBaseSchema = projectColumns
  .pick({
    id: true,
    name: true,
    startDate: true,
    endDate: true,
    location: true,
    country: true,
    archived: true,
  })
  .extend({
    // Headcount of active (non-merged) Project Participations, scoped to
    // what the relationship may see: the whole Project for hosts, the own
    // represented Participants for partners.
    participantCount: z.number(),
    // Whole days until endDate on the server clock. Computed in the
    // procedure — never in render — so the value is identical in the server
    // HTML and the hydrated tree, and no component reads a clock.
    daysLeft: z.number(),
  });

const ProjectClaimStatusSchema = createSelectSchema(claimsTable).shape.status;

const ProjectPartnershipColumns = createSelectSchema(
  projectPartnerOrganizationsTable,
);

const ProjectPartnershipSummarySchema = z.object({
  claimStatus: ProjectClaimStatusSchema.nullable(),
  id: ProjectPartnershipColumns.shape.id,
  organizationId: ProjectPartnershipColumns.shape.organizationId,
  organizationName: z.string(),
  assignedAt: ProjectPartnershipColumns.shape.createdAt,
  updatedAt: ProjectPartnershipColumns.shape.updatedAt,
});

export type ProjectPartnershipSummary = z.infer<
  typeof ProjectPartnershipSummarySchema
>;

export const ProjectDetailSchema = z.discriminatedUnion("relationship", [
  ProjectDetailBaseSchema.extend({
    relationship: z.literal("hosted"),
    canArchive: z.boolean(),
    canReopen: z.boolean(),
    partnerOrganizations: z.array(ProjectPartnershipSummarySchema),
  }),
  ProjectDetailBaseSchema.extend({
    relationship: z.literal("partner"),
    hostingOrganization: z.object({
      id: organizationColumns.shape.id,
      name: z.string(),
    }),
    partnership: z.object({
      claimStatus: ProjectClaimStatusSchema.nullable(),
      id: ProjectPartnershipColumns.shape.id,
      assignedAt: z.date(),
      updatedAt: z.date(),
    }),
  }),
]);
