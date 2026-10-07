export const ORGANIZATION_ROLES = {
  OrganizationOwner: "owner",
  OrganizationAdmin: "admin",
  ProjectCoordinator: "coordinator",
  Participant: "participant",
} as const;

export type OrganizationRole =
  (typeof ORGANIZATION_ROLES)[keyof typeof ORGANIZATION_ROLES];
