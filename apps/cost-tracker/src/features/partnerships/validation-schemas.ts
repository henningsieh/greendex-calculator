import {
  IDENTIFIER_MAX_LENGTH,
  partnerOrganizationSetupLinksTable,
  projectPartnerOrganizationsTable,
} from "@greendex/database/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { ProjectIdSchema } from "@/features/projects/validation-schemas";

/**
 * Opaque identifier shared by coordination-scoped records (Project,
 * Partnership, Participant, Entry). Declared here so identifier policy has one
 * owning module instead of a separate helper file.
 */
export const CoordinationIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

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
const ProjectPartnershipSelectSchema = createSelectSchema(
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
    organizationId: z
      .string()
      .trim()
      .min(1, "organizationIdRequired")
      .max(IDENTIFIER_MAX_LENGTH, "organizationIdTooLong"),
  });

export const RemoveProjectPartnershipInputSchema =
  ProjectPartnershipSelectSchema.pick({ id: true }).safeExtend({
    id: z.string().trim().min(1).max(IDENTIFIER_MAX_LENGTH),
  });

export const RemoveProjectPartnershipResultSchema = z.object({
  id: z.string(),
  removed: z.literal(true),
});

export const ProjectPartnershipIdSchema = createSelectSchema(
  projectPartnerOrganizationsTable,
)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);

export const SetupLinkIdSchema = createSelectSchema(
  partnerOrganizationSetupLinksTable,
)
  .shape.id.trim()
  .min(1)
  .max(IDENTIFIER_MAX_LENGTH);
