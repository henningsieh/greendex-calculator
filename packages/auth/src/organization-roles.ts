import {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";
import { z } from "zod";

export {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";

/**
 * Canonical role schema: the single definition of valid roles.
 * Validation and inferred types derive from here, never from copies.
 */
export const OrganizationRoleSchema = z.enum([
  ORGANIZATION_ROLES.OrganizationOwner,
  ORGANIZATION_ROLES.OrganizationAdmin,
  ORGANIZATION_ROLES.ProjectCoordinator,
  ORGANIZATION_ROLES.Participant,
]);

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

// Compile-time proof the schema infers exactly the canonical role type,
// so the two can never drift apart.
const _schemaMatchesType: Equals<
  z.infer<typeof OrganizationRoleSchema>,
  OrganizationRole
> = true;

/** Stored membership values: comma-separated roles, same schema family. */
const OrganizationRoleListSchema = z
  .string()
  .transform((value) => value.split(",").map((part) => part.trim()))
  .pipe(z.array(OrganizationRoleSchema).min(1));

/** Reject omitted defaults and unknown roles, including in combined Memberships. */
export function isValidOrganizationRole(
  role: string | null | undefined,
): boolean {
  return OrganizationRoleListSchema.safeParse(role).success;
}

export function parseOrganizationRoles(role: string): OrganizationRole[] {
  const knownRoles = new Set<string>(Object.values(ORGANIZATION_ROLES));

  return role
    .split(",")
    .map((value) => value.trim())
    .filter(
      (value): value is OrganizationRole =>
        value.length > 0 && knownRoles.has(value),
    );
}

export function addOrganizationRole(
  role: string,
  addedRole: OrganizationRole,
): string {
  const roles = role
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (!roles.includes(addedRole)) roles.push(addedRole);

  return roles.join(",");
}

export function hasOrganizationRole(
  role: string,
  expectedRole: OrganizationRole,
): boolean {
  return parseOrganizationRoles(role).includes(expectedRole);
}

/**
 * Descending role hierarchy by stored value: owner > admin > coordinator
 * > participant. Per-app Better Auth role maps must follow this key order.
 */
const DESCENDING_ROLE_KEY_ORDER = [
  ORGANIZATION_ROLES.OrganizationOwner,
  ORGANIZATION_ROLES.OrganizationAdmin,
  ORGANIZATION_ROLES.ProjectCoordinator,
  ORGANIZATION_ROLES.Participant,
] as const;

/**
 * Structural contract for per-app Better Auth role maps (Calculator,
 * Cost Tracker, ...). Asserts the map covers exactly the shared role
 * values, in descending hierarchy order. Statements stay app-owned;
 * this guards structure only, so each app wires it with its own map.
 */
export function assertRoleMapCoversRoles(roleMap: Record<string, unknown>): void {
  const keys = Object.keys(roleMap);
  const expected = [...DESCENDING_ROLE_KEY_ORDER];
  if (
    keys.length !== expected.length ||
    !keys.every((key, index) => key === expected[index])
  ) {
    throw new Error(
      `Role map must cover exactly [${expected.join(", ")}] in order, found [${keys.join(", ")}].`,
    );
  }
}
