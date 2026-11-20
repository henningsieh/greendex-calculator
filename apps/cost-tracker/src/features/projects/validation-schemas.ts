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

export const ProjectCreateInputSchema = createInsertSchema(projectsTable)
  .pick({
    name: true,
    startDate: true,
    endDate: true,
    location: true,
    country: true,
    welcomeMessage: true,
  })
  .safeExtend({
    name: z.string().trim().min(1, "Name is required").max(200),
    startDate: z.date(),
    endDate: z.date(),
    location: z.string().trim().min(1, "Location is required").max(200),
    country: z.enum(EU_COUNTRY_CODES),
    welcomeMessage: z.string().max(5000).nullable().optional(),
  })
  .strict()
  .refine(({ startDate, endDate }) => endDate >= startDate, {
    path: ["endDate"],
    message: "End date must not precede start date.",
  });

export const PROJECT_LIST_SCOPES = ["hosted", "partner"] as const;
export const PROJECT_ARCHIVE_FILTERS = ["active", "archived", "all"] as const;
export const PROJECT_SETTLEMENT_FILTERS = ["all", "open", "ready"] as const;
export const PROJECT_SORT_FIELDS = [
  "settlement",
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
  { field: "settlement", direction: "asc" },
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
    archive: z.enum(PROJECT_ARCHIVE_FILTERS).default("active"),
    settlement: z.enum(PROJECT_SETTLEMENT_FILTERS).default("all"),
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
  .extend({ settlement: z.enum(["open", "ready", "archived"]) });

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
