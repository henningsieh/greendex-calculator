import {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/auth/organization-roles";
import { member, user } from "@greendex/database/schema";

/**
 * Organization Configuration
 * Single source of truth for organization roles and member sorting
 */

/**
 * Type-safe sort fields inferred from Drizzle database schema
 * Only allows actual database fields from member and user tables
 */
type MemberColumns = keyof typeof member.$inferSelect;
type UserColumns = keyof typeof user.$inferSelect;
type UsersSortField = MemberColumns | `user.${UserColumns}`;

/**
 * Valid sort fields for member search operations
 * Type-safe: Only allows actual database fields from member and user tables
 *
 * Direct member fields: "createdAt", "role"
 * Related user fields: "user.name", "user.email"
 */
export const USERS_SORT_FIELDS = [
  "createdAt", // member.createdAt
  "role", // member.role
  "user.name", // user.name (via userId relation)
  "user.email", // user.email (via userId relation)
] as const satisfies readonly UsersSortField[];

/**
 * Organization member role definitions.
 * Single-sourced from the shared @greendex/auth role contract so the
 * Calculator can never drift from the canonical database role values.
 */
export const MEMBER_ROLES = ORGANIZATION_ROLES;

/**
 * Type for member role values
 */
export type MemberRole = (typeof MEMBER_ROLES)[keyof typeof MEMBER_ROLES];

const calculatorRolePriority = [
  MEMBER_ROLES.OrganizationOwner,
  MEMBER_ROLES.OrganizationAdmin,
  MEMBER_ROLES.ProjectCoordinator,
  MEMBER_ROLES.Participant,
] as const;

type HierarchyRole = (typeof calculatorRolePriority)[number];

// Compile-time proof the priority list covers every known role value.
// Adding a role to ORGANIZATION_ROLES without placing it here fails the build.
const _noMissingRoles: Exclude<OrganizationRole, HierarchyRole> extends never
  ? true
  : never = true;

/**
 * Reduce a stored (possibly combined) membership role to the Calculator's
 * role contract. Unknown values yield null so callers fail closed.
 */
export function canonicalCalculatorRole(storedRole: string): MemberRole | null {
  const roles = storedRole.split(",").map((role) => role.trim());
  return calculatorRolePriority.find((role) => roles.includes(role)) ?? null;
}

/**
 * Type for member sort field values - inferred from database schema
 */
export type MemberSortField = (typeof USERS_SORT_FIELDS)[number];
