/**
 * Better Auth Custom Permissions for Projects
 *
 * This file defines the access control structure for projects within organizations.
 * Projects are resources that belong to organizations, and access is controlled
 * through organization membership roles.
 */

import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

/**
 * Define all available actions for the project resource
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
 * Create the access controller with our custom statement
 */
export const ac = createAccessControl(statement);

/**
 * Organization Owner role (stored `owner` value)
 * - Full control over all resources including projects
 * - Can create, read, update, delete, and archive projects
 * - Inherits all default owner permissions
 */
export const owner = ac.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete", "archive"],
});

/**
 * Organization Admin role (stored `admin` value)
 * - Can manage projects and most organization resources
 * - Can create, read, and update projects
 * - Can archive projects they are responsible for (dynamic permission)
 * - Cannot delete projects (reserved for Organization Administrators)
 * - Inherits all default admin permissions
 */
export const admin = ac.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
});

/**
 * Project Coordinator role (stored `coordinator` value)
 * - Same project authority the Calculator previously granted its `admin`
 *   value: create, read, and update projects, but no delete or archive
 * - Inherits all default admin permissions
 */
export const coordinator = ac.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
});

/**
 * Participant role (stored `participant` value)
 * - Can only read projects within their organization
 * - Cannot create, update, delete, or archive projects
 */
export const participant = ac.newRole({
  ...memberAc.statements,
  project: ["read"], // Participants can only read projects
});

/**
 * Export types for use throughout the application
 */
export type ProjectPermission = (typeof statement)["project"][number];
