import { EU_COUNTRY_CODES } from "@greendex/config/eu-countries";
import {
  hostProjectAssignmentsTable,
  organization,
  projectsTable,
  user,
} from "@greendex/database/schema";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-zod";
import { z } from "zod";

import {
  ProjectSharedTravelLegFormSchema,
  ProjectSharedTravelLegWithRelationsSchema,
} from "@/features/project-shared-travel-legs/validation-schemas";

import { PROJECT_SORT_FIELDS } from "./types";

// Common form field extensions with custom error messages
const projectFormExtensions = {
  country: z.enum(EU_COUNTRY_CODES, {
    error: "Please select a valid EU country",
  }),
  name: z.string().min(1, { error: "Name is required" }),
  startDate: z.date({ error: "Please select a valid start date" }),
  endDate: z.date({ error: "Please select a valid end date" }),
};

export const ProjectSortFieldSchema = z.enum(PROJECT_SORT_FIELDS);

/**
 * Schema for creating a new project (only user-provided fields).
 *
 * This schema is derived from `projectsTable` via `createInsertSchema` and
 * customized to represent the payload that can be submitted by users when
 * creating a project.
 *
 * Key details:
 * - Omits database-managed fields: `id`, `createdAt`, and `updatedAt`.
 * - Extends with `projectFormExtensions`, which enforces:
 *   - `country`: enum of EU country codes (with a custom error message)
 *   - `name`: required non-empty string
 *   - `startDate` / `endDate`: `Date` values with validation messages
 *
 * Usage:
 * - Use this schema to validate create-request payloads from forms or APIs.
 * - If you need to accept shared travel at creation time, use
 *   `CreateProjectWithSharedTravelLegsSchema`, which extends this schema with
 *   an optional `sharedTravelLegs` array.
 *
 */
export const ProjectCreateFormSchema = createInsertSchema(projectsTable)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend(projectFormExtensions);

export const ProjectWithRelationsSchema = createSelectSchema(
  projectsTable,
).extend({
  hostAssignments: z.array(
    createSelectSchema(hostProjectAssignmentsTable).extend({
      user: createSelectSchema(user),
    }),
  ),
  organization: createSelectSchema(organization),
  country: z.enum(EU_COUNTRY_CODES),
});

/**
 * Schema for updating an existing project (partial user-provided fields).
 *
 * Built from `projectsTable` via `createUpdateSchema` and tailored for
 * edit/update payloads. This schema:
 *
 * - Omits database-managed fields: `id`, `createdAt`, and `updatedAt`.
 * - Extends with `projectFormExtensions` so that `name`, `startDate`, and
 *   `endDate` keep their validation rules, but fields may be omitted when
 *   performing partial updates.
 * - Explicitly makes `country` optional to allow updates that don't change the
 *   country value.
 *
 * Usage:
 * - Use this schema to validate update/edit request payloads from forms or APIs.
 * - For editing a project together with shared travel, use
 *   `EditProjectWithSharedTravelLegsSchema`, which extends this schema with
 *   an optional `sharedTravelLegs` array.
 *
 */
export const ProjectUpdateFormSchema = createUpdateSchema(projectsTable)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    ...projectFormExtensions,
    country: projectFormExtensions.country.optional(),
  });

// ============================================================================
// PROJECT SHARED TRAVEL LEG FORM SCHEMAS
// ============================================================================

const sharedTravelLegEditFormSchema = ProjectSharedTravelLegFormSchema.extend({
  id: z.string(),
  projectId: z.string(),
  isNew: z.boolean(),
  isDeleted: z.boolean(),
});

/**
 * Project editing values, including canonical Project Shared Travel Legs.
 * Existing leg IDs are retained so the form can update or delete the right row.
 */
export const EditProjectWithSharedTravelLegsSchema =
  ProjectUpdateFormSchema.extend({
    sharedTravelLegs: z.array(sharedTravelLegEditFormSchema).optional(),
  });

/**
 * Project creation values, including zero or more canonical Project Shared
 * Travel Legs. The leg fields intentionally reuse the management form schema.
 */
export const CreateProjectWithSharedTravelLegsSchema =
  ProjectCreateFormSchema.extend({
    sharedTravelLegs: z.array(ProjectSharedTravelLegFormSchema).optional(),
  });

export type CreateProjectWithSharedTravelLegs = z.infer<
  typeof CreateProjectWithSharedTravelLegsSchema
>;

/**
 * Public participation contract with canonical Project Shared Travel Legs.
 */
export const ProjectForParticipationSchema = createSelectSchema(
  projectsTable,
).extend({
  hostCoordinatorNames: z.array(z.string()),
  organization: createSelectSchema(organization),
  country: z.enum(EU_COUNTRY_CODES),
  sharedTravelLegs: z.array(ProjectSharedTravelLegWithRelationsSchema),
});
