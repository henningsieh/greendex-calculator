import type { InferRouterOutputs } from "@orpc/server";

import {
  getFullOrganization,
  getOrganizationRole,
  getOrganizationStats,
  listOrganizations,
  searchMembers,
} from "@/features/organizations/procedures";
import {
  createProjectSharedTravelLeg,
  deleteProjectSharedTravelLeg,
  listProjectSharedTravelLegs,
  updateProjectSharedTravelLeg,
} from "@/features/project-shared-travel-legs/procedures";
import {
  archiveProject,
  reopenProject,
  batchDeleteProjects,
  createProject,
  deleteProject,
  getProjectById,
  getProjectForParticipation,
  getProjectParticipants,
  listProjects,
  setActiveProject,
  updateProject,
} from "@/features/projects/procedures";
import {
  getHealth,
  getProfile,
  getSession,
  helloWorld,
  signIn,
  signOut,
  signUp,
} from "@/lib/orpc/procedures";

/**
 * Main oRPC router
 * Defines all available procedures organized by namespace
 */
export const router = {
  // Public procedures
  helloWorld,
  health: getHealth,

  // User namespace for authenticated procedures
  users: {
    getProfile,
  },

  // Auth namespace for Better Auth procedures
  betterauth: {
    getSession,
    signIn,
    signUp,
    signOut,
  },

  // Organization namespace
  organizations: {
    list: listOrganizations,
    getActive: getFullOrganization,
    getRole: getOrganizationRole,
    getStats: getOrganizationStats,
  },

  // Member namespace
  members: {
    search: searchMembers,
  },

  // Project namespace
  projects: {
    list: listProjects,
    create: createProject,
    getById: getProjectById,
    getForParticipation: getProjectForParticipation,
    update: updateProject,
    delete: deleteProject,
    archive: archiveProject,
    reopen: reopenProject,
    batchDelete: batchDeleteProjects,
    setActive: setActiveProject,
    getParticipants: getProjectParticipants,
  },

  // Project Shared Travel Leg namespace
  projectSharedTravelLegs: {
    list: listProjectSharedTravelLegs,
    create: createProjectSharedTravelLeg,
    update: updateProjectSharedTravelLeg,
    delete: deleteProjectSharedTravelLeg,
  },
};

export type Router = typeof router;

export type Outputs = InferRouterOutputs<typeof router>;
