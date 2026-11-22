import { IDENTIFIER_MAX_LENGTH } from "@greendex/database/schema";
import { z } from "zod";

import { ClaimStatusSchema } from "@/features/claims/validation-schemas";

export const CLAIM_QUEUE_SORTS = [
  "submitted-asc",
  "submitted-desc",
  "project-asc",
  "project-desc",
  "partner-asc",
  "partner-desc",
] as const;

export const CLAIM_QUEUE_PAGE_SIZES = [25, 50, 100] as const;

export type ClaimQueueSort = (typeof CLAIM_QUEUE_SORTS)[number];
export type ClaimQueuePageSize = (typeof CLAIM_QUEUE_PAGE_SIZES)[number];

export const ClaimQueueInputSchema = z.object({
  search: z.string().trim().max(200).optional(),
  partnerOrganizationId: z
    .string()
    .trim()
    .min(1)
    .max(IDENTIFIER_MAX_LENGTH)
    .optional(),
  sort: z.enum(CLAIM_QUEUE_SORTS).default("submitted-asc"),
  cursor: z.string().trim().max(4096).optional(),
  pageSize: z
    .union([
      z.literal(CLAIM_QUEUE_PAGE_SIZES[0]),
      z.literal(CLAIM_QUEUE_PAGE_SIZES[1]),
      z.literal(CLAIM_QUEUE_PAGE_SIZES[2]),
    ])
    .default(25),
});

export type ClaimQueueInput = z.infer<typeof ClaimQueueInputSchema>;

export const ClaimQueueRowSchema = z.object({
  partnershipId: z.string(),
  projectId: z.string(),
  projectName: z.string(),
  organizationId: z.string(),
  organizationName: z.string(),
  status: ClaimStatusSchema,
  submittedAt: z.date(),
  reimbursementAmountEur: z.string(),
});

export type ClaimQueueRow = z.infer<typeof ClaimQueueRowSchema>;

const ClaimQueueMetricsSchema = z.object({
  claimCount: z.number().int().nonnegative(),
  projectCount: z.number().int().nonnegative(),
  partnerOrganizationCount: z.number().int().nonnegative(),
});

export type ClaimQueueMetrics = z.infer<typeof ClaimQueueMetricsSchema>;

export const ClaimQueueOutputSchema = z.object({
  rows: z.array(ClaimQueueRowSchema),
  previousCursor: z.string().optional(),
  nextCursor: z.string().optional(),
  metrics: z.object({
    whole: ClaimQueueMetricsSchema,
    filtered: ClaimQueueMetricsSchema,
  }),
  partnerOptions: z.array(z.object({ id: z.string(), name: z.string() })),
});
