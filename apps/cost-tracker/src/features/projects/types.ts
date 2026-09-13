import type { z } from "zod";

import type {
  HostedProjectOverviewInputSchema,
  HostedProjectOverviewSchema,
  PartnerProjectOverviewInputSchema,
  PartnerProjectOverviewSchema,
  ProjectOverviewRowSchema,
} from "@/features/projects/validation-schemas";

export type HostedProjectOverviewInput = z.output<
  typeof HostedProjectOverviewInputSchema
>;
export type PartnerProjectOverviewInput = z.output<
  typeof PartnerProjectOverviewInputSchema
>;
export type ProjectOverviewInput = PartnerProjectOverviewInput;
export type ProjectOverviewRow = z.output<typeof ProjectOverviewRowSchema>;
export type HostedProjectOverview = z.output<typeof HostedProjectOverviewSchema>;
export type PartnerProjectOverview = z.output<
  typeof PartnerProjectOverviewSchema
>;
export type ProjectOverviewData = HostedProjectOverview | PartnerProjectOverview;
