import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const ORGANIZATION_ROLES = {
  OrganizationOwner: "owner",
  ProjectCoordinator: "coordinator",
  OrganizationAdmin: "admin",
  Participant: "participant",
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

export const organisationOwner = accessControl.newRole({
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

// Organization Admin keeps the existing admin permission statements; its definition
// name is distinct from Calculator's legacy admin meaning, not a new stored role.
export const organizationAdmin = accessControl.newRole({
  ...legacyCalculatorAdminRole.statements,
});

// Assignment-bound Cost Tracker procedures grant coordination. The role alone
// grants no broad access: it may bring participants into one assigned Project
// Partnership (ADR-0015), and nothing else without an assignment.
export const projectCoordinatorRole = accessControl.newRole({
  ...memberAc.statements,
  projectParticipation: ["create"],
});

export const calculatorCoordinatorRole = accessControl.newRole({});

export const projectParticipant = accessControl.newRole({
  ...memberAc.statements,
  project: ["read"],
  projectParticipation: ["read", "update"],
});

export const organizationRoles = {
  organisationOwner,
  organizationAdmin,
  projectParticipant,
};

export const calculatorOrganizationRoles = {
  [ORGANIZATION_ROLES.OrganizationOwner]: organisationOwner,
  [ORGANIZATION_ROLES.OrganizationAdmin]: legacyCalculatorAdminRole,
  [ORGANIZATION_ROLES.Participant]: projectParticipant,
  [ORGANIZATION_ROLES.ProjectCoordinator]: calculatorCoordinatorRole,
};

export const costTrackerOrganizationRoles = {
  [ORGANIZATION_ROLES.OrganizationOwner]: organisationOwner,
  [ORGANIZATION_ROLES.OrganizationAdmin]: organizationAdmin,
  [ORGANIZATION_ROLES.Participant]: projectParticipant,
  [ORGANIZATION_ROLES.ProjectCoordinator]: projectCoordinatorRole,
};

/** Reject omitted defaults and unknown roles, including in combined Memberships. */
export function isValidOrganizationRole(role: string | null | undefined): boolean {
  if (!role) return false;
  const knownRoles = new Set<string>(Object.values(ORGANIZATION_ROLES));
  return role.split(",").every((value) => knownRoles.has(value.trim()));
}

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
