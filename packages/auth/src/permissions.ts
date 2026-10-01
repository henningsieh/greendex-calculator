import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const ORGANIZATION_ROLES = {
  OrganizationAdministrator: "owner",
  ProjectCoordinator: "project-coordinator",
  OrganizationAdmin: "admin",
  Participant: "participant",
  Member: "member",
} as const;

export type OrganizationRole =
  (typeof ORGANIZATION_ROLES)[keyof typeof ORGANIZATION_ROLES];

const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete", "archive"],
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
} as const;

export const accessControl = createAccessControl(statement);

export const organizationAdministratorRole = accessControl.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete", "archive"],
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
});

export const legacyCalculatorAdminRole = accessControl.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update", "archive"],
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
});

// Assignment-bound Cost Tracker procedures grant coordination. The role alone grants no broad access.
export const projectCoordinatorRole = accessControl.newRole({
  ...memberAc.statements,
});

export const legacyCalculatorMemberRole = accessControl.newRole({
  ...memberAc.statements,
});

export const projectParticipantRole = accessControl.newRole({
  ...memberAc.statements,
  project: ["read"],
  projectParticipation: ["read", "update"],
});

export const organizationRoles = {
  // Legacy roles retained for Calculator. The bare member role is forbidden in
  // Cost Tracker, which drops it via its runtime role map and ban hooks.
  // Any future Calculator role adaptation must confront these legacy entries.
  admin: legacyCalculatorAdminRole,
  member: legacyCalculatorMemberRole,

  // Domain-named role definitions; these keys are not persisted role values.
  organisationAdmin: organizationAdministratorRole,
  projectParticipant: projectParticipantRole,
};

// Better Auth's creatorRole and existing rows use owner/participant. Resolve the
// domain-named definitions to those unchanged runtime keys: no authority or data
// migration is implied by renaming the definition map.
export const calculatorOrganizationRoles = {
  owner: organizationRoles.organisationAdmin,
  admin: organizationRoles.admin,
  member: organizationRoles.member,
  participant: organizationRoles.projectParticipant,
};

export const costTrackerOrganizationRoles = {
  owner: organizationRoles.organisationAdmin,
  admin: organizationRoles.admin,
  participant: organizationRoles.projectParticipant,
  "project-coordinator": projectCoordinatorRole,
};

export type ProjectPermission = (typeof statement)["project"][number];
export type ProjectPartnershipPermission =
  (typeof statement)["projectPartnership"][number];
export type ProjectParticipationPermission =
  (typeof statement)["projectParticipation"][number];

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
