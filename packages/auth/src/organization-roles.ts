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
