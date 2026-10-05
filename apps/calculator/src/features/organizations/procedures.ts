import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import { db } from "@greendex/database";
import {
  projectSharedTravelLegsTable,
  projectParticipantsTable,
  projectsTable,
} from "@greendex/database/schema";
import { ORPCError } from "@orpc/server";
import { and, count, countDistinct, eq } from "drizzle-orm";
import { z } from "zod";

import {
  canonicalCalculatorRole,
  USERS_SORT_FIELDS,
  type MemberSortField,
} from "@/features/organizations/types";
import {
  MemberRoleSchema,
  MemberWithUserSchema,
} from "@/features/organizations/validation-schemas";
import { auth } from "@/lib/better-auth";
import { base } from "@/lib/orpc/context";
import { authorized } from "@/lib/orpc/middleware";

function getSortKey(
  member: z.infer<typeof MemberWithUserSchema>,
  sortBy: MemberSortField,
): string | number {
  if (sortBy === "createdAt") {
    const time = new Date(member.createdAt).getTime();
    return Number.isNaN(time) ? 0 : time;
  }
  if (sortBy === "role") {
    const roleOrder = {
      [ORGANIZATION_ROLES.OrganizationOwner]: 0,
      [ORGANIZATION_ROLES.OrganizationAdmin]: 1,
      [ORGANIZATION_ROLES.Participant]: 2,
    };
    const role = canonicalCalculatorRole(member.role);
    return role && role in roleOrder
      ? roleOrder[role as keyof typeof roleOrder]
      : 999;
  }
  if (sortBy === "user.name") {
    return (member.user?.name || "").toLowerCase();
  }
  if (sortBy === "user.email") {
    return (member.user?.email || "").toLowerCase();
  }
  // This should never happen due to the enum constraint, but TypeScript requires it
  throw new Error(`Invalid sortBy field: ${sortBy}`);
}

/**
 * Get full organization details using Better Auth
 * Uses Better Auth's implicit getFullOrganization endpoint
 */
export const getFullOrganization = authorized
  .route({
    method: "GET",
    path: "/organizations/active",
    summary: "Get active organization details",
  })
  .handler(async ({ context, errors }) => {
    // Validate active organization first (no try-catch needed for our own throws)
    if (!context.session.activeOrganizationId) {
      throw errors.FORBIDDEN({
        message: "No active organization. Please select an organization first.",
      });
    }

    // Handle Better Auth API call with proper error handling
    try {
      const organization = await auth.api.getFullOrganization({
        headers: context.headers,
      });

      if (!organization) {
        throw errors.NOT_FOUND({
          message: "Organization not found",
        });
      }

      return organization;
    } catch (error) {
      // If it's already an ORPC error, re-throw it
      if (error instanceof ORPCError) {
        throw error;
      }

      // Handle Better Auth specific errors
      console.error("Failed to fetch organization:", error);
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to retrieve organization details",
      });
    }
  });

export const getOrganizationRole = authorized
  .route({
    method: "GET",
    path: "/organizations/role",
    summary: "Get user's role in the active organization",
  })
  .output(MemberRoleSchema)
  .handler(async ({ context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.FORBIDDEN({
        message: "No active organization. Please select an organization first.",
      });
    }

    try {
      const organization = await auth.api.getFullOrganization({
        headers: context.headers,
      });

      if (!organization) {
        throw errors.NOT_FOUND({
          message: "Organization not found",
        });
      }

      const currentMember = organization.members.find(
        (member) => member.userId === context.user.id,
      );

      if (!currentMember?.role) {
        throw errors.NOT_FOUND({
          message: "Organization role not found",
        });
      }

      // #183 appends a Cost Tracker role to legacy admins; Calculator exposes only its existing role contract.
      const role = canonicalCalculatorRole(currentMember.role);
      if (!role)
        throw errors.FORBIDDEN({ message: "Organization role not found" });
      return role;
    } catch (error) {
      if (error instanceof ORPCError) {
        throw error;
      }

      console.error("Failed to fetch organization role:", error);
      throw errors.INTERNAL_SERVER_ERROR({
        message: "Failed to retrieve organization role",
      });
    }
  });

/**
 * List user's organizations using Better Auth
 * Uses Better Auth's implicit organization.list endpoint
 */
export const listOrganizations = base
  .route({
    method: "GET",
    path: "/organizations",
    summary: "List user's organizations",
  })
  .handler(async ({ context }) => {
    const organizations = await auth.api.listOrganizations({
      headers: context.headers,
    });
    return organizations || [];
  });

export const searchMembers = authorized
  .route({
    method: "POST",
    path: "/organizations/members/search",
    description: "Search members with flexible filters",
    tags: ["Organizations"],
  })
  .input(
    z.object({
      organizationId: z.string(),
      filters: z
        .object({
          roles: z.array(MemberRoleSchema).optional(),
          // Simple search string to match against user name or email
          search: z.string().optional(),
          // Sorting: a field name (e.g. "createdAt" | "user.name" | "email")
          sortBy: z.enum(USERS_SORT_FIELDS).optional(),
          sortDirection: z.enum(["asc", "desc"]).optional(),
          // limit/offset for pagination
          limit: z.number().optional(),
          offset: z.number().optional(),
        })
        .optional(),
    }),
  )
  .output(
    z.object({
      members: z.array(MemberWithUserSchema),
      total: z.number(),
    }),
  )
  .handler(async ({ context, input }) => {
    const { organizationId, filters } = input;

    const allMembers: z.infer<typeof MemberWithUserSchema>[] = [];
    // Ensure filters exist and default values
    const roles = filters?.roles || [];
    const search = filters?.search || undefined;
    const sortBy = filters?.sortBy || undefined;
    const sortDirection = filters?.sortDirection || undefined;
    const limit = filters?.limit ?? 10;
    const offset = filters?.offset ?? 0;

    for (const role of roles) {
      const result = await auth.api.listMembers({
        query: {
          organizationId,
          filterField: "role",
          filterOperator: "contains",
          filterValue: role,
        },
        headers: context.headers,
      });
      allMembers.push(...(result?.members || []));
    }

    // Deduplicate members by id in case of overlapping roles
    // Apply search filtering on returned users (server-side if API supports it)
    const filteredMembers = search
      ? allMembers.filter((member) => {
          const lower = search.toLowerCase();
          return (
            (member.user?.name || "").toLowerCase().includes(lower) ||
            (member.user?.email || "").toLowerCase().includes(lower)
          );
        })
      : allMembers;

    // Deduplicate members by id first
    const seen = new Set<string>();
    const uniqueFiltered = filteredMembers.filter((member) => {
      if (seen.has(member.id)) {
        return false;
      }
      seen.add(member.id);
      return true;
    });

    // Sorting
    const sortedMembers = sortBy
      ? [...uniqueFiltered].sort((a, b) => {
          const dir = sortDirection === "asc" ? 1 : -1;
          const aKey = getSortKey(a, sortBy);
          const bKey = getSortKey(b, sortBy);
          if (aKey < bKey) {
            return -1 * dir;
          }
          if (aKey > bKey) {
            return 1 * dir;
          }
          return 0;
        })
      : [...uniqueFiltered].sort((a, b) => {
          const aVal = getSortKey(a, "createdAt") as number;
          const bVal = getSortKey(b, "createdAt") as number;
          return bVal - aVal; // desc
        });

    // Apply pagination
    const paged = sortedMembers.slice(offset, offset + limit);
    return {
      members: paged,
      total: sortedMembers.length,
    };
  });

/**
 * Get organization statistics
 * Returns total projects, Project Participants, and Project Shared Travel Legs for an organization
 */
export const getOrganizationStats = authorized
  .route({
    method: "POST",
    path: "/organizations/stats",
    description:
      "Get organization statistics including total projects, Project Participants, and Project Shared Travel Legs",
    tags: ["Organizations"],
  })
  .input(
    z.object({
      organizationId: z.string(),
    }),
  )
  .output(
    z.object({
      totalProjects: z.number(),
      totalParticipants: z.number(),
      totalSharedTravelLegs: z.number(),
    }),
  )
  .handler(async ({ input }) => {
    const { organizationId } = input;

    // Count total projects for the organization (excluding archived)
    const projectsResult = await db
      .select({ count: count() })
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.organizationId, organizationId),
          eq(projectsTable.archived, false),
        ),
      );

    const totalProjects = projectsResult[0]?.count ?? 0;

    // Count unique participants across all projects in the organization
    const participantsResult = await db
      .select({ count: countDistinct(projectParticipantsTable.userId) })
      .from(projectParticipantsTable)
      .innerJoin(
        projectsTable,
        eq(projectParticipantsTable.projectId, projectsTable.id),
      )
      .where(
        and(
          eq(projectsTable.organizationId, organizationId),
          eq(projectsTable.archived, false),
        ),
      );

    const totalParticipants = participantsResult[0]?.count ?? 0;

    // Count Project Shared Travel Legs across all projects in the organization.
    const sharedTravelLegsResult = await db
      .select({ count: count() })
      .from(projectSharedTravelLegsTable)
      .innerJoin(
        projectsTable,
        eq(projectSharedTravelLegsTable.projectId, projectsTable.id),
      )
      .where(
        and(
          eq(projectsTable.organizationId, organizationId),
          eq(projectsTable.archived, false),
        ),
      );

    const totalSharedTravelLegs = sharedTravelLegsResult[0]?.count ?? 0;

    return {
      totalProjects,
      totalParticipants,
      totalSharedTravelLegs,
    };
  });
