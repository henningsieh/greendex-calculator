import type { z } from "zod";

import type {
  PartnerOrganizationListItemSchema,
  ProjectListItemSchema,
} from "@/features/projects/validation-schemas";

export type ProjectListItem = z.infer<typeof ProjectListItemSchema>;
export type PartnerOrganizationListItem = z.infer<
  typeof PartnerOrganizationListItemSchema
>;
