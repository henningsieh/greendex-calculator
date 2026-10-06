import { ORGANIZATION_ROLES } from "@greendex/config/organization-roles";
import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";

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

export const calculatorCoordinatorRole = accessControl.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
});

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
  [ORGANIZATION_ROLES.ProjectCoordinator]: calculatorCoordinatorRole,
  [ORGANIZATION_ROLES.Participant]: projectParticipant,
};

export const costTrackerOrganizationRoles = {
  [ORGANIZATION_ROLES.OrganizationOwner]: organisationOwner,
  [ORGANIZATION_ROLES.OrganizationAdmin]: organizationAdmin,
  [ORGANIZATION_ROLES.ProjectCoordinator]: projectCoordinatorRole,
  [ORGANIZATION_ROLES.Participant]: projectParticipant,
};

export type ProjectPermission = (typeof statement)["project"][number];
export type ProjectPartnershipPermission =
  (typeof statement)["projectPartnership"][number];
export type ProjectParticipationPermission =
  (typeof statement)["projectParticipation"][number];

export {
  addOrganizationRole,
  assertRoleMapCoversRoles,
  hasOrganizationRole,
  isValidOrganizationRole,
  parseOrganizationRoles,
} from "./organization-roles";
