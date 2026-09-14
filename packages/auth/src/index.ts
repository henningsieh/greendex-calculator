/**
 * @greendex/auth
 * Better Auth configuration and utilities
 *
 * This package provides the authentication setup.
 * The actual auth instance must be created in the app with app-specific config
 * (env variables, email handlers, etc.)
 */

export type { Session, User } from "better-auth/types";

export { createServerAuth, type ServerAuthConfig } from "./server-auth";

export {
  accessControl,
  addOrganizationRole,
  hasOrganizationRole,
  memberRole,
  ORGANIZATION_ROLES,
  organizationAdministratorRole,
  organizationRoles,
  parseOrganizationRoles,
  participantRole,
  projectCoordinatorRole,
  type OrganizationRole,
  type ProjectParticipationPermission,
  type ProjectPartnershipPermission,
  type ProjectPermission,
} from "./permissions";
