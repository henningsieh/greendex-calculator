/**
 * Shared Better Auth access control for organization roles.
 *
 * Single home for the access-control statement and the Calculator's role
 * map. Both Better Auth configs (server and browser) consume
 * `calculatorRoles`, so the two sides can never disagree. Statements stay
 * free of other apps' resources: no partnership, participation, or claim
 * concepts live here.
 */
import {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Available actions for the project resource.
 *
 * - create: Create new projects
 * - read: View project details
 * - update: Modify project information
 * - delete: Remove projects
 * - archive: Archive projects (soft delete)
 */
const statement = {
  ...defaultStatements, // Includes default organization, member, invitation and team permissions
  project: ["create", "read", "update", "delete", "archive"],
} as const;

/**
 * Shared access controller for organization roles.
 */
export const accessControl = createAccessControl(statement);

/**
 * Organization Owner role (stored `owner` value).
 * Full control over all resources including projects.
 */
const owner = accessControl.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete", "archive"],
});

/**
 * Organization Admin role (stored `admin` value).
 * Can create, read, and update projects, but cannot delete or archive them.
 */
const admin = accessControl.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
});

/**
 * Project Coordinator role (stored `coordinator` value).
 * Same project authority as the Organization Admin: create, read, and
 * update projects, but no delete or archive.
 */
const coordinator = accessControl.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
});

/**
 * Participant role (stored `participant` value).
 * Can only read projects within their organization.
 */
const participant = accessControl.newRole({
  ...memberAc.statements,
  project: ["read"], // Participants can only read projects
});

/**
 * Calculator role map in descending hierarchy order, keyed by stored value.
 */
export const calculatorRoles = {
  [ORGANIZATION_ROLES.OrganizationOwner]: owner,
  [ORGANIZATION_ROLES.OrganizationAdmin]: admin,
  [ORGANIZATION_ROLES.ProjectCoordinator]: coordinator,
  [ORGANIZATION_ROLES.Participant]: participant,
};

/**
 * Export types for use throughout the application.
 */
export type ProjectPermission = (typeof statement)["project"][number];

export type { OrganizationRole };
