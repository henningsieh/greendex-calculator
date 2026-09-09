import { z } from "zod";

import {
  PROJECT_PAGE_SIZES,
  PROJECT_SORT_MODES,
  PROJECT_WINDOW_FILTERS,
} from "@/features/projects/collection-state";

const ProjectOverviewInputBaseSchema = z
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

export const HostedProjectOverviewInputSchema =
  ProjectOverviewInputBaseSchema.safeExtend({
    partnerOrganizationIds: z
      .array(z.string().trim().min(1).max(128))
      .max(20)
      .default([])
      .transform((ids) => [...new Set(ids)].sort()),
  });

export const PartnerProjectOverviewInputSchema = ProjectOverviewInputBaseSchema;

export const ProjectOverviewRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  location: z.string(),
  country: z.string(),
  costSubmissionWindowOpen: z.boolean(),
});

const ProjectOverviewMetricsSchema = z.object({
  projectCount: z.number().int().nonnegative(),
  openWindowCount: z.number().int().nonnegative(),
});

export const HostedProjectOverviewSchema = z.object({
  scope: z.literal("hosted"),
  rows: z.array(ProjectOverviewRowSchema).max(100),
  nextCursor: z.string().optional(),
  metrics: z.object({
    whole: ProjectOverviewMetricsSchema.extend({
      partnerOrganizationCount: z.number().int().nonnegative(),
    }),
    filtered: ProjectOverviewMetricsSchema.extend({
      partnerOrganizationCount: z.number().int().nonnegative(),
    }),
  }),
  partnerOptions: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const PartnerProjectOverviewSchema = z.object({
  scope: z.literal("partner"),
  rows: z.array(ProjectOverviewRowSchema).max(100),
  nextCursor: z.string().optional(),
  metrics: z.object({
    whole: ProjectOverviewMetricsSchema,
    filtered: ProjectOverviewMetricsSchema,
  }),
});

export const ProjectScopeAvailabilitySchema = z.object({
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

export const AssignProjectPartnershipInputSchema = z.object({
  projectId: z.string().trim().min(1).max(128),
  organizationId: z.string().trim().min(1).max(128),
});

export const RemoveProjectPartnershipInputSchema = z.object({
  partnershipId: z.string().trim().min(1).max(128),
});

export const RemoveProjectPartnershipResultSchema = z.object({
  id: z.string(),
  removed: z.literal(true),
});
