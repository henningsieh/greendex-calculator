import { projectPartnerOrganizationsTable } from "@greendex/database/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { ProjectIdSchema } from "@/features/projects/validation-schemas";

/**
 * Opaque identifier shared by coordination-scoped records (Project,
 * Partnership, Participant, Entry). Declared here so identifier policy has one
 * owning module instead of a separate helper file.
 */
export const CoordinationIdSchema = z.string().trim().min(1).max(128);

export const SetupLinkEmailSchema = z
  .email({
    error: (issue) => (issue.input === "" ? "emailRequired" : "emailInvalid"),
  })
  .transform((value) => value.toLowerCase());

export const CreateSetupLinkInputSchema = z.object({
  projectId: ProjectIdSchema,
  recipientEmail: SetupLinkEmailSchema,
});

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
    projectId: ProjectIdSchema,
    organizationId: z
      .string()
      .trim()
      .min(1, "organizationIdRequired")
      .max(PROJECT_PARTNERSHIP_IDENTIFIER_MAX_LENGTH, "organizationIdTooLong"),
  });

export const RemoveProjectPartnershipInputSchema =
  ProjectPartnershipSelectSchema.pick({ id: true }).safeExtend({
    id: z.string().trim().min(1).max(PROJECT_PARTNERSHIP_IDENTIFIER_MAX_LENGTH),
  });

export const RemoveProjectPartnershipResultSchema = z.object({
  id: z.string(),
  removed: z.literal(true),
});
