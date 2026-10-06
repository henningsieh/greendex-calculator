import {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";

export {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";

/** Reject omitted defaults and unknown roles, including in combined Memberships. */
export function isValidOrganizationRole(
  role: string | null | undefined,
): boolean {
  if (!role) return false;
  const knownRoles = new Set<string>(Object.values(ORGANIZATION_ROLES));
  return role.split(",").every((value) => knownRoles.has(value.trim()));
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
