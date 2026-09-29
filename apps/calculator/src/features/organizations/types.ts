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
 *
 * NOTE: `ProjectCoordinator: "admin"` is a legacy Calculator mapping and does
 * NOT mean the same as Cost Tracker's assignment-scoped `project-coordinator`
 * role (one explicit Project/Partnership assignment, no Organization-wide
 * authority). Same word, different role per app — see the backlog todo to
 * rename the Calculator key and stop the confusion.
 */
export const MEMBER_ROLES = {
  OrganizationAdministrator: "owner",
  ProjectCoordinator: "admin",
  Participant: "participant",
  Member: "member",
} as const;

/**
 * Type for member role values
 */
export type MemberRole = (typeof MEMBER_ROLES)[keyof typeof MEMBER_ROLES];

const calculatorRolePriority: MemberRole[] = [
  "owner",
  "admin",
  "member",
  "participant",
];

/** Ignore Cost Tracker's appended coordinator role at Calculator's display/API boundary. */
export function canonicalCalculatorRole(storedRole: string): MemberRole | null {
  const roles = storedRole.split(",").map((role) => role.trim());
  return calculatorRolePriority.find((role) => roles.includes(role)) ?? null;
}

/**
 * Type for member sort field values - inferred from database schema
 */
export type MemberSortField = (typeof USERS_SORT_FIELDS)[number];
