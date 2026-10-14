/** Read-only Invitation preconditions use a fixed far-future reference expiry,
 * never a rolling wall-clock TTL. Credential material is generated at runtime. */
export const SEED_READ_ONLY_INVITATION_EXPIRY = "9999-12-31T00:00:00.000Z";

export const SEED_ENTITY_SEARCH = {
  coordinatorUserId: "picker-coordinator-canonical",
  unassignedCoordinatorUserId: "picker-unassigned-coordinator-canonical",
  participantUserId: "picker-participant-canonical",
  ownedOrganizations: Array.from({ length: 55 }, (_, i) => ({
    id: `owned-result-${i}-canonical`,
    name: `Owned Search canonical ${i.toString().padStart(2, "0")}`,
  })),
  manyOrganizations: Array.from({ length: 1002 }, (_, i) => ({
    id: `picker-many-${i.toString().padStart(4, "0")}-canonical`,
    name: "Many Matches canonical",
  })),
};

export const SEED_REVIEW_SCENARIOS = {
  newestMembership: {
    userId: "auth-newest-membership-canonical",
    email: "auth-newest-membership-canonical@example.org",
    olderOrganizationId: "auth-older-organization-canonical",
    newestOrganizationId: "auth-newest-organization-canonical",
  },
  staffInvitations: {
    organizationId: "seed-staff-invites-org",
    causeEmail: "staff-invitation-cause@example.org",
    pendingEmail: "leaving@example.org",
    foreignEmail: "elsewhere@example.org",
    acceptedEmail: "accepted@example.org",
  },
  restProjects: [
    { id: "rest-contract-project-canonical", name: "REST Contract Project" },
    { id: "rest-batch-project-canonical", name: "REST Batch Project" },
  ],
  travelLegManagement: {
    projectId: "travel-leg-management-project-canonical",
    legId: "travel-leg-management-bus-canonical",
  },
  submittedRegistration: {
    projectId: "onboarding-submitted-project-canonical",
    partnershipId: "onboarding-submitted-partnership-canonical",
    linkId: "onboarding-submitted-link-canonical",
  },
} as const;
