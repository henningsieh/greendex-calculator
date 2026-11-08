import { createHash, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import {
  hostProjectAssignmentsTable as hostAssignments,
  claimsTable as claims,
  claimHistoryTable as history,
  costAllocationsTable as allocations,
  partnershipPayoutAccountsTable as selections,
  travelCostEntriesTable as entries,
  participantAgreementAcceptancesTable as acceptances,
  participantEntryTokensTable as entryTokens,
  participantProfilesTable as profiles,
  participantJourneysTable as journeys,
  member,
  organization,
  partnerCoordinatorAssignmentsTable as assignments,
  payoutAccountsTable as accounts,
  proofDocumentsTable as documents,
  projectPartnerOrganizationsTable as partnerships,
  projectParticipantsTable as participants,
  projectsTable as projects,
  user,
} from "@greendex/database/schema";
import { createId } from "@paralleldrive/cuid2";

import type { SeedDatabase } from "./seed";
import { SEED_IDS } from "./seed-ids";
import {
  SEED_ENTITY_SEARCH,
  SEED_READ_ONLY_INVITATION_EXPIRY,
} from "./seed-scenarios";
import {
  ensureSeedUsers,
  ensureSeedOrganizations,
  ensureSeedMemberships,
  ensureSeedProjects,
  ensureSeedHostAssignments,
  ensureSeedPartnerships,
  ensureSeedPartnerAssignments,
  ensureSeedPayoutAccounts,
  ensureSeedClaims,
  ensureSeedParticipations,
  ensureSeedProofDocuments,
  ensureSeedTravelCostEntries,
  ensureSeedCostAllocations,
  ensureSeedProfiles,
  ensureSeedAgreementAcceptances,
  ensureSeedEntryTokens,
  ensureSeedClaimsByPartnership,
  ensureSeedJourneysByParticipation,
  ensureSeedPayoutSelections,
  ensureSeedClaimHistory,
} from "./seed-tables";

export const SUBMISSION_PAYOUT_ACCOUNT_IDS = [
  SEED_IDS.payoutAccount.submissionPayoutAccount0,
  SEED_IDS.payoutAccount.submissionPayoutAccount1,
] as const;

/** Cost Tracker's seed scenarios. Domain dates use the fixed 2024 reference
 * calendar; metadata is run-anchored. Inserts converge without overwriting
 * developer changes. Proof Documents are synthetic metadata for mocked storage
 * coverage: seeding never writes a remote object. */
async function ensureClaimScenarios(db: SeedDatabase): Promise<void> {
  // Claims: named Partner authorization and payout scenarios.
  {
    const host = SEED_IDS.organization.claimHost;
    const partner = SEED_IDS.organization.claimPartner;
    const other = SEED_IDS.organization.claimOther;
    const coordinator = SEED_IDS.user.claimCoordinator;
    const participant = SEED_IDS.user.claimParticipant;
    const owner = SEED_IDS.user.claimOwner;
    const project = SEED_IDS.project.claimProject3;
    const own = SEED_IDS.partnership.claimOwn;
    const foreign = SEED_IDS.partnership.claimForeign;
    const account = SEED_IDS.payoutAccount.claimAccount;
    const secondAccount = SEED_IDS.payoutAccount.claimSecondAccount;
    const foreignAccount = SEED_IDS.payoutAccount.claimForeignAccount;

    const now = new Date();
    {
      const rows = [
        {
          id: coordinator,
          name: "Coordinator",
          email: `${coordinator}@example.org`,
          emailVerified: true,
        },
        {
          id: participant,
          name: "Participant",
          email: `${participant}@example.org`,
          emailVerified: true,
        },
        {
          id: owner,
          name: "Seed Claim Owner",
          email: `${owner}@example.org`,
          emailVerified: true,
        },
      ] satisfies (typeof user.$inferInsert)[];
      await ensureSeedUsers(db, rows);
    }
    {
      const rows = [
        {
          country: "DE",
          id: host,
          name: "Seed Claim Hosting Organization",
          slug: host,
          createdAt: now,
        },
        {
          country: "DE",
          id: partner,
          name: "Seed Claim Partner Organization",
          slug: partner,
          createdAt: now,
        },
        {
          country: "DE",
          id: other,
          name: "Seed Foreign Claim Organization",
          slug: other,
          createdAt: now,
        },
      ] satisfies (typeof organization.$inferInsert)[];
      await ensureSeedOrganizations(db, rows);
    }
    {
      const rows = [
        {
          id: createId(),
          userId: coordinator,
          organizationId: partner,
          role: ORGANIZATION_ROLES.ProjectCoordinator,
          createdAt: now,
        },
        {
          id: createId(),
          userId: coordinator,
          organizationId: host,
          role: ORGANIZATION_ROLES.ProjectCoordinator,
          createdAt: now,
        },
        {
          id: createId(),
          userId: participant,
          organizationId: host,
          role: ORGANIZATION_ROLES.ProjectCoordinator,
          createdAt: now,
        },
        {
          id: createId(),
          userId: participant,
          organizationId: partner,
          role: ORGANIZATION_ROLES.Participant,
          createdAt: now,
        },
        ...[host, partner].map((organizationId) => ({
          id: createId(),
          userId: owner,
          organizationId,
          role: ORGANIZATION_ROLES.OrganizationOwner,
          createdAt: now,
        })),
      ] satisfies (typeof member.$inferInsert)[];
      await ensureSeedMemberships(db, rows);
    }
    {
      const rows = [
        {
          id: project,
          name: "Seed Claim Project",
          startDate: new Date("2024-04-01T00:00:00.000Z"),
          endDate: new Date("2024-04-03T00:00:00.000Z"),
          location: "Riga",
          country: "LV",
          organizationId: host,
        },
      ] satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    {
      const rows = [
        {
          id: account,
          organizationId: partner,
          accountHolder: "Partner",
          iban: "DE89370400440532013000",
        },
        {
          id: secondAccount,
          organizationId: partner,
          accountHolder: "Partner",
          iban: "GB82WEST12345698765432",
        },
        {
          id: foreignAccount,
          organizationId: other,
          accountHolder: "Other",
          iban: "FR1420041010050500013M02606",
        },
      ] satisfies (typeof accounts.$inferInsert)[];
      await ensureSeedPayoutAccounts(db, rows);
    }
  }
  // Read-only Claim refusal states have their own Projects and Partnerships.
  const claimScenarioIds = [
    {
      project: SEED_IDS.project.claimProject0,
      partnership: SEED_IDS.partnership.claimsEditablePartnership,
      state: SEED_IDS.claim.claimState0,
    }, // editable
    {
      project: SEED_IDS.project.claimProject2,
      partnership: SEED_IDS.partnership.claimsSubmittedPartnership,
      state: SEED_IDS.claim.claimState2,
    }, // submitted
    {
      project: SEED_IDS.project.claimProject1,
      partnership: SEED_IDS.partnership.claimsSubmittedSelectedPartnership,
      state: SEED_IDS.claim.claimState1,
    }, // submitted-selected
  ] as const;
  const claimScenarios = ["editable", "submitted", "submitted-selected"] as const;
  for (const [stateIndex, state] of claimScenarios.entries()) {
    const status = state === "editable" ? "editable" : "submitted";
    const { project: projectId, partnership: partnershipId } =
      claimScenarioIds[stateIndex]!;
    {
      const rows = [
        {
          id: projectId,
          name:
            state === "editable"
              ? "Seed Editable Claim Project"
              : state === "submitted"
                ? "Seed Submitted Claim Project"
                : "Seed Submitted Selected Claim Project",
          organizationId: SEED_IDS.organization.claimHost,
          startDate: new Date("2024-04-01"),
          endDate: new Date("2024-04-03"),
          location: "Riga",
          country: "LV",
        },
      ] satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        { projectId, userId: SEED_IDS.user.claimCoordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        {
          id: partnershipId,
          projectId,
          organizationId: SEED_IDS.organization.claimPartner,
        },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId, userId: SEED_IDS.user.claimCoordinator },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    {
      const { state: stateId } = claimScenarioIds[stateIndex]!;
      const rows = [
        { id: stateId, partnershipId, status },
      ] satisfies (typeof claims.$inferInsert)[];
      await ensureSeedClaims(db, rows);
    }
    if (state === "submitted-selected") {
      const selected = await db.select().from(selections);
      if (!selected.some((row) => row.partnershipId === partnershipId)) {
        await db
          .insert(selections)
          .values({
            partnershipId,
            payoutAccountId: SEED_IDS.payoutAccount.claimSecondAccount,
          })
          .onConflictDoNothing();
      }
    }
  }
}

async function ensureCostScenarios(db: SeedDatabase): Promise<void> {
  // Costs: named Partner authorization and allocation scenarios.
  {
    const host = SEED_IDS.organization.costHost,
      partner = SEED_IDS.organization.costPartner,
      other = SEED_IDS.organization.costOther;
    const coordinator = SEED_IDS.user.costCoordinator,
      participantUser = SEED_IDS.user.costParticipantUser;
    const project = SEED_IDS.project.costProject,
      secondProject = SEED_IDS.project.costSecondProject;
    const own = SEED_IDS.partnership.costOwn,
      foreign = SEED_IDS.partnership.costForeign,
      next = SEED_IDS.partnership.costNext;
    const first = SEED_IDS.participation.costFirst,
      second = SEED_IDS.participation.costSecond,
      third = SEED_IDS.participation.costThird;
    const outside = SEED_IDS.participation.costOutside,
      later = SEED_IDS.participation.costLater;
    const ownClaim = SEED_IDS.claim.costOwnClaim,
      foreignClaim = SEED_IDS.claim.costForeignClaim;
    const proof = SEED_IDS.proofDocument.costProof,
      foreignProof = SEED_IDS.proofDocument.costForeignProof;

    const now = new Date();
    {
      const rows = [
        {
          id: coordinator,
          name: "Coordinator",
          email: `${coordinator}@example.org`,
          emailVerified: true,
        },
        {
          id: participantUser,
          name: "Participant",
          email: `${participantUser}@example.org`,
          emailVerified: true,
        },
      ] satisfies (typeof user.$inferInsert)[];
      await ensureSeedUsers(db, rows);
    }
    {
      const rows = [
        {
          country: "DE",
          id: host,
          name: "Seed Cost Hosting Organization",
          slug: host,
          createdAt: now,
        },
        {
          country: "DE",
          id: partner,
          name: "Seed Cost Partner Organization",
          slug: partner,
          createdAt: now,
        },
        {
          country: "DE",
          id: other,
          name: "Seed Foreign Cost Organization",
          slug: other,
          createdAt: now,
        },
      ] satisfies (typeof organization.$inferInsert)[];
      await ensureSeedOrganizations(db, rows);
    }
    {
      const rows = [
        {
          id: createId(),
          userId: coordinator,
          organizationId: partner,
          role: ORGANIZATION_ROLES.ProjectCoordinator,
          createdAt: now,
        },
        {
          id: createId(),
          userId: participantUser,
          organizationId: partner,
          role: ORGANIZATION_ROLES.Participant,
          createdAt: now,
        },
      ] satisfies (typeof member.$inferInsert)[];
      await ensureSeedMemberships(db, rows);
    }
    {
      const rows = [project, secondProject].map((projectId) => ({
        id: projectId,
        name:
          projectId === project
            ? "Seed Cost Project"
            : "Seed Second Cost Project",
        startDate: new Date("2024-04-01T00:00:00.000Z"),
        endDate: new Date("2024-04-03T00:00:00.000Z"),
        location: "Riga",
        country: "LV" as const,
        organizationId: host,
      })) satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
        { id: next, projectId: secondProject, organizationId: partner },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
        { partnershipId: next, userId: coordinator },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    {
      const rows = [
        ...[first, second, third].map((participantId) => ({
          id: participantId,
          projectId: project,
          representedOrganizationId: partner,
          displayName: participantId,
        })),
        {
          id: outside,
          projectId: project,
          representedOrganizationId: other,
          displayName: "Outside",
        },
        {
          id: later,
          projectId: secondProject,
          representedOrganizationId: partner,
          displayName: "Later",
        },
      ] satisfies (typeof participants.$inferInsert)[];
      await ensureSeedParticipations(db, rows);
    }
    {
      const rows = [
        { id: ownClaim, partnershipId: own },
        { id: foreignClaim, partnershipId: foreign },
      ] satisfies (typeof claims.$inferInsert)[];
      await ensureSeedClaims(db, rows);
    }
    {
      const rows = [ownClaim, foreignClaim].map((claimId, index) => ({
        id: index === 0 ? proof : foreignProof,
        claimId,
        fileReference: `test/${claimId}`,
        originalFileName: "ticket.pdf",
        mediaType: "application/pdf",
        byteSize: 4,
        checksum: "test-checksum",
      })) satisfies (typeof documents.$inferInsert)[];
      await ensureSeedProofDocuments(db, rows);
    }
  }
}

async function ensureLockedCostScenario(db: SeedDatabase): Promise<void> {
  const projectId = SEED_IDS.project.lockedCostProjectId;
  const partnershipId = SEED_IDS.partnership.lockedCostPartnershipId;
  const claimId = SEED_IDS.claim.lockedCostClaimId;
  const participantId = SEED_IDS.participation.lockedCostParticipantId;
  const entryId = SEED_IDS.travelEntry.lockedCostEntryId;
  {
    const rows = [
      {
        id: projectId,
        name: "Seed Submitted Cost Project",
        organizationId: SEED_IDS.organization.costHost,
        startDate: new Date("2024-04-01"),
        endDate: new Date("2024-04-03"),
        location: "Riga",
        country: "LV",
      },
    ] satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [
      {
        id: partnershipId,
        projectId,
        organizationId: SEED_IDS.organization.costPartner,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId, userId: SEED_IDS.user.costCoordinator },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }
  {
    const rows = [
      { id: claimId, partnershipId, status: "submitted" },
    ] satisfies (typeof claims.$inferInsert)[];
    await ensureSeedClaims(db, rows);
  }
  {
    const rows = [
      {
        id: participantId,
        projectId,
        representedOrganizationId: SEED_IDS.organization.costPartner,
        displayName: "Submitted Cost Participant",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  {
    const rows = [
      {
        id: SEED_IDS.proofDocument.costsSubmittedProofDocument,
        claimId,
        fileReference: "seed/locked-cost-proof",
        originalFileName: "ticket.pdf",
        mediaType: "application/pdf",
        byteSize: 4,
        checksum: "seed-checksum",
      },
    ] satisfies (typeof documents.$inferInsert)[];
    await ensureSeedProofDocuments(db, rows);
  }
  {
    const rows = [
      {
        id: entryId,
        claimId,
        transportProfile: "train",
        amountEur: "10.00",
        allocationMethod: "equal",
      },
    ] satisfies (typeof entries.$inferInsert)[];
    await ensureSeedTravelCostEntries(db, rows);
  }
  {
    const rows = [
      {
        travelCostEntryId: entryId,
        projectParticipantId: participantId,
        amountEur: "10.00",
      },
    ] satisfies (typeof allocations.$inferInsert)[];
    await ensureSeedCostAllocations(db, rows);
  }
}

async function ensureOnboardingProgressScenario(db: SeedDatabase): Promise<void> {
  // Partner-initiated app-owned Participant Invitations, never Organization Invitations.
  {
    const host = SEED_IDS.organization.onboardingHost;
    const partner = SEED_IDS.organization.onboardingPartner;
    const other = SEED_IDS.organization.onboardingOther;
    const project = SEED_IDS.project.onboardingProject;
    const own = SEED_IDS.partnership.onboardingOwn;
    const foreign = SEED_IDS.partnership.onboardingForeign;
    const coordinator = SEED_IDS.user.onboardingCoordinator;
    const joined = SEED_IDS.user.onboardingJoined;
    const pending = SEED_IDS.user.onboardingPending;
    const revoked = SEED_IDS.user.onboardingRevoked;
    const outsider = SEED_IDS.user.onboardingOutsider;
    const version = { id: "fixture-v2", contentHash: "fixture-hash-v2" };

    const now = new Date();
    {
      const rows = [coordinator, joined, pending, revoked, outsider].map(
        (id) => ({
          id,
          name: id,
          email: `${id}@example.org`,
          emailVerified: true,
        }),
      ) satisfies (typeof user.$inferInsert)[];
      await ensureSeedUsers(db, rows);
    }
    {
      const rows = [host, partner, other].map((id) => ({
        country: "DE" as const,
        id,
        name: id,
        slug: id,
        createdAt: now,
      })) satisfies (typeof organization.$inferInsert)[];
      await ensureSeedOrganizations(db, rows);
    }
    {
      const rows = [
        {
          id: createId(),
          userId: coordinator,
          organizationId: partner,
          role: ORGANIZATION_ROLES.ProjectCoordinator,
          createdAt: now,
        },
        {
          id: createId(),
          userId: joined,
          organizationId: host,
          role: ORGANIZATION_ROLES.Participant,
          createdAt: now,
        },
        {
          id: createId(),
          userId: joined,
          organizationId: partner,
          role: ORGANIZATION_ROLES.Participant,
          createdAt: now,
        },
        {
          id: createId(),
          userId: outsider,
          organizationId: host,
          role: ORGANIZATION_ROLES.Participant,
          createdAt: now,
        },
      ] satisfies (typeof member.$inferInsert)[];
      await ensureSeedMemberships(db, rows);
    }
    {
      const rows = [
        {
          id: project,
          name: "Seed Onboarding Progress Project",
          startDate: new Date("2024-04-01T00:00:00.000Z"),
          endDate: new Date("2024-04-03T00:00:00.000Z"),
          location: "Riga",
          country: "LV",
          organizationId: host,
        },
      ] satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
        { partnershipId: own, userId: joined },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    {
      const rows = [
        { userId: joined, fullName: "Joined" },
        { userId: pending, fullName: "Pending" },
        { userId: outsider, fullName: "Outsider" },
      ] satisfies (typeof profiles.$inferInsert)[];
      await ensureSeedProfiles(db, rows);
    }
    {
      const rows = [
        {
          userId: joined,
          version: version.id,
          contentHash: version.contentHash,
          answers: '{"accepted":true}',
        },
        {
          userId: pending,
          version: "fixture-v1",
          contentHash: "old-hash",
          answers: '{"accepted":true}',
        },
        {
          userId: outsider,
          version: version.id,
          contentHash: version.contentHash,
          answers: '{"accepted":true}',
        },
      ] satisfies (typeof acceptances.$inferInsert)[];
      await ensureSeedAgreementAcceptances(db, rows);
    }
    {
      const rows = [
        {
          id: SEED_IDS.participation.onboardingProgressParticipation0,
          projectId: project,
          representedOrganizationId: partner,
          userId: joined,
          email: `${joined}@example.org`,
          displayName: "Joined",
        },
        {
          projectId: project,
          id: SEED_IDS.participation.onboardingProgressParticipation1,
          representedOrganizationId: other,
          userId: outsider,
          email: `${outsider}@example.org`,
          displayName: "Outsider",
        },
        {
          projectId: project,
          id: SEED_IDS.participation.onboardingProgressParticipation2,
          representedOrganizationId: partner,
          displayName: "Unlinked",
        },
      ] satisfies (typeof participants.$inferInsert)[];
      await ensureSeedParticipations(db, rows);
    }
    // Progress-only Invitations use the schema's no-expiry state so the baseline
    // cannot age out; runtime hashes have no usable seeded bearer secret.
    const invites = [
      {
        id: SEED_IDS.entryToken.onboardingId2,
        email: `${pending}@example.org`,
        status: "revoked",
        partnershipId: own,
        issuedAt: new Date(now.getTime() - 10000),
      },
      {
        id: SEED_IDS.entryToken.onboardingProgressPendingInvitation,
        email: `${pending}@example.org`,
        status: "pending",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: SEED_IDS.entryToken.onboardingId1,
        email: `${joined}@example.org`,
        status: "pending",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: SEED_IDS.entryToken.onboardingId0,
        email: `${revoked}@example.org`,
        status: "revoked",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: SEED_IDS.entryToken.onboardingId3,
        email: `${outsider}@example.org`,
        status: "pending",
        partnershipId: foreign,
        issuedAt: now,
      },
    ];
    {
      const rows = invites.map(
        ({ id, email, status, partnershipId, issuedAt }) => ({
          id,
          email,
          status,
          secretHash: createHash("sha256").update(randomUUID()).digest("hex"),
          partnershipId,
          projectId: project,
          expiresAt: null,
          issuedByUserId: coordinator,
          issuedAt,
        }),
      ) satisfies (typeof entryTokens.$inferInsert)[];
      await ensureSeedEntryTokens(db, rows);
    }
  }
}

async function ensureExpiredOnboardingProgressScenario(
  db: SeedDatabase,
): Promise<void> {
  const projectId = SEED_IDS.project.expiredOnboardingProjectId;
  const partnershipId = SEED_IDS.partnership.expiredOnboardingPartnershipId;
  const joined = SEED_IDS.user.onboardingJoined;
  const pending = SEED_IDS.user.onboardingPending;
  {
    const rows = [
      {
        id: projectId,
        name: "Seed Expired Onboarding Progress Project",
        organizationId: SEED_IDS.organization.onboardingHost,
        startDate: new Date("2024-04-01"),
        endDate: new Date("2024-04-03"),
        location: "Riga",
        country: "LV",
      },
    ] satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [
      {
        id: partnershipId,
        projectId,
        organizationId: SEED_IDS.organization.onboardingPartner,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId, userId: SEED_IDS.user.onboardingCoordinator },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }
  {
    const rows = [
      {
        id: SEED_IDS.participation.onboardingProgressParticipation3,
        projectId,
        representedOrganizationId: SEED_IDS.organization.onboardingPartner,
        userId: joined,
        email: `${joined}@example.org`,
        displayName: "Joined with outdated agreement",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  // A pending Invitation expired since the epoch is always expired under the 2024 reference policy.
  {
    const rows = [
      {
        id: SEED_IDS.entryToken.onboardingProgressExpiredInvitation,
        partnershipId,
        projectId,
        email: `${pending}@example.org`,
        status: "pending",
        expiresAt: new Date(0),
        secretHash: createHash("sha256").update(randomUUID()).digest("hex"),
        issuedByUserId: SEED_IDS.user.onboardingCoordinator,
        issuedAt: new Date("2024-04-01"),
      },
    ] satisfies (typeof entryTokens.$inferInsert)[];
    await ensureSeedEntryTokens(db, rows);
  }
}

async function ensureEntitySearchScenario(db: SeedDatabase): Promise<string[]> {
  const actor = SEED_IDS.user.entitySearchActor;
  const coordinator = SEED_IDS.user.entitySearchCoordinator;
  const unassignedCoordinator = SEED_IDS.user.entitySearchUnassignedCoordinator;
  const participant = SEED_IDS.user.entitySearchParticipant;
  const host = SEED_IDS.organization.entitySearchHost;
  const partner = SEED_IDS.organization.entitySearchPartner;
  const foreign = SEED_IDS.organization.entitySearchForeign;
  const assigned = SEED_IDS.project.entitySearchAssigned;
  const unassigned = SEED_IDS.project.entitySearchUnassigned;
  const foreignProject = SEED_IDS.project.entitySearchForeignProject;
  const now = new Date();
  const owned = SEED_ENTITY_SEARCH.ownedOrganizations;
  const many = SEED_ENTITY_SEARCH.manyOrganizations;
  {
    const rows = [actor, coordinator, unassignedCoordinator, participant].map(
      (id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        emailVerified: true,
      }),
    ) satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      { id: host, name: "Host" },
      { id: partner, name: "Partner" },
      { id: foreign, name: "Foreign" },
      {
        id: SEED_IDS.organization.entitySearchOrg3,
        name: "Searchable 0",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg4,
        name: "Searchable 1",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg5,
        name: "Searchable 2",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg6,
        name: "Searchable 3",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg7,
        name: "Searchable 4",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg8,
        name: "Searchable 5",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg9,
        name: "Searchable 6",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg10,
        name: "Searchable 7",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg11,
        name: "Searchable 8",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg12,
        name: "Searchable 9",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg13,
        name: "Searchable 10",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg14,
        name: "Searchable 11",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg15,
        name: "Searchable 12",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg16,
        name: "Searchable 13",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg17,
        name: "Searchable 14",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg18,
        name: "Searchable 15",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg19,
        name: "Searchable 16",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg20,
        name: "Searchable 17",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg21,
        name: "Searchable 18",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg22,
        name: "Searchable 19",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg23,
        name: "Searchable 20",
      },
      {
        id: SEED_IDS.organization.entitySearchOrg24,
        name: "Searchable 21",
      },
      ...owned,
      ...many,
    ].map((row) => ({
      ...row,
      slug: row.id,
      country: "DE" as const,
      createdAt: now,
    })) satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const combinedRole = `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.OrganizationOwner}`;
    const rows = [
      {
        userId: actor,
        organizationId: host,
        role: ORGANIZATION_ROLES.OrganizationOwner,
      },
      { userId: actor, organizationId: partner, role: combinedRole },
      {
        userId: actor,
        organizationId: foreign,
        role: ORGANIZATION_ROLES.Participant,
      },
      {
        userId: coordinator,
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
      },
      {
        userId: unassignedCoordinator,
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
      },
      {
        userId: participant,
        organizationId: host,
        role: ORGANIZATION_ROLES.Participant,
      },
      ...owned.map(({ id }, index) => ({
        userId: actor,
        organizationId: id,
        role:
          index < 30
            ? ORGANIZATION_ROLES.ProjectCoordinator
            : ORGANIZATION_ROLES.OrganizationOwner,
      })),
      ...many.map(({ id }, index) => ({
        userId: actor,
        organizationId: id,
        role:
          index === 1001 ? combinedRole : ORGANIZATION_ROLES.ProjectCoordinator,
      })),
    ].map((row) => ({
      ...row,
      id: createId(),
      createdAt: now,
    })) satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const assignedProjectName = "Picker Assigned Project";
    const unassignedProjectName = "Picker Unassigned Project";
    const foreignProjectName = "Picker Foreign Project";
    const rows = [
      { id: assigned, name: assignedProjectName },
      { id: unassigned, name: unassignedProjectName },
      { id: foreignProject, name: foreignProjectName },
    ].map(({ id, name }) => ({
      id,
      name,
      organizationId: id === foreignProject ? foreign : host,
      startDate: new Date("2024-04-01"),
      endDate: new Date("2024-04-03"),
      location: "Berlin",
      country: "DE" as const,
    })) satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [actor, coordinator].map((userId) => ({
      projectId: assigned,
      userId,
    })) satisfies (typeof hostAssignments.$inferInsert)[];
    await ensureSeedHostAssignments(db, rows);
  }
  return [actor, coordinator, unassignedCoordinator, participant];
}

async function ensurePartnershipScenarios(db: SeedDatabase): Promise<string[]> {
  const actor = SEED_IDS.user.partnershipsActor;
  const coord = SEED_IDS.user.partnershipsCoord;
  const stranger = SEED_IDS.user.partnershipsStranger;
  const host = SEED_IDS.organization.partnershipsHost;
  const foreignHost = SEED_IDS.organization.partnershipsForeignHost;
  const project = SEED_IDS.project.partnershipsProject;
  const foreignProject = SEED_IDS.project.partnershipsForeignProject;
  const visibilityHost = SEED_IDS.organization.partnershipsVisibilityHost;
  const visibilityPartner = SEED_IDS.organization.partnershipsVisibilityPartner;
  const ownProject = SEED_IDS.project.partnershipsOwnProject;
  const otherProject = SEED_IDS.project.partnershipsOtherProject;
  const now = new Date();
  {
    const rows = [actor, coord, stranger].map((id) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      emailVerified: true,
    })) satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      { id: host, name: "Partnership Host" },
      { id: foreignHost, name: "Partnership Foreign Host" },
      {
        id: SEED_IDS.organization.partnershipsOrg2,
        name: "Assigned Organization",
      },
      {
        id: SEED_IDS.organization.partnershipsOrg3,
        name: "Removable Organization",
      },
      {
        id: SEED_IDS.organization.partnershipsOrg4,
        name: "Candidate Organization",
      },
      { id: SEED_IDS.organization.partnershipsOrg5, name: "Race Organization" },
      { id: visibilityHost, name: visibilityHost },
      { id: visibilityPartner, name: visibilityPartner },
    ].map((row) => ({
      ...row,
      slug: row.id,
      country: "DE" as const,
      createdAt: now,
    })) satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [coord, stranger].map((userId) => ({
      id: createId(),
      userId,
      organizationId: visibilityPartner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    })) satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [
      {
        id: project,
        name: "Managed Project",
        organizationId: host,
        location: "Tallinn",
        country: "EE" as const,
      },
      {
        id: foreignProject,
        name: "Foreign Managed Project",
        organizationId: foreignHost,
        location: "Riga",
        country: "LV" as const,
      },
      ...[ownProject, otherProject].map((id) => ({
        id,
        name: id,
        organizationId: visibilityHost,
        location: "Riga",
        country: "LV" as const,
      })),
    ].map((row) => ({
      ...row,
      startDate: new Date("2024-04-01"),
      endDate: new Date("2024-04-03"),
    })) satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [project, foreignProject].map((projectId) => ({
      projectId,
      userId: actor,
    })) satisfies (typeof hostAssignments.$inferInsert)[];
    await ensureSeedHostAssignments(db, rows);
  }
  {
    const rows = [
      {
        id: SEED_IDS.partnership.partnershipsId3,
        projectId: project,
        organizationId: SEED_IDS.organization.partnershipsOrg2,
      },
      {
        id: SEED_IDS.partnership.partnershipsId2,
        projectId: project,
        organizationId: SEED_IDS.organization.partnershipsOrg3,
      },
      {
        id: SEED_IDS.partnership.partnershipsId0,
        projectId: ownProject,
        organizationId: visibilityPartner,
      },
      {
        id: SEED_IDS.partnership.partnershipsId1,
        projectId: otherProject,
        organizationId: visibilityPartner,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId: SEED_IDS.partnership.partnershipsId0, userId: coord },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }
  {
    const rows = [
      {
        id: SEED_IDS.participation.partnershipsParticipation0,
        projectId: project,
        representedOrganizationId: SEED_IDS.organization.partnershipsOrg2,
        displayName: "Assigned Participant",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  return [actor, coord, stranger];
}

async function ensureJourneyScenarios(db: SeedDatabase): Promise<string[]> {
  const host = SEED_IDS.organization.journeyHost,
    partner = SEED_IDS.organization.journeyPartner,
    other = SEED_IDS.organization.journeyOther;
  const coordinator = SEED_IDS.user.journeyCoordinator,
    participantUser = SEED_IDS.user.journeyParticipantUser;
  const now = new Date();
  {
    const rows = [
      {
        id: coordinator,
        name: "Journey Coordinator",
        email: `${coordinator}@example.org`,
        emailVerified: true,
      },
      {
        id: participantUser,
        name: "Journey Participant",
        email: `${participantUser}@example.org`,
        emailVerified: true,
      },
    ] satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [host, partner, other].map((id) => ({
      id,
      country: "DE" as const,
      name: `Seed Journey Organization ${id}`,
      slug: id,
      createdAt: now,
    })) satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      {
        id: createId(),
        userId: coordinator,
        organizationId: partner,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: createId(),
        userId: participantUser,
        organizationId: partner,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  const journeyScenarioIds = [
    {
      project: SEED_IDS.project.journeyProject7,
      "second-project": SEED_IDS.project.journeySecondProject4,
      own: SEED_IDS.partnership.journeyOwn2,
      foreign: SEED_IDS.partnership.journeyForeign6,
      next: SEED_IDS.partnership.journeyNext3,
      first: SEED_IDS.participation.journeysParticipation0,
      second: SEED_IDS.participation.journeysParticipation1,
      outside: SEED_IDS.participation.journeysParticipation2,
      later: SEED_IDS.participation.journeysParticipation3,
      claim: SEED_IDS.claim.journeyClaim2,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney0,
    }, // empty
    {
      project: SEED_IDS.project.journeyProject5,
      "second-project": SEED_IDS.project.journeySecondProject2,
      own: SEED_IDS.partnership.journeyOwn0,
      foreign: SEED_IDS.partnership.journeyForeign2,
      next: SEED_IDS.partnership.journeyNext7,
      first: SEED_IDS.participation.journeysParticipation4,
      second: SEED_IDS.participation.journeysParticipation5,
      outside: SEED_IDS.participation.journeysParticipation6,
      later: SEED_IDS.participation.journeysParticipation7,
      claim: SEED_IDS.claim.journeyClaim4,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney1,
    }, // editable
    {
      project: SEED_IDS.project.journeyProject0,
      "second-project": SEED_IDS.project.journeySecondProject3,
      own: SEED_IDS.partnership.journeyOwn3,
      foreign: SEED_IDS.partnership.journeyForeign7,
      next: SEED_IDS.partnership.journeyNext0,
      first: SEED_IDS.participation.journeysParticipation8,
      second: SEED_IDS.participation.journeysParticipation9,
      outside: SEED_IDS.participation.journeysParticipation10,
      later: SEED_IDS.participation.journeysParticipation11,
      claim: SEED_IDS.claim.journeyClaim3,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney6,
    }, // legacy
    {
      project: SEED_IDS.project.journeyProject1,
      "second-project": SEED_IDS.project.journeySecondProject7,
      own: SEED_IDS.partnership.journeyOwn6,
      foreign: SEED_IDS.partnership.journeyForeign1,
      next: SEED_IDS.partnership.journeyNext6,
      first: SEED_IDS.participation.journeysParticipation12,
      second: SEED_IDS.participation.journeysParticipation13,
      outside: SEED_IDS.participation.journeysParticipation14,
      later: SEED_IDS.participation.journeysParticipation15,
      claim: SEED_IDS.claim.journeyClaim7,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney7,
    }, // correction_requested
    {
      project: SEED_IDS.project.journeyProject2,
      "second-project": SEED_IDS.project.journeySecondProject6,
      own: SEED_IDS.partnership.journeyOwn4,
      foreign: SEED_IDS.partnership.journeyForeign3,
      next: SEED_IDS.partnership.journeyNext4,
      first: SEED_IDS.participation.journeysParticipation16,
      second: SEED_IDS.participation.journeysParticipation17,
      outside: SEED_IDS.participation.journeysParticipation18,
      later: SEED_IDS.participation.journeysParticipation19,
      claim: SEED_IDS.claim.journeyClaim5,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney4,
    }, // submitted
    {
      project: SEED_IDS.project.journeyProject4,
      "second-project": SEED_IDS.project.journeySecondProject5,
      own: SEED_IDS.partnership.journeyOwn5,
      foreign: SEED_IDS.partnership.journeyForeign0,
      next: SEED_IDS.partnership.journeyNext1,
      first: SEED_IDS.participation.journeysParticipation20,
      second: SEED_IDS.participation.journeysParticipation21,
      outside: SEED_IDS.participation.journeysParticipation22,
      later: SEED_IDS.participation.journeysParticipation23,
      claim: SEED_IDS.claim.journeyClaim0,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney2,
    }, // approved
    {
      project: SEED_IDS.project.journeyProject6,
      "second-project": SEED_IDS.project.journeySecondProject0,
      own: SEED_IDS.partnership.journeyOwn7,
      foreign: SEED_IDS.partnership.journeyForeign4,
      next: SEED_IDS.partnership.journeyNext5,
      first: SEED_IDS.participation.journeysParticipation24,
      second: SEED_IDS.participation.journeysParticipation25,
      outside: SEED_IDS.participation.journeysParticipation26,
      later: SEED_IDS.participation.journeysParticipation27,
      claim: SEED_IDS.claim.journeyClaim6,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney5,
    }, // rejected
    {
      project: SEED_IDS.project.journeyProject3,
      "second-project": SEED_IDS.project.journeySecondProject1,
      own: SEED_IDS.partnership.journeyOwn1,
      foreign: SEED_IDS.partnership.journeyForeign5,
      next: SEED_IDS.partnership.journeyNext2,
      first: SEED_IDS.participation.journeysParticipation28,
      second: SEED_IDS.participation.journeysParticipation29,
      outside: SEED_IDS.participation.journeysParticipation30,
      later: SEED_IDS.participation.journeysParticipation31,
      claim: SEED_IDS.claim.journeyClaim1,
      "legacy-journey": SEED_IDS.journey.journeyLegacyJourney3,
    }, // paid
  ] as const;
  const journeyScenarioNames = [
    "empty",
    "editable",
    "legacy",
    "correction_requested",
    "submitted",
    "approved",
    "rejected",
    "paid",
  ] as const;
  for (const [journeyIndex, name] of journeyScenarioNames.entries()) {
    const journeyParts = journeyScenarioIds[journeyIndex]!;
    const project = journeyParts.project,
      secondProject = journeyParts["second-project"];
    const own = journeyParts.own,
      foreign = journeyParts.foreign,
      next = journeyParts.next;
    {
      const rows = [project, secondProject].map((projectId) => ({
        id: projectId,
        name: `Seed Journey Project ${projectId}`,
        startDate: new Date("2024-04-01T00:00:00.000Z"),
        endDate: new Date("2024-04-03T00:00:00.000Z"),
        location: "Riga",
        country: "LV" as const,
        organizationId: host,
      })) satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
        { id: next, projectId: secondProject, organizationId: partner },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
        { partnershipId: next, userId: coordinator },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    {
      const rows = [
        {
          id: journeyParts.first,
          projectId: project,
          representedOrganizationId: partner,
          displayName: "First",
        },
        {
          id: journeyParts.second,
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Second",
        },
        {
          id: journeyParts.outside,
          projectId: project,
          representedOrganizationId: other,
          displayName: "Outside",
        },
        {
          id: journeyParts.later,
          projectId: secondProject,
          representedOrganizationId: partner,
          displayName: "Later",
        },
      ] satisfies (typeof participants.$inferInsert)[];
      await ensureSeedParticipations(db, rows);
    }
    if (name !== "empty" && name !== "legacy") {
      {
        const rows = [
          { id: journeyParts.claim, partnershipId: own, status: name },
        ] satisfies (typeof claims.$inferInsert)[];
        await ensureSeedClaimsByPartnership(db, rows);
      }
    }
    if (["legacy", "submitted", "approved", "rejected", "paid"].includes(name)) {
      {
        const rows = [
          {
            id: journeyParts["legacy-journey"],
            projectParticipantId: journeyParts.first,
            origin: name === "legacy" ? "Old" : "Berlin",
            destination: "Riga",
            tripType: name === "legacy" ? "one-way" : "round-trip",
            erasmusDistanceKm: name === "legacy" ? "500" : "850.25",
          },
        ] satisfies (typeof journeys.$inferInsert)[];
        await ensureSeedJourneysByParticipation(db, rows);
      }
    }
  }
  return [coordinator, participantUser];
}

async function ensureSetupLinkScenarios(db: SeedDatabase): Promise<string[]> {
  const owner = SEED_IDS.user.setupLinksOwner,
    host = SEED_IDS.organization.setupLinksHost,
    partner = SEED_IDS.organization.setupLinksPartner;
  const project = SEED_IDS.project.setupLinksProject,
    otherProject = SEED_IDS.project.setupLinksOtherProject;
  const actorIds = [
    owner,
    SEED_IDS.user.setupLinksUser1,
    SEED_IDS.user.setupLinksUser2,
    SEED_IDS.user.setupLinksUser3,
    SEED_IDS.user.setupLinksUser4,
    SEED_IDS.user.setupLinksUser5,
    SEED_IDS.user.setupLinksUser6,
  ];
  const now = new Date();
  {
    const rows = actorIds.map((actorId) => ({
      id: actorId,
      name: `Seed Setup Link User ${actorId}`,
      email:
        actorId === owner
          ? "sg35qwjva9v00sz5lal6nq5k@example.com"
          : `${actorId}@example.com`,
      emailVerified: true,
    })) satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      ...[host, partner].map((id) => ({
        id,
        name: `Seed Setup Link Organization ${id}`,
      })),
      {
        id: SEED_IDS.organization.setupLinksOrg2,
        name: "Combined coordinator,owner",
      },
      {
        id: SEED_IDS.organization.setupLinksOrg3,
        name: "Combined owner,participant",
      },
      { id: SEED_IDS.organization.setupLinksOrg4, name: "Bind Target" },
      ...[
        SEED_IDS.organization.setupLinksOrg5,
        SEED_IDS.organization.setupLinksOrg6,
      ].map((id) => ({
        id,
        name: `Race ${id}`,
      })),
    ].map((row) => ({
      ...row,
      country: "DE" as const,
      slug: row.id,
      createdAt: now,
    })) satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      ...[
        host,
        partner,
        SEED_IDS.organization.setupLinksOrg4,
        SEED_IDS.organization.setupLinksOrg5,
        SEED_IDS.organization.setupLinksOrg6,
      ].map((organizationId) => ({
        id: createId(),
        userId: owner,
        organizationId,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      })),
      {
        id: createId(),
        userId: owner,
        organizationId: SEED_IDS.organization.setupLinksOrg2,
        role: "coordinator,owner",
        createdAt: now,
      },
      {
        id: createId(),
        userId: owner,
        organizationId: SEED_IDS.organization.setupLinksOrg3,
        role: "owner,participant",
        createdAt: now,
      },
      {
        id: createId(),
        userId: SEED_IDS.user.setupLinksUser1,
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: createId(),
        userId: SEED_IDS.user.setupLinksUser2,
        organizationId: host,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
      {
        id: createId(),
        userId: SEED_IDS.user.setupLinksUser3,
        organizationId: host,
        role: ORGANIZATION_ROLES.OrganizationAdmin,
        createdAt: now,
      },
      {
        id: createId(),
        userId: SEED_IDS.user.setupLinksUser4,
        organizationId: host,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      {
        id: createId(),
        userId: SEED_IDS.user.setupLinksUser5,
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: createId(),
        userId: SEED_IDS.user.setupLinksUser6,
        organizationId: partner,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [project, otherProject].map((projectId) => ({
      id: projectId,
      name: `Seed Setup Link Project ${projectId}`,
      startDate: new Date("2024-04-01T00:00:00.000Z"),
      endDate: new Date("2024-04-03T00:00:00.000Z"),
      location: "Riga",
      country: "LV" as const,
      organizationId: host,
    })) satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [
      { projectId: project, userId: owner },
      { projectId: project, userId: SEED_IDS.user.setupLinksUser1 },
      { projectId: project, userId: SEED_IDS.user.setupLinksUser5 },
      { projectId: otherProject, userId: SEED_IDS.user.setupLinksUser5 },
    ] satisfies (typeof hostAssignments.$inferInsert)[];
    await ensureSeedHostAssignments(db, rows);
  }
  return actorIds;
}

async function ensureProjectReadinessScenarios(
  db: SeedDatabase,
): Promise<string[]> {
  const userIds: string[] = [];
  const actor = SEED_IDS.user.readinessActor;
  const roles = [
    ORGANIZATION_ROLES.OrganizationOwner,
    ORGANIZATION_ROLES.OrganizationAdmin,
    ORGANIZATION_ROLES.ProjectCoordinator,
    ORGANIZATION_ROLES.Participant,
  ];
  const otherUser = SEED_IDS.user.readinessOtherUser;
  const host = SEED_IDS.organization.readinessHost;
  const partnerIds = [
    SEED_IDS.organization.projectsOrg1,
    SEED_IDS.organization.projectsOrg2,
    SEED_IDS.organization.projectsOrg3,
  ];

  const now = new Date();
  {
    const rows = [actor, otherUser].map((userId) => ({
      id: userId,
      name: "Readiness actor",
      email: `${userId}@example.org`,
      emailVerified: true,
    })) satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const orgNames = [
      "Readiness Host",
      "Readiness Partner A",
      "Readiness Partner B",
      "Readiness Partner C",
    ];
    const rows = [host, ...partnerIds].map((org, index) => ({
      country: "DE" as const,
      id: org,
      name: orgNames[index]!,
      slug: org,
      createdAt: now,
    })) satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [host, ...partnerIds].map((org) => ({
      id: randomUUID(),
      organizationId: org,
      userId: actor,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: now,
    })) satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  const readinessUserIds = [
    SEED_IDS.user.projectsUser2,
    SEED_IDS.user.projectsUser3,
    SEED_IDS.user.projectsUser4,
    SEED_IDS.user.projectsUser5,
    SEED_IDS.user.projectsUser6,
    SEED_IDS.user.projectsUser7,
    SEED_IDS.user.projectsUser8,
    SEED_IDS.user.projectsUser9,
  ];
  let readinessUserIndex = 0;
  for (const role of roles)
    for (const scope of ["assigned", "unassigned"]) {
      const userId = readinessUserIds[readinessUserIndex++]!;
      userIds.push(userId);
      const row = await db.query.user.findFirst({
        where: (row, { eq }) => eq(row.id, userId),
      });
      if (!row)
        await db
          .insert(user)
          .values({
            id: userId,
            name: `Readiness ${scope} ${role}`,
            email: `${userId}@example.org`,
            emailVerified: true,
          })
          .onConflictDoNothing();
      const membership = await db.query.member.findFirst({
        where: (row, { and, eq }) =>
          and(
            eq(row.userId, userId),
            eq(row.organizationId, SEED_IDS.organization.readinessHost),
          ),
      });
      if (!membership)
        await db
          .insert(member)
          .values({
            id: createId(),
            userId,
            organizationId: SEED_IDS.organization.readinessHost,
            role,
            createdAt: new Date(),
          })
          .onConflictDoNothing();
    }

  const readinessScenarioIds = [
    {
      project: SEED_IDS.project.projectsProject0,
      otherProject: SEED_IDS.project.projectsProject1,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds11,
        SEED_IDS.partnership.readinessPartnershipIds4,
        SEED_IDS.partnership.readinessPartnershipIds21,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership4,
      claims: [],
      otherClaim: null,
    }, // empty
    {
      project: SEED_IDS.project.projectsProject2,
      otherProject: SEED_IDS.project.projectsProject3,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds6,
        SEED_IDS.partnership.readinessPartnershipIds23,
        SEED_IDS.partnership.readinessPartnershipIds16,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership2,
      claims: [
        SEED_IDS.claim.readinessClaims9,
        SEED_IDS.claim.readinessClaims19,
        SEED_IDS.claim.readinessClaims17,
      ],
      otherClaim: SEED_IDS.claim.readinessOtherClaim,
    }, // mixed
    {
      project: SEED_IDS.project.projectsProject4,
      otherProject: SEED_IDS.project.projectsProject5,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds17,
        SEED_IDS.partnership.readinessPartnershipIds20,
        SEED_IDS.partnership.readinessPartnershipIds5,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership1,
      claims: [SEED_IDS.claim.readinessClaims18, SEED_IDS.claim.readinessClaims0],
      otherClaim: null,
    }, // claimless-partial
    {
      project: SEED_IDS.project.projectsProject6,
      otherProject: SEED_IDS.project.projectsProject7,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds13,
        SEED_IDS.partnership.readinessPartnershipIds8,
        SEED_IDS.partnership.readinessPartnershipIds2,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership3,
      claims: [
        SEED_IDS.claim.readinessClaims10,
        SEED_IDS.claim.readinessClaims16,
        SEED_IDS.claim.readinessClaims13,
      ],
      otherClaim: null,
    }, // terminal
    {
      project: SEED_IDS.project.projectsProject8,
      otherProject: SEED_IDS.project.projectsProject9,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds14,
        SEED_IDS.partnership.readinessPartnershipIds19,
        SEED_IDS.partnership.readinessPartnershipIds18,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership7,
      claims: [
        SEED_IDS.claim.readinessClaims12,
        SEED_IDS.claim.readinessClaims11,
        SEED_IDS.claim.readinessClaims5,
      ],
      otherClaim: null,
    }, // editable
    {
      project: SEED_IDS.project.projectsProject10,
      otherProject: SEED_IDS.project.projectsProject11,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds1,
        SEED_IDS.partnership.readinessPartnershipIds15,
        SEED_IDS.partnership.readinessPartnershipIds3,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership6,
      claims: [
        SEED_IDS.claim.readinessClaims14,
        SEED_IDS.claim.readinessClaims6,
        SEED_IDS.claim.readinessClaims4,
      ],
      otherClaim: null,
    }, // submitted
    {
      project: SEED_IDS.project.projectsProject12,
      otherProject: SEED_IDS.project.projectsProject13,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds0,
        SEED_IDS.partnership.readinessPartnershipIds7,
        SEED_IDS.partnership.readinessPartnershipIds9,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership5,
      claims: [
        SEED_IDS.claim.readinessClaims1,
        SEED_IDS.claim.readinessClaims15,
        SEED_IDS.claim.readinessClaims8,
      ],
      otherClaim: null,
    }, // correction_requested
    {
      project: SEED_IDS.project.projectsProject14,
      otherProject: SEED_IDS.project.projectsProject15,
      partnershipIds: [
        SEED_IDS.partnership.readinessPartnershipIds10,
        SEED_IDS.partnership.readinessPartnershipIds12,
        SEED_IDS.partnership.readinessPartnershipIds22,
      ],
      otherPartnership: SEED_IDS.partnership.readinessOtherPartnership0,
      claims: [
        SEED_IDS.claim.readinessClaims2,
        SEED_IDS.claim.readinessClaims3,
        SEED_IDS.claim.readinessClaims7,
      ],
      otherClaim: null,
    }, // approved
  ] as const;
  const readinessScenarioNames = [
    "empty",
    "mixed",
    "claimless-partial",
    "terminal",
    "editable",
    "submitted",
    "correction_requested",
    "approved",
  ] as const;
  for (const [readinessIndex, name] of readinessScenarioNames.entries()) {
    const readinessScenario = readinessScenarioIds[readinessIndex]!;
    const projectId = readinessScenario.project,
      secondProjectId = readinessScenario.otherProject;
    const partnershipIds = readinessScenario.partnershipIds,
      otherPartnershipId = readinessScenario.otherPartnership;
    {
      const rows = [projectId, secondProjectId].map((project) => ({
        id: project,
        name: project,
        startDate: new Date("2024-04-01T00:00:00.000Z"),
        endDate: new Date("2024-04-03T00:00:00.000Z"),
        location: "Riga",
        country: "LV" as const,
        organizationId: host,
      })) satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [projectId, secondProjectId].flatMap((projectId) =>
        [actor, SEED_IDS.user.projectsUser6, SEED_IDS.user.projectsUser8].map(
          (userId) => ({ projectId, userId }),
        ),
      ) satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        ...partnershipIds.map((link, index) => ({
          id: link,
          projectId,
          organizationId: partnerIds[index]!,
        })),
        {
          id: otherPartnershipId,
          projectId: secondProjectId,
          organizationId: partnerIds[0]!,
        },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }

    const statuses =
      name === "empty"
        ? ([] as const)
        : name === "mixed"
          ? (["correction_requested", "approved", "paid"] as const)
          : name === "claimless-partial"
            ? (["submitted", "paid"] as const)
            : name === "terminal"
              ? (["paid", "rejected", "paid"] as const)
              : ([name, "paid", "rejected"] as const);
    for (const [index, status] of statuses.entries()) {
      const partnershipId = partnershipIds[index]!;
      const claimId = readinessScenario.claims[index]!;
      const saved = await db.query.claimsTable.findFirst({
        where: (row, { eq }) => eq(row.partnershipId, partnershipId),
      });
      if (!saved)
        await db
          .insert(claims)
          .values({
            id: claimId,
            partnershipId,
            status,
          })
          .onConflictDoNothing();
    }
    if (name === "mixed") {
      const saved = await db.query.claimsTable.findFirst({
        where: (row, { eq }) => eq(row.partnershipId, otherPartnershipId),
      });
      if (!saved)
        await db
          .insert(claims)
          .values({
            id: readinessScenario.otherClaim!,
            partnershipId: otherPartnershipId,
            status: "rejected",
          })
          .onConflictDoNothing();
    }
  }
  userIds.push(actor, otherUser);

  return userIds;
}

async function ensureProjectDetailScenarios(db: SeedDatabase): Promise<string[]> {
  const userIds: string[] = [];

  const userId = SEED_IDS.user.projectDetailUserId;
  const hostId = SEED_IDS.organization.projectDetailHostId;
  const partnerId = SEED_IDS.organization.projectDetailPartnerId;
  const unrelatedId = SEED_IDS.organization.projectDetailUnrelatedId;
  const projectId = SEED_IDS.project.projectDetailProjectId;
  const partnershipId = SEED_IDS.partnership.projectDetailPartnershipId;
  const assignedAt = new Date("2024-02-01T10:00:00.000Z");
  const updatedAt = new Date("2024-02-02T10:00:00.000Z");

  const now = new Date();
  {
    const rows = [
      {
        id: userId,
        name: "Detail User",
        email: `${userId}@example.com`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ] satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      {
        country: "DE",
        id: hostId,
        name: "Detail Host",
        slug: hostId,
        createdAt: now,
      },
      {
        country: "DE",
        id: partnerId,
        name: "Detail Partner",
        slug: partnerId,
        createdAt: now,
      },
      {
        country: "DE",
        id: unrelatedId,
        name: "Detail Unrelated",
        slug: unrelatedId,
        createdAt: now,
      },
    ] satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      {
        id: randomUUID(),
        userId,
        organizationId: hostId,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [partnerId, unrelatedId].map((organizationId) => ({
      id: randomUUID(),
      userId,
      organizationId,
      role: ORGANIZATION_ROLES.OrganizationOwner,
      createdAt: now,
    })) satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [
      {
        id: projectId,
        name: "Detail Project",
        startDate: new Date("2024-08-01T00:00:00.000Z"),
        endDate: new Date("2024-08-03T00:00:00.000Z"),
        location: "Prague",
        country: "CZ",
        organizationId: hostId,
        costSubmissionWindowOpen: true,
      },
    ] satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [
      {
        id: partnershipId,
        projectId,
        organizationId: partnerId,
        createdAt: assignedAt,
        updatedAt,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }

  userIds.push(userId);

  return userIds;
}

async function ensureProjectListScenarios(db: SeedDatabase): Promise<string[]> {
  const userIds: string[] = [];

  const userId = SEED_IDS.user.projectListUserId;
  const hostId = SEED_IDS.organization.projectListHostId;
  const foreignHostId = SEED_IDS.organization.projectListForeignHostId;
  const partnerId = SEED_IDS.organization.projectListPartnerId;
  const secondPartnerId = SEED_IDS.organization.projectListSecondPartnerId;
  const unrelatedId = SEED_IDS.organization.projectListUnrelatedId;
  const alphaId = SEED_IDS.project.projectListAlphaId;
  const betaId = SEED_IDS.project.projectListBetaId;
  const climateId = SEED_IDS.project.projectListClimateId;
  const foreignId = SEED_IDS.project.projectListForeignId;
  const archivedId = SEED_IDS.project.projectListArchivedId;
  const generatedIds = [
    SEED_IDS.project.projectListGeneratedIds18,
    SEED_IDS.project.projectListGeneratedIds11,
    SEED_IDS.project.projectListGeneratedIds23,
    SEED_IDS.project.projectListGeneratedIds4,
    SEED_IDS.project.projectListGeneratedIds3,
    SEED_IDS.project.projectListGeneratedIds20,
    SEED_IDS.project.projectListGeneratedIds0,
    SEED_IDS.project.projectListGeneratedIds10,
    SEED_IDS.project.projectListGeneratedIds1,
    SEED_IDS.project.projectListGeneratedIds2,
    SEED_IDS.project.projectListGeneratedIds16,
    SEED_IDS.project.projectListGeneratedIds25,
    SEED_IDS.project.projectListGeneratedIds19,
    SEED_IDS.project.projectListGeneratedIds17,
    SEED_IDS.project.projectListGeneratedIds8,
    SEED_IDS.project.projectListGeneratedIds21,
    SEED_IDS.project.projectListGeneratedIds12,
    SEED_IDS.project.projectListGeneratedIds9,
    SEED_IDS.project.projectListGeneratedIds24,
    SEED_IDS.project.projectListGeneratedIds6,
    SEED_IDS.project.projectListGeneratedIds13,
    SEED_IDS.project.projectListGeneratedIds14,
    SEED_IDS.project.projectListGeneratedIds7,
    SEED_IDS.project.projectListGeneratedIds22,
    SEED_IDS.project.projectListGeneratedIds15,
    SEED_IDS.project.projectListGeneratedIds5,
  ];
  const partnershipIds = [
    SEED_IDS.partnership.projectListPartnershipIds0,
    SEED_IDS.partnership.projectListPartnershipIds2,
    SEED_IDS.partnership.projectListPartnershipIds1,
    SEED_IDS.partnership.projectListPartnershipIds3,
    ...generatedIds.map((id) => `list-link-${id}`),
  ];
  function getGeneratedDate(index: number) {
    const day = index === 1 ? 1 : index === 22 ? 22 : index + 1;
    return new Date(Date.UTC(2024, 11, day));
  }

  const now = new Date();
  {
    const rows = [
      {
        id: userId,
        name: "List User",
        email: `${userId}@example.com`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ] satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      {
        country: "DE",
        id: hostId,
        name: "List Host",
        slug: hostId,
        createdAt: now,
      },
      {
        country: "DE",
        id: foreignHostId,
        name: "List Foreign Host",
        slug: foreignHostId,
        createdAt: now,
      },
      {
        country: "DE",
        id: partnerId,
        name: "List Partner",
        slug: partnerId,
        createdAt: now,
      },
      {
        country: "DE",
        id: secondPartnerId,
        name: "List Second Partner",
        slug: secondPartnerId,
        createdAt: now,
      },
      {
        country: "DE",
        id: unrelatedId,
        name: "List Unrelated",
        slug: unrelatedId,
        createdAt: now,
      },
    ] satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      {
        id: randomUUID(),
        userId,
        organizationId: hostId,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [
      {
        id: alphaId,
        name: "Alpha Open Workshop",
        startDate: new Date("2024-06-01T00:00:00.000Z"),
        endDate: new Date("2024-06-03T00:00:00.000Z"),
        location: "Berlin",
        country: "DE",
        organizationId: hostId,
        costSubmissionWindowOpen: true,
      },
      {
        id: betaId,
        name: "Beta Closed Forum",
        startDate: new Date("2024-06-03T00:00:00.000Z"),
        endDate: new Date("2024-06-05T00:00:00.000Z"),
        location: "Paris",
        country: "FR",
        organizationId: hostId,
      },
      {
        id: climateId,
        name: "Climate Assembly",
        startDate: new Date("2024-07-01T00:00:00.000Z"),
        endDate: new Date("2024-07-05T00:00:00.000Z"),
        location: "Vienna",
        country: "AT",
        organizationId: hostId,
        costSubmissionWindowOpen: true,
      },
      {
        id: foreignId,
        name: "Foreign Partner Project",
        startDate: new Date("2024-05-01T00:00:00.000Z"),
        endDate: new Date("2024-05-02T00:00:00.000Z"),
        location: "Rome",
        country: "IT",
        organizationId: foreignHostId,
        costSubmissionWindowOpen: true,
      },
      {
        id: archivedId,
        name: "Archived Project",
        startDate: new Date("2024-04-01T00:00:00.000Z"),
        endDate: new Date("2024-04-02T00:00:00.000Z"),
        location: "Madrid",
        country: "ES",
        organizationId: hostId,
        archived: true,
      },
      ...generatedIds.map((id, index) => ({
        id,
        name: `Generated Project ${index.toString().padStart(2, "0")}`,
        startDate: getGeneratedDate(index),
        endDate: new Date(getGeneratedDate(index).getTime() + 86_400_000),
        location: "Brussels",
        country: "BE" as const,
        organizationId: hostId,
      })),
    ] satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [
      { id: partnershipIds[0]!, projectId: alphaId, organizationId: partnerId },
      {
        id: partnershipIds[1]!,
        projectId: alphaId,
        organizationId: secondPartnerId,
      },
      { id: partnershipIds[2]!, projectId: betaId, organizationId: partnerId },
      {
        id: partnershipIds[3]!,
        projectId: foreignId,
        organizationId: partnerId,
      },
      ...generatedIds.map((projectId, index) => ({
        id: partnershipIds[index + 4]!,
        projectId,
        organizationId: partnerId,
      })),
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }

  const listActors = [
    {
      role: ORGANIZATION_ROLES.Participant,
      id: SEED_IDS.user.projectsUser12,
      email: "r4lbmg3rydm9whnikhr8uk39@example.org",
    },
    {
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      id: SEED_IDS.user.projectsUser13,
      email: "weegow6wmcg6tmuc0zy0v5s4@example.org",
    },
    {
      role: `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
      id: SEED_IDS.user.projectsUser14,
      email: "kpdbi3tev42k6epgarud6fie@example.org",
    },
  ] as const;
  for (const { role, id: actorId, email: actorEmail } of listActors) {
    userIds.push(actorId);
    const saved = await db.query.user.findFirst({
      where: (row, { eq }) => eq(row.id, actorId),
    });
    if (!saved)
      await db
        .insert(user)
        .values({
          id: actorId,
          name: `List ${role}`,
          email: actorEmail,
          emailVerified: true,
        })
        .onConflictDoNothing();
    const membership = await db.query.member.findFirst({
      where: (row, { and, eq }) =>
        and(eq(row.userId, actorId), eq(row.organizationId, hostId)),
    });
    if (!membership)
      await db
        .insert(member)
        .values({
          id: createId(),
          userId: actorId,
          organizationId: hostId,
          role,
          createdAt: now,
        })
        .onConflictDoNothing();
  }
  userIds.push(userId);

  return userIds;
}

async function ensureProjectRelationshipScenarios(
  db: SeedDatabase,
): Promise<string[]> {
  const userIds: string[] = [];

  const userId = SEED_IDS.user.projectRelationshipUserId;
  const hostingOrganizationId =
    SEED_IDS.organization.projectRelationshipHostingOrganizationId;
  const partnerOrganizationId =
    SEED_IDS.organization.projectRelationshipPartnerOrganizationId;
  const unrelatedOrganizationId =
    SEED_IDS.organization.projectRelationshipUnrelatedOrganizationId;
  const projectId = SEED_IDS.project.projectRelationshipProjectId;
  const archivedProjectId = SEED_IDS.project.projectRelationshipArchivedProjectId;
  const partnershipId = SEED_IDS.partnership.projectRelationshipPartnershipId;

  const now = new Date();
  {
    const rows = [
      {
        id: userId,
        name: "Relationship Test User",
        email: `${userId}@example.com`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ] satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      {
        country: "DE",
        id: hostingOrganizationId,
        name: "Relationship Hosting Organization",
        slug: hostingOrganizationId,
        createdAt: now,
      },
      {
        country: "DE",
        id: partnerOrganizationId,
        name: "Relationship Partner Organization",
        slug: partnerOrganizationId,
        createdAt: now,
      },
      {
        country: "DE",
        id: unrelatedOrganizationId,
        name: "Relationship Unrelated Organization",
        slug: unrelatedOrganizationId,
        createdAt: now,
      },
    ] satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      {
        id: projectId,
        name: "Relationship Project",
        startDate: new Date("2024-06-01T00:00:00.000Z"),
        endDate: new Date("2024-06-03T00:00:00.000Z"),
        location: "Berlin",
        country: "DE",
        organizationId: hostingOrganizationId,
      },
      {
        id: archivedProjectId,
        name: "Archived Relationship Project",
        startDate: new Date("2024-07-01T00:00:00.000Z"),
        endDate: new Date("2024-07-03T00:00:00.000Z"),
        location: "Paris",
        country: "FR",
        organizationId: hostingOrganizationId,
        archived: true,
      },
    ] satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [
      {
        id: partnershipId,
        projectId,
        organizationId: partnerOrganizationId,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }

  userIds.push(userId);

  return userIds;
}

async function ensureProjectDiscoveryScenarios(
  db: SeedDatabase,
): Promise<string[]> {
  const userIds: string[] = [];

  const coord = SEED_IDS.user.projectDiscoveryCoord;
  const stranger = SEED_IDS.user.projectDiscoveryStranger;
  const host = SEED_IDS.organization.projectDiscoveryHost;
  const partner = SEED_IDS.organization.projectDiscoveryPartner;
  const assignedProject = SEED_IDS.project.projectDiscoveryAssignedProject;
  const foreignProject = SEED_IDS.project.projectDiscoveryForeignProject;
  const assignedPartnership =
    SEED_IDS.partnership.projectDiscoveryAssignedPartnership;
  const foreignPartnership =
    SEED_IDS.partnership.projectDiscoveryForeignPartnership;

  const now = new Date();
  {
    const rows = [coord, stranger].map((userId) => ({
      id: userId,
      name: "Discovery coordinator",
      email: `${userId}@example.com`,
      emailVerified: true,
    })) satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [host, partner].map((id) => ({
      country: "DE" as const,
      id,
      name: id,
      slug: id,
      createdAt: now,
    })) satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      {
        id: randomUUID(),
        organizationId: partner,
        userId: coord,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: randomUUID(),
        organizationId: partner,
        userId: stranger,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [assignedProject, foreignProject].map((id) => ({
      id,
      name: id,
      startDate: new Date("2024-04-01T00:00:00.000Z"),
      endDate: new Date("2024-04-03T00:00:00.000Z"),
      location: "Riga",
      country: "LV" as const,
      organizationId: host,
    })) satisfies (typeof projects.$inferInsert)[];
    await ensureSeedProjects(db, rows);
  }
  {
    const rows = [
      {
        id: assignedPartnership,
        projectId: assignedProject,
        organizationId: partner,
      },
      {
        id: foreignPartnership,
        projectId: foreignProject,
        organizationId: partner,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      {
        partnershipId: assignedPartnership,
        userId: coord,
      },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }

  userIds.push(coord, stranger);

  return userIds;
}

async function ensureProjectScenarios(db: SeedDatabase): Promise<string[]> {
  return [
    ...(await ensureProjectReadinessScenarios(db)),
    ...(await ensureProjectDetailScenarios(db)),
    ...(await ensureProjectListScenarios(db)),
    ...(await ensureProjectRelationshipScenarios(db)),
    ...(await ensureProjectDiscoveryScenarios(db)),
  ];
}

async function ensureParticipationScenarios(db: SeedDatabase): Promise<string[]> {
  const host = SEED_IDS.organization.participationHost;
  const partner = SEED_IDS.organization.participationPartner;
  const other = SEED_IDS.organization.participationOther;
  const coordinator = SEED_IDS.user.participationCoordinator;
  const candidate = SEED_IDS.user.participationCandidate;
  const unassigned = SEED_IDS.user.participationUnassigned;
  const currentAcceptor = SEED_IDS.user.participationCurrentAcceptor;
  const oldAcceptor = SEED_IDS.user.participationOldAcceptor;
  const email = "qvgz7f1iyhnu7gp1lgxxo0xr@example.org";

  const version = { id: "fixture-v1", contentHash: "fixture-hash" };
  const now = new Date();
  {
    const rows = [
      {
        id: coordinator,
        name: "Coordinator",
        email: "yk6wubi79tj3ebwz8yd9x08t@example.org",
        emailVerified: true,
      },
      { id: candidate, name: "Candidate", email, emailVerified: true },
      {
        id: unassigned,
        name: "Unassigned",
        email: "f5i4bmbo7wrhagns7u47kg9i@x.org",
      },
      {
        id: currentAcceptor,
        name: "Current",
        email: "e7oprdkk819b6w8w68u761vp@x.org",
      },
      { id: oldAcceptor, name: "Old", email: "yufbvup9o0m6ohqvfhu3fxv2@x.org" },
    ] satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      { country: "DE", id: host, name: "Host", slug: host, createdAt: now },
      {
        country: "FR",
        id: partner,
        name: "Partner",
        slug: partner,
        createdAt: now,
      },
      { country: "IT", id: other, name: "Other", slug: other, createdAt: now },
    ] satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      {
        id: randomUUID(),
        userId: coordinator,
        organizationId: partner,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: coordinator,
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: candidate,
        organizationId: host,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: unassigned,
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [
      { userId: candidate, fullName: "Candidate" },
    ] satisfies (typeof profiles.$inferInsert)[];
    await ensureSeedProfiles(db, rows);
  }
  {
    const rows = [
      {
        userId: candidate,
        version: version.id,
        contentHash: version.contentHash,
        answers: '{"accepted":true}',
      },
      // Only the current required version completes the agreement; an older
      // acceptance is historical evidence, not completion.
      {
        userId: currentAcceptor,
        version: version.id,
        contentHash: version.contentHash,
        answers: '{"accepted":true}',
      },
      {
        userId: oldAcceptor,
        version: "fixture-v0",
        contentHash: "fixture-old-hash",
        answers: '{"accepted":true}',
      },
    ] satisfies (typeof acceptances.$inferInsert)[];
    await ensureSeedAgreementAcceptances(db, rows);
  }

  const mixedUser = SEED_IDS.user.participationMixedUser,
    owner = SEED_IDS.user.participationOwner,
    secondAssignee = SEED_IDS.user.participationSecondAssignee;
  const missingAgreement = SEED_IDS.user.participationMissingAgreement,
    missingProfile = SEED_IDS.user.participationMissingProfile;
  {
    const rows = [
      {
        id: mixedUser,
        name: "Mixed",
        email: "r8ekilum3fbuhjkmk4hkx9lc@EXAMPLE.ORG",
        emailVerified: true,
      },
      ...[owner, secondAssignee, missingAgreement, missingProfile].map((id) => ({
        id,
        name: id,
        email: `${id}@example.org`,
        emailVerified: true,
      })),
    ] satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [
      {
        id: SEED_IDS.membership.participationId,
        userId: candidate,
        organizationId: partner,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: createId(),
        userId: owner,
        organizationId: partner,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      {
        id: createId(),
        userId: secondAssignee,
        organizationId: partner,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      ...[mixedUser, missingAgreement, missingProfile].map((userId) => ({
        id: createId(),
        userId,
        organizationId: host,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      })),
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [
      { userId: mixedUser, fullName: "Mixed" },
      { userId: missingAgreement, fullName: "Agreement Pending" },
    ] satisfies (typeof profiles.$inferInsert)[];
    await ensureSeedProfiles(db, rows);
  }
  {
    const rows = [
      {
        userId: mixedUser,
        version: version.id,
        contentHash: version.contentHash,
        answers: '{"accepted":true}',
      },
    ] satisfies (typeof acceptances.$inferInsert)[];
    await ensureSeedAgreementAcceptances(db, rows);
  }
  async function ensureParticipationProjectPartnerships(
    name: string,
    project: string,
    own: string,
    foreign: string,
  ): Promise<void> {
    {
      const rows = [
        {
          id: project,
          name: `Seed Participation Project ${name}`,
          startDate: new Date("2024-04-01T00:00:00.000Z"),
          endDate: new Date("2024-04-03T00:00:00.000Z"),
          location: "Riga",
          country: "LV",
          organizationId: host,
        },
      ] satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }

    {
      const rows = [
        { partnershipId: own, userId: secondAssignee },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
  }
  async function ensureParticipationProjectScenarios(): Promise<void> {
    const claimStatuses = {
      submitted: "submitted",
      correction: "correction_requested",
    } as const;
    const participationScenarioIds = [
      {
        project: SEED_IDS.project.participationProject8,
        own: SEED_IDS.partnership.participationOwn1,
        foreign: SEED_IDS.partnership.participationForeign3,
        rowId: SEED_IDS.participation.participationRowId3,
        token: null,
        claim: null,
      }, // empty
      {
        project: SEED_IDS.project.participationProject6,
        own: SEED_IDS.partnership.participationOwn6,
        foreign: SEED_IDS.partnership.participationForeign0,
        rowId: SEED_IDS.participation.participationsParticipation0,
        token: null,
        claim: null,
      }, // email
      {
        project: SEED_IDS.project.participationProject3,
        own: SEED_IDS.partnership.participationOwn2,
        foreign: SEED_IDS.partnership.participationForeign9,
        rowId: SEED_IDS.participation.participationsParticipation1,
        token: null,
        claim: null,
      }, // mixed
      {
        project: SEED_IDS.project.participationProject7,
        own: SEED_IDS.partnership.participationOwn4,
        foreign: SEED_IDS.partnership.participationForeign8,
        rowId: SEED_IDS.participation.participationsParticipation2,
        token: null,
        claim: null,
      }, // old-email
      {
        project: SEED_IDS.project.participationProject2,
        own: SEED_IDS.partnership.participationOwn3,
        foreign: SEED_IDS.partnership.participationForeign2,
        rowId: SEED_IDS.participation.participationRowId4,
        token: SEED_IDS.entryToken.participationToken1,
        claim: null,
      }, // foreign-invitation
      {
        project: SEED_IDS.project.participationProject9,
        own: SEED_IDS.partnership.participationOwn0,
        foreign: SEED_IDS.partnership.participationForeign1,
        rowId: SEED_IDS.participation.participationRowId1,
        token: SEED_IDS.entryToken.participationToken0,
        claim: null,
      }, // own-invitation
      {
        project: SEED_IDS.project.participationProject10,
        own: SEED_IDS.partnership.participationOwn8,
        foreign: SEED_IDS.partnership.participationForeign7,
        rowId: SEED_IDS.participation.participationsParticipation3,
        token: null,
        claim: null,
      }, // referenced
      {
        project: SEED_IDS.project.participationProject1,
        own: SEED_IDS.partnership.participationOwn9,
        foreign: SEED_IDS.partnership.participationForeign10,
        rowId: SEED_IDS.participation.participationsParticipation4,
        token: null,
        claim: SEED_IDS.claim.participationClaim0,
      }, // submitted
      {
        project: SEED_IDS.project.participationProject4,
        own: SEED_IDS.partnership.participationOwn5,
        foreign: SEED_IDS.partnership.participationForeign5,
        rowId: SEED_IDS.participation.participationsParticipation5,
        token: null,
        claim: SEED_IDS.claim.participationClaim1,
      }, // correction
      {
        project: SEED_IDS.project.participationProject0,
        own: SEED_IDS.partnership.participationOwn7,
        foreign: SEED_IDS.partnership.participationForeign6,
        rowId: SEED_IDS.participation.participationRowId0,
        token: null,
        claim: null,
      }, // report
      {
        project: SEED_IDS.project.participationProject5,
        own: SEED_IDS.partnership.participationOwn10,
        foreign: SEED_IDS.partnership.participationForeign4,
        rowId: SEED_IDS.participation.participationRowId2,
        token: null,
        claim: null,
      }, // report-empty
    ] as const;
    const participationScenarioNames = [
      "empty",
      "email",
      "mixed",
      "old-email",
      "foreign-invitation",
      "own-invitation",
      "referenced",
      "submitted",
      "correction",
      "report",
      "report-empty",
    ] as const;
    for (const [
      participationIndex,
      name,
    ] of participationScenarioNames.entries()) {
      const participationScenario = participationScenarioIds[participationIndex]!;
      const project = participationScenario.project,
        own = participationScenario.own,
        foreign = participationScenario.foreign;
      await ensureParticipationProjectPartnerships(name, project, own, foreign);
      const rowId = participationScenario.rowId;
      if (name === "email" || name === "mixed" || name === "old-email") {
        {
          const rows = [
            {
              id: rowId,
              projectId: project,
              representedOrganizationId: other,
              displayName: name === "old-email" ? "Earlier email" : "Existing",
              userId: name === "old-email" ? candidate : null,
              email:
                name === "mixed"
                  ? "r8ekilum3fbuhjkmk4hkx9lc@example.org"
                  : name === "old-email"
                    ? "yufbvup9o0m6ohqvfhu3fxv2@example.org"
                    : email,
            },
          ] satisfies (typeof participants.$inferInsert)[];
          await ensureSeedParticipations(db, rows);
        }
      }
      if (name === "foreign-invitation" || name === "own-invitation") {
        {
          const rows = [
            {
              id: participationScenario.token!,
              projectId: project,
              partnershipId: name === "own-invitation" ? own : foreign,
              email,
              secretHash: createHash("sha256").update(randomUUID()).digest("hex"),
              expiresAt: new Date(SEED_READ_ONLY_INVITATION_EXPIRY),
              issuedByUserId: coordinator,
            },
          ] satisfies (typeof entryTokens.$inferInsert)[];
          await ensureSeedEntryTokens(db, rows);
        }
      }
      if (
        name === "referenced" ||
        name === "submitted" ||
        name === "correction"
      ) {
        {
          const rows = [
            {
              id: rowId,
              projectId: project,
              representedOrganizationId: partner,
              displayName: "Candidate",
              userId: candidate,
              email,
            },
          ] satisfies (typeof participants.$inferInsert)[];
          await ensureSeedParticipations(db, rows);
        }
      }
      if (name === "referenced") {
        {
          const rows = [
            {
              id: SEED_IDS.journey.participationId,
              projectParticipantId: rowId,
              origin: "Riga",
              destination: "Berlin",
              tripType: "one-way",
              erasmusDistanceKm: "100.00",
            },
          ] satisfies (typeof journeys.$inferInsert)[];
          await ensureSeedJourneysByParticipation(db, rows);
        }
      }
      if (name === "submitted" || name === "correction") {
        {
          const rows = [
            {
              id: participationScenario.claim!,
              partnershipId: own,
              status: claimStatuses[name],
            },
          ] satisfies (typeof claims.$inferInsert)[];
          await ensureSeedClaimsByPartnership(db, rows);
        }
      }
      if (name === "report") {
        {
          const rows = [
            {
              id: SEED_IDS.participation.participationsParticipation6,
              projectId: project,
              representedOrganizationId: partner,
              displayName: "Amy Unlinked",
              email: "ut1b4diuxogz62bx2lp6ei4k@example.org",
            },
            {
              id: SEED_IDS.participation.participationsParticipation7,
              projectId: project,
              representedOrganizationId: partner,
              displayName: "Zoe Current",
              userId: currentAcceptor,
              email: "e7oprdkk819b6w8w68u761vp@x.org",
              country: "PT",
            },
            {
              id: SEED_IDS.participation.participationsParticipation8,
              projectId: project,
              representedOrganizationId: other,
              displayName: "Yan Outdated",
              userId: oldAcceptor,
              email: "yufbvup9o0m6ohqvfhu3fxv2@x.org",
            },
          ] satisfies (typeof participants.$inferInsert)[];
          await ensureSeedParticipations(db, rows);
        }
      }
    }
  }
  await ensureParticipationProjectScenarios();

  async function ensureParticipationDirectoryScenarios(): Promise<void> {
    {
      const cases = [
        {
          key: "unverified",
          verified: false,
          profile: true,
          accepted: true,
          org: host,
          role: ORGANIZATION_ROLES.Participant,
        },
        {
          key: "no-profile",
          verified: true,
          profile: false,
          accepted: true,
          org: host,
          role: ORGANIZATION_ROLES.Participant,
        },
        {
          key: "stale",
          verified: true,
          profile: true,
          accepted: false,
          org: host,
          role: ORGANIZATION_ROLES.Participant,
        },
        {
          key: "wrong-role",
          verified: true,
          profile: true,
          accepted: true,
          org: host,
          role: ORGANIZATION_ROLES.ProjectCoordinator,
        },
        {
          key: "wrong-org",
          verified: true,
          profile: true,
          accepted: true,
          org: other,
          role: ORGANIZATION_ROLES.Participant,
        },
      ];
      const ids = [
        SEED_IDS.user.participationsUser10,
        SEED_IDS.user.participationsUser11,
        SEED_IDS.user.participationsUser12,
        SEED_IDS.user.participationsUser13,
        SEED_IDS.user.participationsUser14,
      ];
      const directoryEmails = [
        "l0w9g4n0cbb3wza1tzuu847m@example.org",
        "x7t57jutj2wmcih2pvlqjopb@example.org",
        "rornt3es93uoymcfmw6md2he@example.org",
        "h3ginec0jtgjtp8c9bxpkv2w@example.org",
        "faev6x3yt3v8nynvbnvych45@example.org",
      ];
      {
        const rows = cases.map(({ verified }, index) => ({
          id: ids[index]!,
          name: "Directory Candidate",
          email: directoryEmails[index]!,
          emailVerified: verified,
        })) satisfies (typeof user.$inferInsert)[];
        await ensureSeedUsers(db, rows);
      }
      {
        const rows = cases.map(({ org, role }, index) => ({
          id: randomUUID(),
          organizationId: org,
          userId: ids[index]!,
          role,
          createdAt: new Date(),
        })) satisfies (typeof member.$inferInsert)[];
        await ensureSeedMemberships(db, rows);
      }
      {
        const rows = cases.flatMap(({ profile }, index) =>
          profile
            ? [{ userId: ids[index]!, fullName: "Directory Candidate" }]
            : [],
        ) satisfies (typeof profiles.$inferInsert)[];
        await ensureSeedProfiles(db, rows);
      }
      {
        const rows = cases.flatMap(({ accepted }, index) =>
          accepted
            ? [
                {
                  userId: ids[index]!,
                  version: version.id,
                  contentHash: version.contentHash,
                  answers: '{"accepted":true}',
                },
              ]
            : [],
        ) satisfies (typeof acceptances.$inferInsert)[];
        await ensureSeedAgreementAcceptances(db, rows);
      }
    }
    {
      const ids = [
        SEED_IDS.user.participationsUser15,
        SEED_IDS.user.participationsUser16,
        SEED_IDS.user.participationsUser17,
        SEED_IDS.user.participationsUser18,
        SEED_IDS.user.participationsUser19,
        SEED_IDS.user.participationsUser20,
        SEED_IDS.user.participationsUser21,
        SEED_IDS.user.participationsUser22,
        SEED_IDS.user.participationsUser23,
        SEED_IDS.user.participationsUser24,
        SEED_IDS.user.participationsUser25,
        SEED_IDS.user.participationsUser26,
        SEED_IDS.user.participationsUser27,
        SEED_IDS.user.participationsUser28,
        SEED_IDS.user.participationsUser29,
        SEED_IDS.user.participationsUser30,
        SEED_IDS.user.participationsUser31,
        SEED_IDS.user.participationsUser32,
        SEED_IDS.user.participationsUser33,
        SEED_IDS.user.participationsUser34,
        SEED_IDS.user.participationsUser35,
        SEED_IDS.user.participationsUser36,
      ];
      {
        const rows = ids.map((id) => ({
          id,
          name: "Cap User",
          email: `${id}@example.org`,
          emailVerified: true,
        })) satisfies (typeof user.$inferInsert)[];
        await ensureSeedUsers(db, rows);
      }
      {
        const rows = ids.map((id) => ({
          id: randomUUID(),
          userId: id,
          organizationId: host,
          role: ORGANIZATION_ROLES.Participant,
          createdAt: new Date(),
        })) satisfies (typeof member.$inferInsert)[];
        await ensureSeedMemberships(db, rows);
      }
      {
        const rows = ids.map((id) => ({
          userId: id,
          fullName: "Capacity Participant",
        })) satisfies (typeof profiles.$inferInsert)[];
        await ensureSeedProfiles(db, rows);
      }
      {
        const rows = ids.map((id) => ({
          userId: id,
          version: version.id,
          contentHash: version.contentHash,
          answers: '{"accepted":true}',
        })) satisfies (typeof acceptances.$inferInsert)[];
        await ensureSeedAgreementAcceptances(db, rows);
      }
    }
  }
  await ensureParticipationDirectoryScenarios();

  return [
    coordinator,
    candidate,
    unassigned,
    currentAcceptor,
    oldAcceptor,
    mixedUser,
    owner,
    secondAssignee,
    missingAgreement,
    missingProfile,
    SEED_IDS.user.participationsUser10,
    SEED_IDS.user.participationsUser11,
    SEED_IDS.user.participationsUser12,
    SEED_IDS.user.participationsUser13,
    SEED_IDS.user.participationsUser14,
    SEED_IDS.user.participationsUser15,
    SEED_IDS.user.participationsUser16,
    SEED_IDS.user.participationsUser17,
    SEED_IDS.user.participationsUser18,
    SEED_IDS.user.participationsUser19,
    SEED_IDS.user.participationsUser20,
    SEED_IDS.user.participationsUser21,
    SEED_IDS.user.participationsUser22,
    SEED_IDS.user.participationsUser23,
    SEED_IDS.user.participationsUser24,
    SEED_IDS.user.participationsUser25,
    SEED_IDS.user.participationsUser26,
    SEED_IDS.user.participationsUser27,
    SEED_IDS.user.participationsUser28,
    SEED_IDS.user.participationsUser29,
    SEED_IDS.user.participationsUser30,
    SEED_IDS.user.participationsUser31,
    SEED_IDS.user.participationsUser32,
    SEED_IDS.user.participationsUser33,
    SEED_IDS.user.participationsUser34,
    SEED_IDS.user.participationsUser35,
    SEED_IDS.user.participationsUser36,
  ];
}

async function ensureSubmissionRoleUsers(db: SeedDatabase): Promise<string[]> {
  const host = SEED_IDS.organization.submissionRoleHost,
    partner = SEED_IDS.organization.submissionRolePartner;
  const actor = SEED_IDS.user.submissionRoleActor,
    participantUser = SEED_IDS.user.submissionRoleParticipantUser;
  const now = new Date();
  const userIds: string[] = [actor, participantUser];
  const matrixPersonIds: string[] = [
    SEED_IDS.user.submissionUser2,
    SEED_IDS.user.submissionUser3,
    SEED_IDS.user.submissionUser4,
    SEED_IDS.user.submissionUser5,
    SEED_IDS.user.submissionUser6,
    SEED_IDS.user.submissionUser7,
    SEED_IDS.user.submissionUser8,
    SEED_IDS.user.submissionUser9,
    SEED_IDS.user.submissionUser10,
    SEED_IDS.user.submissionUser11,
    SEED_IDS.user.submissionUser12,
    SEED_IDS.user.submissionUser13,
    SEED_IDS.user.submissionUser14,
    SEED_IDS.user.submissionUser15,
  ];
  let matrixPersonIndex = 0;
  for (const side of ["host", "partner"] as const)
    for (const role of [
      ORGANIZATION_ROLES.OrganizationOwner,
      ORGANIZATION_ROLES.OrganizationAdmin,
      ORGANIZATION_ROLES.ProjectCoordinator,
      ORGANIZATION_ROLES.Participant,
    ])
      for (const scope of side === "partner" &&
      (role === ORGANIZATION_ROLES.OrganizationOwner ||
        role === ORGANIZATION_ROLES.OrganizationAdmin)
        ? (["unassigned"] as const)
        : (["assigned", "unassigned"] as const)) {
        const person = matrixPersonIds[matrixPersonIndex++]!;
        userIds.push(person);
        {
          const rows = [
            {
              id: person,
              name: `Submission ${side} ${role} ${scope}`,
              email: `${person}@example.org`,
              emailVerified: true,
            },
          ] satisfies (typeof user.$inferInsert)[];
          await ensureSeedUsers(db, rows);
        }
        {
          const rows = [
            {
              id: createId(),
              userId: person,
              organizationId: side === "host" ? host : partner,
              role,
              createdAt: now,
            },
          ] satisfies (typeof member.$inferInsert)[];
          await ensureSeedMemberships(db, rows);
        }
      }
  return userIds;
}

async function ensureSubmissionScenarios(db: SeedDatabase): Promise<string[]> {
  const host = SEED_IDS.organization.submissionRoleHost,
    partner = SEED_IDS.organization.submissionRolePartner,
    other = SEED_IDS.organization.submissionOther;
  const actor = SEED_IDS.user.submissionRoleActor,
    participantUser = SEED_IDS.user.submissionRoleParticipantUser;
  const [account, alternate] = SUBMISSION_PAYOUT_ACCOUNT_IDS;

  const now = new Date();
  {
    const rows = [
      {
        id: actor,
        name: "Coordinator",
        email: `${actor}@example.org`,
        emailVerified: true,
      },
      {
        id: participantUser,
        name: "Participant",
        email: `${participantUser}@example.org`,
        emailVerified: true,
      },
    ] satisfies (typeof user.$inferInsert)[];
    await ensureSeedUsers(db, rows);
  }
  {
    const rows = [host, partner, other].map((org) => ({
      country: "DE" as const,
      id: org,
      name: `Seed Submission ${org === host ? "Hosting Organization" : org === partner ? "Partner Organization" : "Other Organization"}`,
      slug: org,
      createdAt: now,
    })) satisfies (typeof organization.$inferInsert)[];
    await ensureSeedOrganizations(db, rows);
  }
  {
    const rows = [
      {
        id: randomUUID(),
        userId: actor,
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: participantUser,
        organizationId: host,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: actor,
        organizationId: other,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: actor,
        organizationId: partner,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: randomUUID(),
        userId: participantUser,
        organizationId: partner,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
    ] satisfies (typeof member.$inferInsert)[];
    await ensureSeedMemberships(db, rows);
  }
  {
    const rows = [account, alternate].map((accountId) => ({
      id: accountId,
      organizationId: partner,
      accountHolder: "Partner",
      iban: accountId,
    })) satisfies (typeof accounts.$inferInsert)[];
    await ensureSeedPayoutAccounts(db, rows);
  }

  const userIds = await ensureSubmissionRoleUsers(db);
  const submissionScenarioIds = [
    {
      project: SEED_IDS.project.submissionProject3,
      "second-project": SEED_IDS.project.submissionSecondProject3,
      own: SEED_IDS.partnership.submissionOwn4,
      foreign: SEED_IDS.partnership.submissionForeign2,
      elsewhere: SEED_IDS.partnership.submissionElsewhere2,
      robin: SEED_IDS.participation.submissionParticipation0,
      sam: SEED_IDS.participation.submissionParticipation1,
      outsider: SEED_IDS.participation.submissionParticipation2,
      third: SEED_IDS.participation.submissionParticipation3,
      claim: SEED_IDS.claim.submissionClaim1,
      proof: SEED_IDS.proofDocument.submissionProof2,
    }, // editable
    {
      project: SEED_IDS.project.submissionProject2,
      "second-project": SEED_IDS.project.submissionSecondProject2,
      own: SEED_IDS.partnership.submissionOwn3,
      foreign: SEED_IDS.partnership.submissionForeign1,
      elsewhere: SEED_IDS.partnership.submissionElsewhere3,
      robin: SEED_IDS.participation.submissionParticipation4,
      sam: SEED_IDS.participation.submissionParticipation5,
      outsider: SEED_IDS.participation.submissionParticipation6,
      third: SEED_IDS.participation.submissionParticipation7,
      claim: SEED_IDS.claim.submissionClaim3,
      proof: SEED_IDS.proofDocument.submissionProof3,
    }, // submitted
    {
      project: SEED_IDS.project.submissionProject1,
      "second-project": SEED_IDS.project.submissionSecondProject4,
      own: SEED_IDS.partnership.submissionOwn2,
      foreign: SEED_IDS.partnership.submissionForeign0,
      elsewhere: SEED_IDS.partnership.submissionElsewhere1,
      robin: SEED_IDS.participation.submissionParticipation8,
      sam: SEED_IDS.participation.submissionParticipation9,
      outsider: SEED_IDS.participation.submissionParticipation10,
      third: SEED_IDS.participation.submissionParticipation11,
      claim: SEED_IDS.claim.submissionClaim4,
      proof: SEED_IDS.proofDocument.submissionProof4,
    }, // rejected
    {
      project: SEED_IDS.project.submissionProject0,
      "second-project": SEED_IDS.project.submissionSecondProject5,
      own: SEED_IDS.partnership.submissionOwn1,
      foreign: SEED_IDS.partnership.submissionForeign5,
      elsewhere: SEED_IDS.partnership.submissionElsewhere0,
      robin: SEED_IDS.participation.submissionParticipation12,
      sam: SEED_IDS.participation.submissionParticipation13,
      outsider: SEED_IDS.participation.submissionParticipation14,
      third: SEED_IDS.participation.submissionParticipation15,
      claim: SEED_IDS.claim.submissionClaim0,
      proof: SEED_IDS.proofDocument.submissionProof1,
    }, // approved
    {
      project: SEED_IDS.project.submissionProject5,
      "second-project": SEED_IDS.project.submissionSecondProject1,
      own: SEED_IDS.partnership.submissionOwn5,
      foreign: SEED_IDS.partnership.submissionForeign4,
      elsewhere: SEED_IDS.partnership.submissionElsewhere5,
      robin: SEED_IDS.participation.submissionParticipation16,
      sam: SEED_IDS.participation.submissionParticipation17,
      outsider: SEED_IDS.participation.submissionParticipation18,
      third: SEED_IDS.participation.submissionParticipation19,
      claim: SEED_IDS.claim.submissionClaim5,
      proof: SEED_IDS.proofDocument.submissionProof0,
    }, // paid
    {
      project: SEED_IDS.project.submissionProject4,
      "second-project": SEED_IDS.project.submissionSecondProject0,
      own: SEED_IDS.partnership.submissionOwn0,
      foreign: SEED_IDS.partnership.submissionForeign3,
      elsewhere: SEED_IDS.partnership.submissionElsewhere4,
      robin: SEED_IDS.participation.submissionParticipation20,
      sam: SEED_IDS.participation.submissionParticipation21,
      outsider: SEED_IDS.participation.submissionParticipation22,
      third: SEED_IDS.participation.submissionParticipation23,
      claim: SEED_IDS.claim.submissionClaim2,
      proof: SEED_IDS.proofDocument.submissionProof5,
    }, // correction
  ] as const;
  const submissionScenarioNames = [
    "editable",
    "submitted",
    "rejected",
    "approved",
    "paid",
    "correction",
  ] as const;
  for (const [scenarioIndex, name] of submissionScenarioNames.entries()) {
    const scenarioParts = submissionScenarioIds[scenarioIndex]!;
    const project = scenarioParts.project,
      secondProject = scenarioParts["second-project"],
      own = scenarioParts.own,
      foreign = scenarioParts.foreign,
      elsewhere = scenarioParts.elsewhere;
    const robin = scenarioParts.robin,
      sam = scenarioParts.sam,
      outsider = scenarioParts.outsider,
      third = scenarioParts.third;
    {
      const rows = [
        {
          id: project,
          name: `Seed Submission Project ${name}`,
          startDate: new Date("2024-04-01T00:00:00.000Z"),
          endDate: new Date("2024-04-03T00:00:00.000Z"),
          location: "Riga",
          country: "LV",
          organizationId: host,
        },
      ] satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        {
          id: secondProject,
          name: `Seed Other Submission Project ${name}`,
          startDate: new Date("2024-04-01T00:00:00.000Z"),
          endDate: new Date("2024-04-03T00:00:00.000Z"),
          location: "Riga",
          country: "LV",
          organizationId: host,
        },
      ] satisfies (typeof projects.$inferInsert)[];
      await ensureSeedProjects(db, rows);
    }
    {
      const rows = [
        { projectId: project, userId: actor },
        { projectId: secondProject, userId: actor },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
        { id: elsewhere, projectId: secondProject, organizationId: partner },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: actor },
        { partnershipId: elsewhere, userId: actor },
        { partnershipId: own, userId: participantUser },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    {
      const rows = [
        {
          id: robin,
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Robin",
        },
        {
          id: sam,
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Sam",
        },
        {
          id: outsider,
          projectId: project,
          representedOrganizationId: other,
          displayName: "Outsider",
        },
        {
          id: third,
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Third",
        },
      ] satisfies (typeof participants.$inferInsert)[];
      await ensureSeedParticipations(db, rows);
    }

    {
      const rows = [
        { projectId: project, userId: SEED_IDS.user.submissionUser2 },
        { projectId: project, userId: SEED_IDS.user.submissionUser4 },
        { projectId: project, userId: SEED_IDS.user.submissionUser6 },
        { projectId: project, userId: SEED_IDS.user.submissionUser8 },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: SEED_IDS.user.submissionUser12 },
        { partnershipId: own, userId: SEED_IDS.user.submissionUser14 },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    const claimId = scenarioParts.claim;
    {
      const rows = [
        {
          id: claimId,
          partnershipId: own,
          status: name === "correction" ? "correction_requested" : name,
          approvedAmountEur:
            name === "editable"
              ? null
              : name === "correction"
                ? "101.01"
                : "100.00",
        },
      ] satisfies (typeof claims.$inferInsert)[];
      await ensureSeedClaimsByPartnership(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, payoutAccountId: account },
      ] satisfies (typeof selections.$inferInsert)[];
      await ensureSeedPayoutSelections(db, rows);
    }
    {
      const rows = [
        {
          id: scenarioParts.proof,
          claimId,
          fileReference: `seed/submission/${name}/proof`,
          originalFileName: "proof.pdf",
          mediaType: "application/pdf",
          byteSize: 1,
          checksum: "synthetic-seed-proof",
        },
      ] satisfies (typeof documents.$inferInsert)[];
      await ensureSeedProofDocuments(db, rows);
    }
    if (name === "correction") {
      const rows = [
        {
          id: SEED_IDS.claimHistory.submissionId,
          claimId,
          eventType: "submitted",
          actorUserId: actor,
          occurredAt: now,
        },
      ] satisfies (typeof history.$inferInsert)[];
      await ensureSeedClaimHistory(db, rows);
    }
  }
  return userIds;
}

/** The sole seed entrypoint calls this builder; it has no environment/CLI path. */
export async function ensureCostTrackerScenarios(
  db: SeedDatabase,
): Promise<string[]> {
  const submissionUserIds = await ensureSubmissionScenarios(db);
  const participationUserIds = await ensureParticipationScenarios(db);
  const projectUserIds = await ensureProjectScenarios(db);
  const setupLinkUserIds = await ensureSetupLinkScenarios(db);
  const journeyUserIds = await ensureJourneyScenarios(db);
  const partnershipUserIds = await ensurePartnershipScenarios(db);
  const entitySearchUserIds = await ensureEntitySearchScenario(db);
  await ensureClaimScenarios(db);
  await ensureCostScenarios(db);
  await ensureLockedCostScenario(db);
  await ensureOnboardingProgressScenario(db);
  await ensureExpiredOnboardingProgressScenario(db);
  return [
    ...submissionUserIds,
    ...participationUserIds,
    ...projectUserIds,
    ...setupLinkUserIds,
    ...journeyUserIds,
    ...partnershipUserIds,
    ...entitySearchUserIds,
    SEED_IDS.user.claimCoordinator,
    SEED_IDS.user.claimParticipant,
    SEED_IDS.user.claimOwner,
    SEED_IDS.user.costCoordinator,
    SEED_IDS.user.costParticipantUser,
    SEED_IDS.user.onboardingCoordinator,
    SEED_IDS.user.onboardingJoined,
    SEED_IDS.user.onboardingPending,
    SEED_IDS.user.onboardingRevoked,
    SEED_IDS.user.onboardingOutsider,
  ];
}
