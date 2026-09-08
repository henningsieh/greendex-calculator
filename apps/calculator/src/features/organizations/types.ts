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
 * Organization member role definitions
 * Maps display names to database role values
 */
export const MEMBER_ROLES = {
  OrganizationAdministrator: "owner",
  ProjectCoordinator: "admin",
  Participant: "member",
} as const;

/**
 * Type for member role values
 */
export type MemberRole = (typeof MEMBER_ROLES)[keyof typeof MEMBER_ROLES];

/**
 * Type for member sort field values - inferred from database schema
 */
export type MemberSortField = (typeof USERS_SORT_FIELDS)[number];
