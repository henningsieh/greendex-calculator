import type z from "zod";

import { type AppRoute, PROJECT_DETAIL_PATH } from "@/app/routes";
import type { ProjectParticipantWithUser } from "@/features/participants/types";
import {
  calculateProjectSharedTravelCO2,
  type ProjectSharedTravelLegForCalculation,
} from "@/features/project-shared-travel-legs/calculations";
import type {
  ListProjectsInput,
  ProjectStatistics,
  ProjectType,
} from "@/features/projects/types";
import {
  DEFAULT_PROJECT_SORT,
  ProjectSortField,
} from "@/features/projects/types";
import type { ProjectSortFieldSchema } from "@/features/projects/validation-schemas";
import { orpc } from "@/lib/orpc/orpc";

/**
 * Milliseconds in one day (used for date/time calculations).
 */
export const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Get the project detail path for a given project ID
 * @param projectId
 * @returns The project detail path with the project ID inserted
 */
export const getProjectDetailPath = (projectId: string): AppRoute =>
  PROJECT_DETAIL_PATH.replace("[id]", projectId) as AppRoute;

/**
 * Produce the default sorting configuration used for project lists.
 *
 * @returns An array with a single sort criterion: `id` is the default sort column and `desc` is `true` when the default order is `"desc"`, `false` otherwise.
 */
export function getProjectsDefaultSorting() {
  return [
    {
      id: DEFAULT_PROJECT_SORT.column as ProjectSortField,
      desc: DEFAULT_PROJECT_SORT.order === "desc",
    },
  ];
}

/**
 * Retrieves a project and its associated Project Shared Travel Legs.
 *
 * @param projectId - The project's unique identifier
 * @returns The project data including its shared travel legs, or `null` if fetching fails
 */
export async function getProjectData(projectId: string) {
  try {
    return await orpc.projects.getForParticipation({ id: projectId });
  } catch (error) {
    console.error("Failed to fetch project data:", error);
    return null;
  }
}

/**
 * Return the localized display name for a project sort field or column.
 *
 * @param columnId - The project sort field or column identifier to translate
 * @param t - Translation function that accepts a translation key and returns the localized string
 * @returns The localized display name for `columnId`, or `columnId` unchanged if no mapping exists
 */
export function getColumnDisplayName(
  columnId: string,
  t: (key: string) => string,
): string {
  switch (columnId) {
    case "name":
      return t("table.name");
    case "country":
      return t("table.country");
    case "location":
      return t("table.city");
    case "startDate":
      return t("table.start-date");
    case "createdAt":
      return t("table.created");
    case "updatedAt":
      return t("table.updated");
    default:
      return columnId;
  }
}

/**
 * Compare two field values and produce an ordering number, honoring the requested sort direction.
 *
 * Compares two values as Dates (by timestamp) when both are Date instances, as strings using localeCompare when both are strings, and otherwise by their stringified forms. Does not treat `null`/`undefined` specially.
 *
 * @param aValue - The first value to compare
 * @param bValue - The second value to compare
 * @param sortDesc - If `true`, the comparison result is reversed for descending order
 * @returns A negative number if `aValue` is less than `bValue`, zero if equal, or a positive number if `aValue` is greater than `bValue`; the sign is reversed when `sortDesc` is `true`
 */
function compareProjectFieldValues(
  aValue: unknown,
  bValue: unknown,
  sortDesc: boolean,
) {
  if (aValue instanceof Date && bValue instanceof Date) {
    const diff = aValue.getTime() - bValue.getTime();
    return sortDesc ? -diff : diff;
  }

  if (typeof aValue === "string" && typeof bValue === "string") {
    const res = aValue.localeCompare(bValue);
    return sortDesc ? -res : res;
  }

  const res = String(aValue).localeCompare(String(bValue));
  return sortDesc ? -res : res;
}

/**
 * Create a comparator function for Project objects based on a specific field and sort direction.
 *
 * @param sortBy - The project field to compare.
 * @param sortDesc - If `true`, the comparator orders descending; otherwise orders ascending.
 * @returns A comparison function returning a negative number if the first project should come before the second, `0` if they are equal, or a positive number if the first should come after the second.
 */
export function createProjectComparator(
  sortBy: ProjectSortField,
  sortDesc: boolean,
) {
  return (a: ProjectType, b: ProjectType) => {
    const aValue = a[sortBy as keyof ProjectType];
    const bValue = b[sortBy as keyof ProjectType];

    // Handle null/undefined - push them to the end
    if (aValue == null && bValue == null) {
      return 0;
    }
    if (aValue == null) {
      return sortDesc ? -1 : 1;
    }
    if (bValue == null) {
      return sortDesc ? 1 : -1;
    }

    return compareProjectFieldValues(aValue, bValue, sortDesc);
  };
}

/**
 * @param startDate The start date of the project
 * @param endDate The end date of the project
 * @returns The duration of the project in days
 */
/**
 * Compute the project duration in days in a tolerant way.
 *
 * - Returns 0 for invalid dates or when end is before start.
 * - Uses Math.ceil to match UI expectations (partial days count as a full day).
 *
 * @param startDate The start date of the project
 * @param endDate The end date of the project
 * @returns The duration in whole days (>= 0)
 */
export const calculateProjectDuration = (
  startDate: string | Date,
  endDate: string | Date,
) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffInMs = end.getTime() - start.getTime();
  if (!Number.isFinite(diffInMs) || diffInMs < 0) {
    return 0;
  }

  return Math.max(0, Math.ceil(diffInMs / MILLISECONDS_PER_DAY));
};

/**
 * Compute commonly used statistics for a project in one place so the UI and other
 * consumers get consistent, testable values.
 *
 * The function is tolerant of missing inputs and returns sensible defaults.
 */
export function getProjectStatistics(
  project:
    | { startDate?: string | Date; endDate?: string | Date }
    | null
    | undefined,
  participants?: ProjectParticipantWithUser[] | null,
  sharedTravelLegs?: ProjectSharedTravelLegForCalculation[] | null,
): ProjectStatistics {
  const participantsCount = participants?.length ?? 0;
  const sharedTravelLegsCount = sharedTravelLegs?.length ?? 0;

  const totalDistance = (sharedTravelLegs ?? []).reduce(
    (sum, sharedTravelLeg) => {
      const distanceKm = Number(sharedTravelLeg.distanceKm);
      return (
        sum + (Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0)
      );
    },
    0,
  );

  const durationDays = project
    ? calculateProjectDuration(project.startDate ?? "", project.endDate ?? "")
    : 0;

  const sharedTravelCO2Kg = calculateProjectSharedTravelCO2(
    sharedTravelLegs ?? [],
  );

  return {
    participantsCount,
    sharedTravelLegsCount,
    totalDistanceKm: totalDistance,
    durationDays,
    sharedTravelCO2Kg,
  };
}

/**
 * Determine whether project list sorting should be descending.
 *
 * Uses the configured default sort direction when no sort field is provided or when the requested
 * sort field equals the configured default column; otherwise returns `false`.
 *
 * @param input - Query input for listing projects
 * @returns `true` if sorting should be descending, `false` otherwise
 */
export function computeSortDesc(input: ListProjectsInput) {
  // If no explicit sort field was requested, use the configured default
  if (input?.sort_by === undefined) {
    return DEFAULT_PROJECT_SORT.order === "desc";
  }

  // If the client requested the default column, apply the default direction
  return input.sort_by === DEFAULT_PROJECT_SORT.column
    ? DEFAULT_PROJECT_SORT.order === "desc"
    : false;
}

/**
 * Builds a relational ORDER BY object for the specified project sort field and direction.
 *
 * NOTE (ORM 1.0): relational queries no longer accept SQL expressions here, so
 * `name`/`location` sort case-sensitively (previously `lower()`).
 *
 * @param sortField - The project sort field to order by (e.g. `"name"`, `"startDate"`, `"createdAt"`, `"updatedAt"`).
 * @param sortDesc - If `true`, sort descending; otherwise ascending.
 * @returns A `{ column: "asc" | "desc" }` ordering object for `db.query`.
 */
export function orderByClauseFor(
  sortField: z.infer<typeof ProjectSortFieldSchema>,
  sortDesc: boolean,
): Record<string, "asc" | "desc"> {
  const dir = sortDesc ? "desc" : ("asc" as const);
  switch (sortField) {
    case "name":
      return { name: dir };
    case "country":
      return { country: dir };
    case "location":
      return { location: dir };
    case "startDate":
      return { startDate: dir };
    case "createdAt":
      return { createdAt: dir };
    case "updatedAt":
      return { updatedAt: dir };
    default:
      return {
        startDate: DEFAULT_PROJECT_SORT.order === "desc" ? "desc" : "asc",
      };
  }
}
