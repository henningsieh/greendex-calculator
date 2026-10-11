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

// Explicit app-owned fields prevent shared-table additions from becoming writable.
// organizationId remains a form value; procedures use the active Organization.
const projectFormFields = {
  name: true,
  startDate: true,
  endDate: true,
  location: true,
  country: true,
  welcomeMessage: true,
  organizationId: true,
} as const;

export const ProjectCreateFormSchema = createInsertSchema(projectsTable)
  .pick(projectFormFields)
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

// Generic edits do not own archive or Cost Tracker lifecycle transitions.
export const ProjectUpdateFormSchema = createUpdateSchema(projectsTable)
  .pick(projectFormFields)
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
