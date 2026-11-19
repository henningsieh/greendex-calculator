import { PAGE_SIZE_OPTIONS } from "@greendex/config/pagination";
import { projectsTable } from "@greendex/database";
import type { InferSelectModel } from "drizzle-orm";
import type { z } from "zod";

import type {
  ProjectSortFieldSchema,
  ProjectForParticipationSchema,
  ProjectWithRelationsSchema,
  ProjectWithLifecycleSchema,
} from "./validation-schemas";

/**
 * Valid project sort field values
 * These correspond to the sortable columns in the projects table
 */
export type ProjectSortField = keyof typeof projectsTable.$inferSelect;

/**
 * Type for available page size options
 * Used in ProjectsTable and other paginated components for type safety
 */
export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const PROJECT_SORT_FIELDS = [
  "name",
  "country",
  "location",
  "startDate",
  "createdAt",
  "updatedAt",
] as const satisfies readonly ProjectSortField[];

/**
 * Default sorting configuration for projects table (single column)
 * - column: project field used for default sort
 * - order: 'asc' | 'desc'
 */
export const DEFAULT_PROJECT_SORT = {
  column: "name",
  order: "desc",
} as const satisfies {
  readonly column: ProjectSortField;
  readonly order: "asc" | "desc";
};

/**
 * Default project duration in days when creating a new project.
 */
export const DEFAULT_PROJECT_DURATION_DAYS = 5;

// ============================================================================
// PROJECT TYPES
// ============================================================================

// Type inferred from DB schema
export type ProjectType = InferSelectModel<typeof projectsTable>;

// Type inferred from schema with relations (user, organization)
export type ProjectWithRelationsType = z.infer<typeof ProjectWithRelationsSchema>;
export type ProjectWithLifecycleType = z.infer<typeof ProjectWithLifecycleSchema>;

// Type inferred from the public participation contract.
export type ProjectForParticipationType = z.infer<
  typeof ProjectForParticipationSchema
>;

/**
 * Project statistics summary object returned by `getProjectStatistics`.
 */
export type ProjectStatistics = {
  participantsCount: number;
  sharedTravelLegsCount: number;
  totalDistanceKm: number;
  durationDays: number;
  sharedTravelCO2Kg: number;
};

// ============================================================================
// Helper types for listProjects procedures
// ============================================================================

/**
 * Input type for listing projects procedure
 */
export type ListProjectsInput =
  | {
      sort_by?: z.infer<typeof ProjectSortFieldSchema>;
      archived?: boolean;
    }
  | undefined;
