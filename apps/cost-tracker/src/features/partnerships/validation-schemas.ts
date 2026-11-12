import {
  IDENTIFIER_MAX_LENGTH,
  organization,
  partnerOrganizationSetupLinksTable,
  projectPartnerOrganizationsTable,
} from "@greendex/database/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { ProjectIdSchema } from "@/features/projects/validation-schemas";
import { UserIdSchema } from "@/features/user-settings/validation-schemas";

const ProjectPartnershipSelectSchema = createSelectSchema(
  projectPartnerOrganizationsTable,
);

export const SetupLinkEmailSchema = z
  .email({
    error: (issue) => (issue.input === "" ? "emailRequired" : "emailInvalid"),
  })
  .transform((value) => value.toLowerCase());

export const CreateSetupLinkInputSchema = z.object({
  projectId: ProjectIdSchema,
  recipientEmail: SetupLinkEmailSchema,
});

const ProjectPartnershipInsertSchema = createInsertSchema(
  projectPartnerOrganizationsTable,
);
export const ProjectPartnershipSchema = z.object({
  id: ProjectPartnershipSelectSchema.shape.id,
  projectId: ProjectPartnershipSelectSchema.shape.projectId,
  projectName: z.string(),
  organizationId: ProjectPartnershipSelectSchema.shape.organizationId,
  organizationName: z.string(),
  // The assignment time is the partnership row's creation time.
  assignedAt: ProjectPartnershipSelectSchema.shape.createdAt,
  updatedAt: ProjectPartnershipSelectSchema.shape.updatedAt,
});

export const AssignProjectPartnershipInputSchema =
  ProjectPartnershipInsertSchema.pick({
    projectId: true,
    organizationId: true,
  }).safeExtend({
    projectId: ProjectIdSchema,
    organizationId: createSelectSchema(organization)
      .shape.id.trim()
      .min(1, "organizationIdRequired")
      .max(IDENTIFIER_MAX_LENGTH, "organizationIdTooLong"),
  });

export const ProjectPartnershipIdSchema = ProjectPartnershipSelectSchema.shape.id
  .trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const RemoveProjectPartnershipInputSchema =
  ProjectPartnershipSelectSchema.pick({ id: true }).safeExtend({
    id: ProjectPartnershipIdSchema,
  });

export const RemoveProjectPartnershipResultSchema = z.object({
  id: ProjectPartnershipSelectSchema.shape.id,
  removed: z.literal(true),
});

export const SetupLinkIdSchema = createSelectSchema(
  partnerOrganizationSetupLinksTable,
)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const PartnerCoordinatorInputSchema = z.object({
  partnershipId: ProjectPartnershipIdSchema,
  userId: UserIdSchema,
});

export const DisableSetupLinkInputSchema = z.object({ id: SetupLinkIdSchema });
