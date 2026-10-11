import type { z } from "zod";

import type {
  HostedProjectListInputSchema,
  HostedProjectListSchema,
  PartnerProjectListInputSchema,
  PartnerProjectListSchema,
  ProjectListRowSchema,
} from "@/features/projects/validation-schemas";

export type HostedProjectListInput = z.output<
  typeof HostedProjectListInputSchema
>;
export type PartnerProjectListInput = z.output<
  typeof PartnerProjectListInputSchema
>;
export type ProjectListInput = PartnerProjectListInput;
export type ProjectListRow = z.output<typeof ProjectListRowSchema>;
export type HostedProjectList = z.output<typeof HostedProjectListSchema>;
export type PartnerProjectList = z.output<typeof PartnerProjectListSchema>;
export type ProjectListData = HostedProjectList | PartnerProjectList;
