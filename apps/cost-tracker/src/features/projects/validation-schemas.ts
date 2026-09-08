import { z } from "zod";

export const ProjectListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  location: z.string(),
  costSubmissionWindowOpen: z.boolean(),
  partnerOrganizationCount: z.number().int().nonnegative(),
});

export const PartnerOrganizationListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  projectNames: z.array(z.string()),
});
