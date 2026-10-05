export const ORGANIZATION_ROLES = {
  OrganizationOwner: "owner",
  ProjectCoordinator: "coordinator",
  OrganizationAdmin: "admin",
  Participant: "participant",
} as const;

export type OrganizationRole =
  (typeof ORGANIZATION_ROLES)[keyof typeof ORGANIZATION_ROLES];
