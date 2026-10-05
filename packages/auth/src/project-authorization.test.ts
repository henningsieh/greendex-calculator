import { ORGANIZATION_ROLES } from "./permissions";
import { describe, expect, it } from "vitest";

import { costTrackerOrganizationRoles } from "./permissions";
import {
  PROJECT_PARTICIPATION_CREATE,
  evaluateProjectScopeAccess,
  type ProjectScopeFacts,
} from "./project-authorization";

const partnerOrganizationId = "partner-organization";
const hostOrganizationId = "host-organization";

/**
 * Mirrors Better Auth's supported server check: the active Membership's stored
 * role, comma separated, resolved against the single-sourced role definitions.
 */
function mayCreateParticipation(role: string | null | undefined): boolean {
  if (!role) return false;
  return role
    .split(",")
    .map((value) => value.trim())
    .some(
      (value) =>
        value in costTrackerOrganizationRoles &&
        costTrackerOrganizationRoles[
          value as keyof typeof costTrackerOrganizationRoles
        ].authorize(PROJECT_PARTICIPATION_CREATE).success,
    );
}

function decide(overrides: Partial<ProjectScopeFacts> = {}) {
  const facts: ProjectScopeFacts = {
    role: ORGANIZATION_ROLES.OrganizationOwner,
    activeOrganizationId: partnerOrganizationId,
    partnerOrganizationId,
    hostOrganizationId,
    assignedCoordinator: false,
    mayCreateParticipation: false,
    ...overrides,
  };
  return evaluateProjectScopeAccess({
    ...facts,
    mayCreateParticipation: mayCreateParticipation(facts.role),
  });
}

describe("project scope authorization", () => {
  it("permits Partner Organization owners and admins without an assignment", () => {
    expect(decide({ role: ORGANIZATION_ROLES.OrganizationOwner })).toEqual({ permitted: true });
    expect(decide({ role: ORGANIZATION_ROLES.OrganizationAdmin })).toEqual({ permitted: true });
  });

  it("permits only assigned Partner Group Organizers", () => {
    expect(
      decide({ role: ORGANIZATION_ROLES.ProjectCoordinator, assignedCoordinator: true }),
    ).toEqual({ permitted: true });
    expect(
      decide({ role: ORGANIZATION_ROLES.ProjectCoordinator, assignedCoordinator: false }),
    ).toEqual({ permitted: false, reason: "ASSIGNMENT_MISSING" });
  });

  it("keeps coexisting roles so a combined role is permitted", () => {
    expect(decide({ role: `${ORGANIZATION_ROLES.OrganizationOwner},${ORGANIZATION_ROLES.Participant}` })).toEqual({ permitted: true });
    expect(
      decide({ role: `${ORGANIZATION_ROLES.OrganizationAdmin},${ORGANIZATION_ROLES.ProjectCoordinator}`, assignedCoordinator: true }),
    ).toEqual({ permitted: true });
    expect(decide({ role: `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}` })).toEqual({
      permitted: false,
      reason: "ASSIGNMENT_MISSING",
    });
    expect(
      decide({
        role: `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
        assignedCoordinator: true,
      }),
    ).toEqual({ permitted: true });
  });

  it("denies Participants and roles without the participation permission", () => {
    expect(decide({ role: ORGANIZATION_ROLES.Participant })).toEqual({
      permitted: false,
      reason: "PERMISSION_MISSING",
    });
  });

  it("denies the Hosting Organization, unrelated Organizations and a missing active Organization", () => {
    expect(decide({ activeOrganizationId: hostOrganizationId })).toEqual({
      permitted: false,
      reason: "HOSTING_SIDE",
    });
    expect(
      decide({
        activeOrganizationId: hostOrganizationId,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        assignedCoordinator: true,
      }),
    ).toEqual({ permitted: false, reason: "HOSTING_SIDE" });
    expect(decide({ activeOrganizationId: "unrelated-organization" })).toEqual({
      permitted: false,
      reason: "UNRELATED_ORGANIZATION",
    });
    expect(decide({ activeOrganizationId: null })).toEqual({
      permitted: false,
      reason: "MISSING_ACTIVE_ORGANIZATION",
    });
  });

  it("fails closed without an active Membership or a known Partner Organization", () => {
    expect(decide({ role: null })).toEqual({
      permitted: false,
      reason: "MISSING_MEMBERSHIP",
    });
    expect(decide({ role: "" })).toEqual({
      permitted: false,
      reason: "MISSING_MEMBERSHIP",
    });
    expect(decide({ partnerOrganizationId: null })).toEqual({
      permitted: false,
      reason: "UNRELATED_ORGANIZATION",
    });
  });
});
