import { projectPartnerOrganizationsTable } from "@greendex/database/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const PROJECT_LIST_SCOPES = ["hosted", "partner"] as const;
export const PROJECT_WINDOW_FILTERS = ["all", "open", "closed"] as const;
export const PROJECT_SORT_MODES = [
  "operational",
  "start-asc",
  "start-desc",
  "end-asc",
  "end-desc",
] as const;
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
    window: z.enum(PROJECT_WINDOW_FILTERS).default("all"),
    dateFrom: z.date().optional(),
    dateTo: z.date().optional(),
    sort: z.enum(PROJECT_SORT_MODES).default("operational"),
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
      .array(z.string().trim().min(1).max(128))
      .max(20)
      .default([])
      .transform((ids) => [...new Set(ids)].sort()),
  },
);

export const PartnerProjectListInputSchema = ProjectListInputBaseSchema;

export const ProjectListRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  location: z.string(),
  country: z.string(),
  costSubmissionWindowOpen: z.boolean(),
});

const ProjectListMetricsSchema = z.object({
  projectCount: z.number().int().nonnegative(),
  openWindowCount: z.number().int().nonnegative(),
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
  partnerOptions: z.array(z.object({ id: z.string(), name: z.string() })),
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

export const ProjectDetailInputSchema = z.object({
  projectId: z.string().trim().min(1).max(128),
});

const ProjectDetailBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  location: z.string(),
  country: z.string(),
  archived: z.boolean(),
  costSubmissionWindowOpen: z.boolean(),
});

const ProjectPartnershipSummarySchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  assignedAt: z.date(),
  updatedAt: z.date(),
});

export const ProjectDetailSchema = z.discriminatedUnion("relationship", [
  ProjectDetailBaseSchema.extend({
    relationship: z.literal("hosted"),
    partnerOrganizations: z.array(ProjectPartnershipSummarySchema),
  }),
  ProjectDetailBaseSchema.extend({
    relationship: z.literal("partner"),
    hostingOrganization: z.object({ id: z.string(), name: z.string() }),
    partnership: z.object({
      id: z.string(),
      assignedAt: z.date(),
      updatedAt: z.date(),
    }),
  }),
]);

export const ProjectPartnershipSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  assignedAt: z.date(),
  updatedAt: z.date(),
});

const PROJECT_PARTNERSHIP_IDENTIFIER_MAX_LENGTH = 128;

const ProjectPartnershipInsertSchema = createInsertSchema(
  projectPartnerOrganizationsTable,
);
const ProjectPartnershipSelectSchema = createSelectSchema(
  projectPartnerOrganizationsTable,
);

export const AssignProjectPartnershipInputSchema =
  ProjectPartnershipInsertSchema.pick({
    projectId: true,
    organizationId: true,
  }).safeExtend({
    projectId: z
      .string()
      .trim()
      .min(1)
      .max(PROJECT_PARTNERSHIP_IDENTIFIER_MAX_LENGTH),
    organizationId: z
      .string()
      .trim()
      .min(1)
      .max(PROJECT_PARTNERSHIP_IDENTIFIER_MAX_LENGTH),
  });

export const RemoveProjectPartnershipInputSchema =
  ProjectPartnershipSelectSchema.pick({ id: true }).safeExtend({
    id: z.string().trim().min(1).max(PROJECT_PARTNERSHIP_IDENTIFIER_MAX_LENGTH),
  });

export const RemoveProjectPartnershipResultSchema = z.object({
  id: z.string(),
  removed: z.literal(true),
});
