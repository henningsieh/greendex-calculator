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
  costTrackerOrganizationRoles,
  calculatorOrganizationRoles,
  legacyCalculatorAdminRole,
  calculatorCoordinatorRole,
  isValidOrganizationRole,
  hasOrganizationRole,
  ORGANIZATION_ROLES,
  organisationOwner,
  organizationAdmin,
  organizationRoles,
  parseOrganizationRoles,
  projectParticipant,
  projectCoordinatorRole,
  type OrganizationRole,
  type ProjectParticipationPermission,
  type ProjectPartnershipPermission,
  type ProjectPermission,
} from "./permissions";

export { assertRoleMapCoversRoles } from "./organization-roles";
