import { db } from "@greendex/database";
import {
  projectSharedTravelLegsTable,
  projectParticipantsTable,
  projectsTable,
  session as sessionTable,
  user,
} from "@greendex/database/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";

import { MEMBER_ROLES } from "@/features/organizations/types";
import { ProjectParticipantWithUserSchema } from "@/features/participants/validation-schemas";
import { DEFAULT_PROJECT_SORT } from "@/features/projects/types";
import { computeSortDesc, orderByClauseFor } from "@/features/projects/utils";
import { auth } from "@/lib/better-auth";
import { base } from "@/lib/orpc/context";
import { authorized, requireProjectPermissions } from "@/lib/orpc/middleware";

import {
  ProjectCreateFormSchema,
  ProjectSortFieldSchema,
  ProjectUpdateFormSchema,
  ProjectForParticipationSchema,
  ProjectWithRelationsSchema,
} from "./validation-schemas";

/**
 * Create a new project
 *
 * Requires:
 * - Authentication
 * - Active organization
 * - "create" permission on project resource (owner/admin only)
 */
export const createProject = authorized
  .use(requireProjectPermissions(["create"]))
  .route({
    method: "POST",
    path: "/projects",
    summary: "Create a new project",
    tags: ["project"],
  })
  .input(ProjectCreateFormSchema)
  .output(
    z.object({
      success: z.boolean(),
      project: ProjectWithRelationsSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    const newProject = await db
      .insert(projectsTable)
      .values({
        ...input,
        responsibleUserId: context.user.id,
        organizationId: context.session.activeOrganizationId,
      })
      .returning();

    // Fetch the created project with responsible user
    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, newProject[0].id),
      with: {
        responsibleUser: true,
        organization: true,
      },
    });

    if (!project) {
      throw errors.BAD_REQUEST({
        message: "Failed to fetch created project",
      });
    }

    return {
      success: true,
      project,
    };
  });

/**
 * List projects based on user's organization membership
 *
 * Behavior:
 * - Members (role: "member"): See all projects in their organization (read-only)
 * - Project Coordinators/Organization Administrators: See all projects in their organization (full access)
 *
 * This respects Better Auth's organization-based permissions:
 * - Users can only see projects from organizations they are members of
 * - Projects are isolated by organization
 */

export const listProjects = authorized
  .use(requireProjectPermissions(["read"]))
  .route({
    method: "GET",
    path: "/projects",
    summary: "List all projects in the active organization",
    tags: ["project"],
  })
  .input(
    z
      .object({
        sort_by: ProjectSortFieldSchema.default("startDate").optional(),
        archived: z.boolean().optional(),
      })
      .optional(),
  )
  .output(z.array(ProjectWithRelationsSchema))
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    // Determine sort order using DEFAULT_PROJECT_SORT as source of truth
    const sortField = input?.sort_by ?? DEFAULT_PROJECT_SORT.column;
    const sortDesc = computeSortDesc(input);
    const orderByClause = orderByClauseFor(sortField, sortDesc);

    const conditions = [
      eq(projectsTable.organizationId, context.session.activeOrganizationId),
      ...(input?.archived !== undefined
        ? [eq(projectsTable.archived, input.archived)]
        : []),
    ];

    const projects = await db.query.projectsTable.findMany({
      where: and(...conditions),
      orderBy: [orderByClause],
      with: {
        responsibleUser: true,
        organization: true,
      },
    });

    return projects;
  });

/**
 * Get project details by ID
 *
 * Requires:
 * - Authentication
 * - "read" permission on project resource
 * - Project must belong to user's active organization
 */
export const getProjectById = authorized
  .use(requireProjectPermissions(["read"]))
  .route({
    method: "GET",
    path: "/projects/:id",
    summary: "Get project details by ID",
    tags: ["project"],
  })
  .input(
    z.object({
      id: z.string().describe("Project ID"),
    }),
  )
  .output(ProjectWithRelationsSchema)
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    // First, check if project exists at all
    const projectExists = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, input.id),
    });

    if (!projectExists) {
      throw errors.NOT_FOUND({
        message: "Project not found",
      });
    }

    // Fetch project and verify it belongs to user's organization
    const existingProject = await db.query.projectsTable.findFirst({
      where: and(
        eq(projectsTable.id, input.id),
        eq(projectsTable.organizationId, context.session.activeOrganizationId),
      ),
      with: {
        responsibleUser: true,
        organization: true,
      },
    });

    if (!existingProject) {
      throw errors.FORBIDDEN({
        message: "You don't have access to this project",
      });
    }

    return existingProject;
  });

/**
 * Update project details
 *
 * Requires:
 * - Authentication
 * - "update" permission on project resource (admin/owner only)
 * - Project must belong to user's active organization
 */
export const updateProject = authorized
  .use(requireProjectPermissions(["update"]))
  .route({
    method: "PATCH",
    path: "/projects/:id",
    summary: "Update project details",
    tags: ["project"],
  })
  .input(
    z.object({
      id: z.string().describe("Project ID"),
      data: ProjectUpdateFormSchema,
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      project: ProjectWithRelationsSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    // Verify project belongs to user's organization before updating
    const [existingProject] = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, input.id),
          eq(projectsTable.organizationId, context.session.activeOrganizationId),
        ),
      )
      .limit(1);

    if (!existingProject) {
      throw errors.NOT_FOUND({
        message: "Project not found",
      });
    }

    if (existingProject.organizationId !== context.session.activeOrganizationId) {
      throw errors.FORBIDDEN({
        message: "You don't have permission to update this project",
      });
    }

    await db
      .update(projectsTable)
      .set(input.data)
      .where(eq(projectsTable.id, input.id));

    // Fetch the updated project with responsible user
    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, input.id),
      with: {
        responsibleUser: true,
        organization: true,
      },
    });

    if (!project) {
      throw errors.BAD_REQUEST({
        message: "Failed to fetch updated project",
      });
    }

    return {
      success: true,
      project,
    };
  });

/**
 * Delete a project
 *
 * Requires:
 * - Authentication
 * - Organization Administrator role OR Project Coordinator role AND is the responsible user of the project
 * - Project must belong to user's active organization
 */
export const deleteProject = authorized
  .use(requireProjectPermissions(["delete"]))
  .route({
    method: "DELETE",
    path: "/projects/:id",
    summary: "Delete a project",
    tags: ["project"],
  })
  .input(
    z.object({
      id: z.string().describe("Project ID"),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    // Verify project exists and belongs to organization
    const [existingProject] = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, input.id),
          eq(projectsTable.organizationId, context.session.activeOrganizationId),
        ),
      )
      .limit(1);

    if (!existingProject) {
      throw errors.NOT_FOUND({
        message: "Project not found or you don't have access to it",
      });
    }

    // Get current member role
    const { role } = await auth.api.getActiveMemberRole({
      headers: await headers(),
    });

    // Organization Administrators can delete any project; Project Coordinators can delete only their own.
    const isOrganizationAdministrator =
      role === MEMBER_ROLES.OrganizationAdministrator;
    const isResponsibleProjectCoordinator =
      role === MEMBER_ROLES.ProjectCoordinator &&
      existingProject.responsibleUserId === context.user.id;

    if (!isOrganizationAdministrator && !isResponsibleProjectCoordinator) {
      throw errors.FORBIDDEN({
        message:
          "You don't have permission to delete this project. Only an Organization Administrator or the responsible Project Coordinator can delete it.",
      });
    }

    // Delete the project
    await db.delete(projectsTable).where(eq(projectsTable.id, input.id));

    return {
      success: true,
    };
  });

/**
 * Archive a project
 *
 * Requires:
 * - Authentication
 * - Organization Administrator role OR Project Coordinator role AND is the responsible user of the project
 * - Project must belong to user's active organization
 */
export const archiveProject = authorized
  .route({
    method: "PATCH",
    path: "/projects/:id/archive",
    summary: "Archive a project",
    tags: ["project"],
  })
  .input(
    z.object({
      id: z.string().describe("Project ID"),
      archived: z.boolean().describe("Archive status"),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      project: ProjectWithRelationsSchema,
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    // Get current member role
    const { role } = await auth.api.getActiveMemberRole({
      headers: await headers(),
    });

    // Verify project exists and belongs to organization
    const [existingProject] = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, input.id),
          eq(projectsTable.organizationId, context.session.activeOrganizationId),
        ),
      )
      .limit(1);

    if (!existingProject) {
      throw errors.NOT_FOUND({
        message: "Project not found or you don't have access to it",
      });
    }

    // Organization Administrators can archive any project; Project Coordinators can archive only their own.
    const isOrganizationAdministrator =
      role === MEMBER_ROLES.OrganizationAdministrator;
    const isResponsibleProjectCoordinator =
      role === MEMBER_ROLES.ProjectCoordinator &&
      existingProject.responsibleUserId === context.user.id;

    if (!isOrganizationAdministrator && !isResponsibleProjectCoordinator) {
      throw errors.FORBIDDEN({
        message:
          "You don't have permission to archive this project. Only an Organization Administrator or the responsible Project Coordinator can archive it.",
      });
    }

    // Archive/unarchive the project
    await db
      .update(projectsTable)
      .set({ archived: input.archived })
      .where(eq(projectsTable.id, input.id));

    // Fetch the updated project with relations
    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, input.id),
      with: {
        responsibleUser: true,
        organization: true,
      },
    });

    if (!project) {
      throw errors.BAD_REQUEST({
        message: "Failed to fetch archived project",
      });
    }

    return {
      success: true,
      project,
    };
  });

/**
 * Set active project for the session
 *
 * Requires:
 * - Authentication
 * - "read" permission on project resource
 * - Project must belong to user's active organization (if projectId is provided)
 */
export const setActiveProject = authorized
  .route({
    method: "POST",
    path: "/projects/active",
    summary: "Set active project",
    tags: ["project"],
  })
  .input(
    z.object({
      projectId: z.string().optional(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    // If projectId is provided, verify user has access to it
    if (input.projectId) {
      if (!context.session.activeOrganizationId) {
        throw errors.BAD_REQUEST({
          message: "No active organization. Please select an organization first.",
        });
      }

      const { role } = await auth.api.getActiveMemberRole({
        headers: await headers(),
      });

      if (
        role !== MEMBER_ROLES.ProjectCoordinator &&
        role !== MEMBER_ROLES.OrganizationAdministrator
      ) {
        throw errors.FORBIDDEN({
          message: "You don't have permission to set an active project",
        });
      }

      // Verify project belongs to user's organization
      const [existingProject] = await db
        .select()
        .from(projectsTable)
        .where(
          and(
            eq(projectsTable.id, input.projectId),
            eq(
              projectsTable.organizationId,
              context.session.activeOrganizationId,
            ),
          ),
        )
        .limit(1);

      if (!existingProject) {
        throw errors.NOT_FOUND({
          message: "This Project was not found",
        });
      }

      if (
        existingProject.organizationId !== context.session.activeOrganizationId
      ) {
        throw errors.FORBIDDEN({
          message: "You don't have permission to set this project as active",
        });
      }
    }

    await db
      .update(sessionTable)
      .set({
        activeProjectId: input.projectId,
      })
      .where(eq(sessionTable.id, context.session.id));

    return {
      success: true,
    };
  });

/**
 * Get project participants with details
 *
 * Requires:
 * - Authentication
 * - "read" permission on project resource
 * - Project must belong to user's active organization
 */
export const getProjectParticipants = authorized
  .use(requireProjectPermissions(["read"]))
  .route({
    method: "GET",
    path: "/projects/:id/participants",
    summary: "Get project participants with user details",
    tags: ["project"],
  })
  .input(
    z.object({
      projectId: z.string().describe("Project ID"),
    }),
  )
  .output(z.array(ProjectParticipantWithUserSchema))
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    // Verify project belongs to user's organization
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(
        and(
          eq(projectsTable.id, input.projectId),
          eq(projectsTable.organizationId, context.session.activeOrganizationId),
        ),
      )
      .limit(1);

    if (!project) {
      throw errors.FORBIDDEN({
        message: "You don't have access to this project",
      });
    }

    // Get all participants for this project with user details
    const participants = await db
      .select({
        id: projectParticipantsTable.id,
        projectId: projectParticipantsTable.projectId,
        memberId: projectParticipantsTable.memberId,
        userId: projectParticipantsTable.userId,
        country: projectParticipantsTable.country,
        createdAt: projectParticipantsTable.createdAt,
        updatedAt: projectParticipantsTable.updatedAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(projectParticipantsTable)
      .innerJoin(user, eq(projectParticipantsTable.userId, user.id))
      .where(eq(projectParticipantsTable.projectId, input.projectId));

    // NOTE: Demo delay has been moved into a global orpc middleware

    return participants;
  });

/**
 * Batch delete projects
 *
 * Requires:
 * - Authentication
 * - Organization Administrator role OR Project Coordinator role AND is the responsible user of each project
 * - All projects must belong to user's active organization
 */
export const batchDeleteProjects = authorized
  .use(requireProjectPermissions(["delete"]))
  .route({
    method: "DELETE",
    path: "/projects/batch",
    summary: "Batch delete multiple projects",
    tags: ["project"],
  })
  .input(
    z.object({
      projectIds: z.array(z.string()).min(1),
    }),
  )
  .output(
    z.object({
      success: z.boolean(),
      deletedCount: z.number(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    if (!context.session.activeOrganizationId) {
      throw errors.BAD_REQUEST({
        message: "No active organization. Please select an organization first.",
      });
    }

    // Get current member role
    const { role } = await auth.api.getActiveMemberRole({
      headers: await headers(),
    });

    // Verify all projects belong to user's organization and check permissions
    const projectsToDelete = await db
      .select({
        id: projectsTable.id,
        responsibleUserId: projectsTable.responsibleUserId,
      })
      .from(projectsTable)
      .where(
        and(
          inArray(projectsTable.id, input.projectIds),
          eq(projectsTable.organizationId, context.session.activeOrganizationId),
        ),
      );

    if (projectsToDelete.length !== input.projectIds.length) {
      throw errors.FORBIDDEN({
        message:
          "Some projects don't exist or you don't have permission to delete them",
      });
    }

    // Organization Administrators can delete any project; Project Coordinators only their own.
    const isOrganizationAdministrator =
      role === MEMBER_ROLES.OrganizationAdministrator;
    for (const project of projectsToDelete) {
      const isResponsibleProjectCoordinator =
        role === MEMBER_ROLES.ProjectCoordinator &&
        project.responsibleUserId === context.user.id;

      if (!isOrganizationAdministrator && !isResponsibleProjectCoordinator) {
        throw errors.FORBIDDEN({
          message:
            "You don't have permission to delete one or more of these projects. Only an Organization Administrator or the responsible Project Coordinator can delete projects.",
        });
      }
    }

    // Delete the projects
    const result = await db
      .delete(projectsTable)
      .where(
        and(
          inArray(projectsTable.id, input.projectIds),
          eq(projectsTable.organizationId, context.session.activeOrganizationId),
        ),
      );

    return {
      success: true,
      deletedCount: result.rowCount || 0,
    };
  });

// ============================================================================
// PUBLIC PROCEDURES (NO AUTH REQUIRED)
// ============================================================================

/**
 * Get project for public participation (no auth required)
 *
 * This is a public endpoint used by the participation form.
 * Returns project details with canonical Project Shared Travel Legs.
 */
export const getProjectForParticipation = base
  .route({
    method: "GET",
    path: "/projects/:id/participate",
    summary: "Get project details for participation (public)",
    tags: ["project", "public"],
  })
  .input(
    z.object({
      id: z.string().describe("Project ID"),
    }),
  )
  .output(ProjectForParticipationSchema)
  .handler(async ({ input, errors }) => {
    // Fetch project (no organization check needed for public participation)
    const project = await db.query.projectsTable.findFirst({
      where: eq(projectsTable.id, input.id),
      with: {
        responsibleUser: true,
        organization: true,
        sharedTravelLegs: {
          orderBy: [asc(projectSharedTravelLegsTable.createdAt)],
          with: {
            project: true,
          },
        },
      },
    });

    if (!project) {
      throw errors.NOT_FOUND({
        message: "Project not found",
      });
    }

    return project;
  });
