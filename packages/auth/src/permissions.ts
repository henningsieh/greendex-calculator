import {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";
import {
  createAccessControl,
  type RoleStatements,
} from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

import { parseOrganizationRoles } from "./organization-roles";

export {
  ORGANIZATION_ROLES,
  type OrganizationRole,
} from "@greendex/config/organization-roles";

const lifecycleActions = ["archive", "reopen"] as const;

const statement = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
  calculatorProjectLifecycle: lifecycleActions,
  costTrackerProjectLifecycle: lifecycleActions,
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
} as const;

export const accessControl = createAccessControl(statement);

export const projectLifecyclePolicy = {
  calculatorProjectLifecycle: {
    [ORGANIZATION_ROLES.OrganizationOwner]: {
      archive: "organization",
      reopen: "organization",
    },
    [ORGANIZATION_ROLES.OrganizationAdmin]: {
      archive: "assigned",
      reopen: "assigned",
    },
  },
  costTrackerProjectLifecycle: {
    [ORGANIZATION_ROLES.OrganizationOwner]: {
      archive: "organization",
      reopen: "organization",
    },
    [ORGANIZATION_ROLES.OrganizationAdmin]: {
      archive: "organization",
      reopen: "organization",
    },
    [ORGANIZATION_ROLES.ProjectCoordinator]: { archive: "assigned" },
  },
} as const satisfies {
  readonly [Resource in keyof RoleStatements<typeof statement>]?: {
    readonly [Role in OrganizationRole]?: {
      readonly [
        Action in NonNullable<RoleStatements<typeof statement>[Resource]>[number]
      ]?: string;
    };
  };
};

export type ProjectLifecycleResource = keyof typeof projectLifecyclePolicy;
export type ProjectLifecyclePermission =
  (typeof accessControl.statements)[ProjectLifecycleResource][number];

function projectLifecycleActions(
  resource: ProjectLifecycleResource,
  role: OrganizationRole,
) {
  const grants = Object.entries(projectLifecyclePolicy[resource]).find(
    ([key]) => key === role,
  )?.[1];
  return accessControl.statements[resource].filter(
    (action) => grants && Object.hasOwn(grants, action),
  );
}

export function projectLifecycleScope(
  resource: ProjectLifecycleResource,
  role: string,
  action: ProjectLifecyclePermission,
) {
  const scopes = parseOrganizationRoles(role).flatMap((recognizedRole) => {
    const grants = Object.entries(projectLifecyclePolicy[resource]).find(
      ([key]) => key === recognizedRole,
    )?.[1];
    return grants
      ? Object.entries(grants)
          .filter(([key]) => key === action)
          .map(([, scope]) => scope)
      : [];
  });
  return scopes.includes("organization")
    ? "organization"
    : scopes.find((scope) => scope === "assigned");
}

export const organisationOwner = accessControl.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete"],
  costTrackerProjectLifecycle: projectLifecycleActions(
    "costTrackerProjectLifecycle",
    ORGANIZATION_ROLES.OrganizationOwner,
  ),
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
});

export const legacyCalculatorAdminRole = accessControl.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
  calculatorProjectLifecycle: projectLifecycleActions(
    "calculatorProjectLifecycle",
    ORGANIZATION_ROLES.OrganizationAdmin,
  ),
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
});

export const calculatorOwnerRole = accessControl.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete"],
  calculatorProjectLifecycle: projectLifecycleActions(
    "calculatorProjectLifecycle",
    ORGANIZATION_ROLES.OrganizationOwner,
  ),
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
});

// Organization Admin keeps the existing admin permission statements; its definition
// name is distinct from Calculator's legacy admin meaning, not a new stored role.
export const organizationAdmin = accessControl.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
  projectPartnership: ["create", "read", "update", "delete"],
  projectParticipation: ["create", "read", "update", "merge"],
  costTrackerProjectLifecycle: projectLifecycleActions(
    "costTrackerProjectLifecycle",
    ORGANIZATION_ROLES.OrganizationAdmin,
  ),
});

// Assignment-bound Cost Tracker procedures grant coordination. The role alone
// grants no broad access: it may bring participants into one assigned Project
// Partnership (ADR-0015), and nothing else without an assignment.
export const projectCoordinatorRole = accessControl.newRole({
  ...memberAc.statements,
  projectParticipation: ["create"],
  costTrackerProjectLifecycle: projectLifecycleActions(
    "costTrackerProjectLifecycle",
    ORGANIZATION_ROLES.ProjectCoordinator,
  ),
});

export const calculatorCoordinatorRole = accessControl.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update"],
  calculatorProjectLifecycle: projectLifecycleActions(
    "calculatorProjectLifecycle",
    ORGANIZATION_ROLES.ProjectCoordinator,
  ),
});

export const projectParticipant = accessControl.newRole({
  ...memberAc.statements,
  project: ["read"],
  projectParticipation: ["read", "update"],
});

const calculatorParticipantRole = accessControl.newRole({
  ...projectParticipant.statements,
  calculatorProjectLifecycle: projectLifecycleActions(
    "calculatorProjectLifecycle",
    ORGANIZATION_ROLES.Participant,
  ),
});
const costTrackerParticipantRole = accessControl.newRole({
  ...projectParticipant.statements,
  costTrackerProjectLifecycle: projectLifecycleActions(
    "costTrackerProjectLifecycle",
    ORGANIZATION_ROLES.Participant,
  ),
});

export const organizationRoles = {
  organisationOwner,
  organizationAdmin,
  projectParticipant,
};

export const calculatorOrganizationRoles = {
  [ORGANIZATION_ROLES.OrganizationOwner]: calculatorOwnerRole,
  [ORGANIZATION_ROLES.OrganizationAdmin]: legacyCalculatorAdminRole,
  [ORGANIZATION_ROLES.ProjectCoordinator]: calculatorCoordinatorRole,
  [ORGANIZATION_ROLES.Participant]: calculatorParticipantRole,
};

export const costTrackerOrganizationRoles = {
  [ORGANIZATION_ROLES.OrganizationOwner]: organisationOwner,
  [ORGANIZATION_ROLES.OrganizationAdmin]: organizationAdmin,
  [ORGANIZATION_ROLES.ProjectCoordinator]: projectCoordinatorRole,
  [ORGANIZATION_ROLES.Participant]: costTrackerParticipantRole,
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
