import { projectPartnerOrganizationsTable } from "@greendex/database/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const CoordinationIdSchema = z.string().trim().min(1).max(128);
export const SetupLinkEmailSchema = z
  .email()
  .transform((value) => value.toLowerCase());

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
