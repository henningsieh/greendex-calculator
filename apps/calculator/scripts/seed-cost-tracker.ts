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
  "submit-account-canonical",
  "submit-alternate-canonical",
] as const;

/** Cost Tracker's canonical scenarios. Domain dates use the fixed 2024 reference
 * calendar; metadata is run-anchored. Inserts converge without overwriting
 * developer changes. Proof Documents are synthetic metadata for mocked storage
 * coverage: seeding never writes a remote object. */
async function ensurePartnershipIsolationProject(
  db: SeedDatabase,
  sourceProjectId: string,
  partnershipId: string,
): Promise<string> {
  const source = await db.query.projectsTable.findFirst({
    where: (row, { eq }) => eq(row.id, sourceProjectId),
  });
  if (!source) throw new Error(`Missing seed Project ${sourceProjectId}`);
  const projectId = `${partnershipId}-project`;
  await ensureSeedProjects(db, [
    {
      ...source,
      id: projectId,
      name:
        partnershipId === "list-link-alpha-second-canonical"
          ? "Alpha Second Open Workshop"
          : `Seed Partnership Isolation ${partnershipId}`,
    },
  ]);
  const sourceAssignments = await db.query.hostProjectAssignmentsTable.findMany({
    where: (row, { eq }) => eq(row.projectId, sourceProjectId),
  });
  await ensureSeedHostAssignments(
    db,
    sourceAssignments.map(({ userId }) => ({ projectId, userId })),
  );
  return projectId;
}

async function ensureClaimScenarios(db: SeedDatabase): Promise<void> {
  // Claims: named Partner authorization and payout scenarios.
  {
    const suffix = "canonical";
    const host = `claim-host-${suffix}`;
    const partner = `claim-partner-${suffix}`;
    const other = `claim-other-${suffix}`;
    const coordinator = `claim-coordinator-${suffix}`;
    const participant = `claim-participant-${suffix}`;
    const owner = `claim-owner-${suffix}`;
    const project = `claim-project-${suffix}`;
    const own = `claim-own-${suffix}`;
    const foreign = `claim-foreign-${suffix}`;
    const account = `claim-account-${suffix}`;
    const secondAccount = `claim-second-account-${suffix}`;
    const foreignAccount = `claim-foreign-account-${suffix}`;

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
        {
          id: foreign,
          projectId: await ensurePartnershipIsolationProject(
            db,
            project,
            foreign,
          ),
          organizationId: other,
        },
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
  for (const state of ["editable", "submitted", "submitted-selected"] as const) {
    const status = state === "editable" ? "editable" : "submitted";
    const projectId = `claim-${state}-project-canonical`;
    const partnershipId = `claim-${state}-canonical`;
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
          organizationId: "claim-host-canonical",
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
        { projectId, userId: "claim-coordinator-canonical" },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        {
          id: partnershipId,
          projectId,
          organizationId: "claim-partner-canonical",
        },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId, userId: "claim-coordinator-canonical" },
      ] satisfies (typeof assignments.$inferInsert)[];
      await ensureSeedPartnerAssignments(db, rows);
    }
    {
      const rows = [
        { id: `claim-${state}-state-canonical`, partnershipId, status },
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
            payoutAccountId: "claim-second-account-canonical",
          })
          .onConflictDoNothing();
      }
    }
  }
}

async function ensureCostScenarios(db: SeedDatabase): Promise<void> {
  // Costs: named Partner authorization and allocation scenarios.
  {
    const suffix = "canonical";
    const id = (part: string) => `cost-${part}-${suffix}`;
    const host = id("host"),
      partner = id("partner"),
      other = id("other");
    const coordinator = id(ORGANIZATION_ROLES.ProjectCoordinator),
      participantUser = id("user");
    const project = id("project"),
      secondProject = id("second-project");
    const own = id("own"),
      foreign = id("foreign"),
      next = id("next");
    const first = id("first"),
      second = id("second"),
      third = id("third");
    const outside = id("outside"),
      later = id("later");
    const ownClaim = id("claim"),
      foreignClaim = id("foreign-claim");
    const proof = id("proof"),
      foreignProof = id("foreign-proof");

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
        {
          id: foreign,
          projectId: await ensurePartnershipIsolationProject(
            db,
            project,
            foreign,
          ),
          organizationId: other,
        },
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
          representedOrganizationId: host,
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
  const projectId = "cost-locked-project-canonical";
  const partnershipId = "cost-locked-partnership-canonical";
  const claimId = "cost-locked-claim-canonical";
  const participantId = "cost-locked-participant-canonical";
  const entryId = "cost-locked-entry-canonical";
  {
    const rows = [
      {
        id: projectId,
        name: "Seed Submitted Cost Project",
        organizationId: "cost-host-canonical",
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
      { id: partnershipId, projectId, organizationId: "cost-partner-canonical" },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId, userId: "cost-coordinator-canonical" },
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
        representedOrganizationId: "cost-partner-canonical",
        displayName: "Submitted Cost Participant",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  {
    const rows = [
      {
        id: "cost-locked-proof-canonical",
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
    const suffix = "canonical";
    const host = `progress-host-${suffix}`;
    const partner = `progress-partner-${suffix}`;
    const other = `progress-other-${suffix}`;
    const project = `progress-project-${suffix}`;
    const own = `progress-own-${suffix}`;
    const foreign = `progress-foreign-${suffix}`;
    const coordinator = `progress-coordinator-${suffix}`;
    const joined = `progress-joined-${suffix}`;
    const pending = `progress-pending-${suffix}`;
    const revoked = `progress-revoked-${suffix}`;
    const outsider = `progress-outsider-${suffix}`;
    const mail = (key: string) => `${key}-${suffix}@example.org`;
    const version = { id: "fixture-v2", contentHash: "fixture-hash-v2" };

    const now = new Date();
    {
      const rows = [coordinator, joined, pending, revoked, outsider].map(
        (id) => ({
          id,
          name: id,
          email: mail(id),
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
        {
          id: foreign,
          projectId: await ensurePartnershipIsolationProject(
            db,
            project,
            foreign,
          ),
          organizationId: other,
        },
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
          id: "progress-joined-participation-canonical",
          projectId: project,
          representedOrganizationId: partner,
          userId: joined,
          email: mail(joined),
          displayName: "Joined",
        },
        {
          projectId: project,
          id: "progress-outsider-participation-canonical",
          representedOrganizationId: host,
          userId: outsider,
          email: mail(outsider),
          displayName: "Outsider",
        },
        {
          projectId: project,
          id: "progress-unlinked-participation-canonical",
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
        id: `old-${suffix}`,
        email: mail(pending),
        status: "revoked",
        partnershipId: own,
        issuedAt: new Date(now.getTime() - 10000),
      },
      {
        id: `new-${suffix}`,
        email: mail(pending),
        status: "pending",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: `joined-${suffix}`,
        email: mail(joined),
        status: "pending",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: `revoked-${suffix}`,
        email: mail(revoked),
        status: "revoked",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: `outside-${suffix}`,
        email: mail(outsider),
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
  const projectId = "progress-expired-project-canonical";
  const partnershipId = "progress-expired-partnership-canonical";
  const joined = "progress-joined-canonical";
  const pending = "progress-pending-canonical";
  {
    const rows = [
      {
        id: projectId,
        name: "Seed Expired Onboarding Progress Project",
        organizationId: "progress-host-canonical",
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
        organizationId: "progress-partner-canonical",
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId, userId: "progress-coordinator-canonical" },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }
  {
    const rows = [
      {
        id: "progress-expired-joined-participation-canonical",
        projectId,
        representedOrganizationId: "progress-partner-canonical",
        userId: joined,
        email: `${joined}-canonical@example.org`,
        displayName: "Joined with outdated agreement",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  // A pending Invitation expired since the epoch is always expired under the 2024 reference policy.
  {
    const rows = [
      {
        id: "progress-expired-invitation-canonical",
        partnershipId,
        projectId,
        email: `${pending}-canonical@example.org`,
        status: "pending",
        expiresAt: new Date(0),
        secretHash: createHash("sha256").update(randomUUID()).digest("hex"),
        issuedByUserId: "progress-coordinator-canonical",
        issuedAt: new Date("2024-04-01"),
      },
    ] satisfies (typeof entryTokens.$inferInsert)[];
    await ensureSeedEntryTokens(db, rows);
  }
}

async function ensureEntitySearchScenario(db: SeedDatabase): Promise<string[]> {
  const suffix = "canonical";
  const actor = `picker-user-${suffix}`;
  const coordinator = `picker-coordinator-${suffix}`;
  const unassignedCoordinator = `picker-unassigned-coordinator-${suffix}`;
  const participant = `picker-participant-${suffix}`;
  const host = `picker-host-${suffix}`;
  const partner = `picker-partner-${suffix}`;
  const foreign = `picker-foreign-${suffix}`;
  const assigned = `picker-assigned-${suffix}`;
  const unassigned = `picker-unassigned-${suffix}`;
  const foreignProject = `picker-foreign-project-${suffix}`;
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
      { id: host, name: `Host ${suffix}` },
      { id: partner, name: `Partner ${suffix}` },
      { id: foreign, name: `Foreign ${suffix}` },
      ...Array.from({ length: 22 }, (_, index) => ({
        id: `picker-result-${index}-${suffix}`,
        name: `Searchable ${suffix} ${index}`,
      })),
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
    const rows = [assigned, unassigned, foreignProject].map((id) => ({
      id,
      name: `Project ${id}`,
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
  const id = (name: string) => `partnership-${name}-canonical`;
  const actor = id("user");
  const coord = id("visibility-coord");
  const stranger = id("visibility-stranger");
  const host = id("host");
  const foreignHost = id("foreign-host");
  const project = id("project");
  const foreignProject = id("foreign-project");
  const visibilityHost = id("visibility-host");
  const visibilityPartner = id("visibility-partner");
  const ownProject = id("visibility-own");
  const otherProject = id("visibility-other");
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
      { id: id("assigned-org"), name: "Assigned Organization" },
      { id: id("removable-org"), name: "Removable Organization" },
      { id: id("candidate-org"), name: "Candidate Organization" },
      { id: id("race-org"), name: "Race Organization" },
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
        id: id("assigned"),
        projectId: project,
        organizationId: id("assigned-org"),
      },
      {
        id: id("removable"),
        projectId: await ensurePartnershipIsolationProject(
          db,
          project,
          id("removable"),
        ),
        organizationId: id("removable-org"),
      },
      {
        id: id("visibility-link-own"),
        projectId: ownProject,
        organizationId: visibilityPartner,
      },
      {
        id: id("visibility-link-other"),
        projectId: otherProject,
        organizationId: visibilityPartner,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId: id("visibility-link-own"), userId: coord },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }
  {
    const rows = [
      {
        id: id("participation"),
        projectId: project,
        representedOrganizationId: id("assigned-org"),
        displayName: "Assigned Participant",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  return [actor, coord, stranger];
}

async function ensureJourneyScenarios(db: SeedDatabase): Promise<string[]> {
  const id = (part: string) => `journey-${part}-canonical`;
  const host = id("host"),
    partner = id("partner"),
    other = id("other");
  const coordinator = id(ORGANIZATION_ROLES.ProjectCoordinator),
    participantUser = id("user");
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
  for (const name of [
    "empty",
    "editable",
    "legacy",
    "correction_requested",
    "submitted",
    "approved",
    "rejected",
    "paid",
  ] as const) {
    const scenarioId = (part: string) => id(`${name}-${part}`);
    const project = scenarioId("project"),
      secondProject = scenarioId("second-project");
    const own = scenarioId("own"),
      foreign = scenarioId("foreign"),
      next = scenarioId("next");
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
        {
          id: foreign,
          projectId: await ensurePartnershipIsolationProject(
            db,
            project,
            foreign,
          ),
          organizationId: other,
        },
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
          id: scenarioId("first"),
          projectId: project,
          representedOrganizationId: partner,
          displayName: "First",
        },
        {
          id: scenarioId("second"),
          projectId: project,
          representedOrganizationId: partner,
          displayName: "Second",
        },
        {
          id: scenarioId("outside"),
          projectId: project,
          representedOrganizationId: host,
          displayName: "Outside",
        },
        {
          id: scenarioId("later"),
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
          { id: scenarioId("claim"), partnershipId: own, status: name },
        ] satisfies (typeof claims.$inferInsert)[];
        await ensureSeedClaimsByPartnership(db, rows);
      }
    }
    if (["legacy", "submitted", "approved", "rejected", "paid"].includes(name)) {
      {
        const rows = [
          {
            id: scenarioId("legacy-journey"),
            projectParticipantId: scenarioId("first"),
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
  const id = (part: string) => `setup-${part}-canonical`;
  const owner = id("user"),
    host = id("host"),
    partner = id("partner");
  const project = id("project"),
    otherProject = id("other-project");
  const hostRoles = [
    ORGANIZATION_ROLES.ProjectCoordinator,
    ORGANIZATION_ROLES.Participant,
    ORGANIZATION_ROLES.OrganizationAdmin,
    ORGANIZATION_ROLES.OrganizationOwner,
  ];
  const actorIds = [
    owner,
    ...hostRoles.map((role) => id(`host-${role}`)),
    id("assigned-coordinator"),
    id("partner-participant"),
  ];
  const combinedRoles = [
    `${ORGANIZATION_ROLES.ProjectCoordinator},${ORGANIZATION_ROLES.OrganizationOwner}`,
    `${ORGANIZATION_ROLES.OrganizationOwner},${ORGANIZATION_ROLES.Participant}`,
  ];
  const now = new Date();
  {
    const rows = actorIds.map((actorId) => ({
      id: actorId,
      name: `Seed Setup Link User ${actorId}`,
      email:
        actorId === owner
          ? "setup-canonical@example.com"
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
      ...combinedRoles.map((role) => ({
        id: id(`combined-${role}`),
        name: `Combined ${role}`,
      })),
      { id: id("bind"), name: "Bind Target" },
      ...[id("race"), id("rival")].map((id) => ({ id, name: `Race ${id}` })),
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
      ...[host, partner, id("bind"), id("race"), id("rival")].map(
        (organizationId) => ({
          id: createId(),
          userId: owner,
          organizationId,
          role: ORGANIZATION_ROLES.OrganizationOwner,
          createdAt: now,
        }),
      ),
      ...combinedRoles.map((role) => ({
        id: createId(),
        userId: owner,
        organizationId: id(`combined-${role}`),
        role,
        createdAt: now,
      })),
      ...hostRoles.map((role) => ({
        id: createId(),
        userId: id(`host-${role}`),
        organizationId: host,
        role,
        createdAt: now,
      })),
      {
        id: createId(),
        userId: id("assigned-coordinator"),
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: createId(),
        userId: id("partner-participant"),
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
      { projectId: project, userId: id("host-coordinator") },
      { projectId: project, userId: id("assigned-coordinator") },
      { projectId: otherProject, userId: id("assigned-coordinator") },
    ] satisfies (typeof hostAssignments.$inferInsert)[];
    await ensureSeedHostAssignments(db, rows);
  }
  return actorIds;
}

async function ensureProjectReadinessScenarios(
  db: SeedDatabase,
): Promise<string[]> {
  const userIds: string[] = [];
  const suffix = "canonical";
  const id = (name: string) => `readiness-${name}-${suffix}`;
  const actor = id("actor");
  const roles = [
    ORGANIZATION_ROLES.OrganizationOwner,
    ORGANIZATION_ROLES.OrganizationAdmin,
    ORGANIZATION_ROLES.ProjectCoordinator,
    ORGANIZATION_ROLES.Participant,
  ];
  const otherUser = id("other-user");
  const host = id("host");
  const partnerIds = [id("partner-a"), id("partner-b"), id("partner-c")];

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
    const rows = [host, ...partnerIds].map((org) => ({
      country: "DE" as const,
      id: org,
      name: org,
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
  for (const role of roles)
    for (const scope of ["assigned", "unassigned"]) {
      const userId = id(`${scope}-${role}`);
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
          and(eq(row.userId, userId), eq(row.organizationId, id("host"))),
      });
      if (!membership)
        await db
          .insert(member)
          .values({
            id: createId(),
            userId,
            organizationId: id("host"),
            role,
            createdAt: new Date(),
          })
          .onConflictDoNothing();
    }

  for (const name of [
    "empty",
    "mixed",
    "claimless-partial",
    "terminal",
    "editable",
    "submitted",
    "correction_requested",
    "approved",
  ] as const) {
    const projectId = id(`${name}-project`),
      secondProjectId = id(`${name}-other-project`);
    const partnershipIds = ["a", "b", "c"].map((part) =>
        id(`${name}-link-${part}`),
      ),
      otherPartnershipId = id(`${name}-other-link`);
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
        [actor, id("assigned-coordinator"), id("assigned-participant")].map(
          (userId) => ({ projectId, userId }),
        ),
      ) satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      for (const link of partnershipIds.slice(1)) {
        await ensurePartnershipIsolationProject(db, projectId, link);
      }
      const rows = [
        ...partnershipIds.map((link, index) => ({
          id: link,
          projectId: index === 0 ? projectId : `${link}-project`,
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
      const saved = await db.query.claimsTable.findFirst({
        where: (row, { eq }) => eq(row.partnershipId, partnershipId),
      });
      if (!saved)
        await db
          .insert(claims)
          .values({
            id: id(`${name}-claim-${index}`),
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
            id: id(`${name}-other-claim`),
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

  const suffix = "canonical";
  const userId = `detail-user-${suffix}`;
  const hostId = `detail-host-${suffix}`;
  const partnerId = `detail-partner-${suffix}`;
  const unrelatedId = `detail-unrelated-${suffix}`;
  const projectId = `detail-project-${suffix}`;
  const partnershipId = `detail-partnership-${suffix}`;
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

  const suffix = "canonical";
  const userId = `list-user-${suffix}`;
  const hostId = `list-host-${suffix}`;
  const foreignHostId = `list-foreign-host-${suffix}`;
  const partnerId = `list-partner-${suffix}`;
  const secondPartnerId = `list-second-partner-${suffix}`;
  const unrelatedId = `list-unrelated-${suffix}`;
  const alphaId = `list-alpha-${suffix}`;
  const betaId = `list-beta-${suffix}`;
  const climateId = `list-climate-${suffix}`;
  const foreignId = `list-foreign-${suffix}`;
  const archivedId = `list-archived-${suffix}`;
  const generatedIds = Array.from(
    { length: 26 },
    (_, index) => `list-generated-${index.toString().padStart(2, "0")}-${suffix}`,
  );
  const partnershipIds = [
    `list-link-alpha-${suffix}`,
    `list-link-alpha-second-${suffix}`,
    `list-link-beta-${suffix}`,
    `list-link-foreign-${suffix}`,
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
        projectId: await ensurePartnershipIsolationProject(
          db,
          alphaId,
          partnershipIds[1]!,
        ),
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

  for (const role of [
    ORGANIZATION_ROLES.Participant,
    ORGANIZATION_ROLES.ProjectCoordinator,
    `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
  ]) {
    const actorId = `list-${role}-${suffix}`;
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
          email: `list-${role.replace(",", "-")}-${suffix}@example.org`,
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

  const suffix = "canonical";
  const userId = `relationship-user-${suffix}`;
  const hostingOrganizationId = `relationship-host-${suffix}`;
  const partnerOrganizationId = `relationship-partner-${suffix}`;
  const unrelatedOrganizationId = `relationship-unrelated-${suffix}`;
  const projectId = `relationship-project-${suffix}`;
  const archivedProjectId = `relationship-archived-${suffix}`;
  const partnershipId = `relationship-partnership-${suffix}`;

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

  const suffix = "canonical";
  const coord = `discovery-coord-${suffix}`;
  const stranger = `discovery-stranger-${suffix}`;
  const host = `discovery-host-${suffix}`;
  const partner = `discovery-partner-${suffix}`;
  const assignedProject = `discovery-assigned-${suffix}`;
  const foreignProject = `discovery-foreign-${suffix}`;
  const assignedPartnership = `discovery-link-own-${suffix}`;
  const foreignPartnership = `discovery-link-other-${suffix}`;

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
  const s = "canonical";
  const host = `coord-host-${s}`;
  const partner = `coord-partner-${s}`;
  const other = `coord-other-${s}`;
  const coordinator = `coord-actor-${s}`;
  const candidate = `coord-candidate-${s}`;
  const unassigned = `coord-unassigned-${s}`;
  const currentAcceptor = `coord-current-${s}`;
  const oldAcceptor = `coord-old-${s}`;
  const email = `candidate-${s}@example.org`;

  const version = { id: "fixture-v1", contentHash: "fixture-hash" };
  const now = new Date();
  {
    const rows = [
      {
        id: coordinator,
        name: "Coordinator",
        email: `coordinator-${s}@example.org`,
        emailVerified: true,
      },
      { id: candidate, name: "Candidate", email, emailVerified: true },
      { id: unassigned, name: "Unassigned", email: `unassigned-${s}@x.org` },
      { id: currentAcceptor, name: "Current", email: `current-${s}@x.org` },
      { id: oldAcceptor, name: "Old", email: `old-${s}@x.org` },
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

  const mixedUser = `coord-mixed-${s}`,
    owner = `coord-owner-${s}`,
    secondAssignee = `coord-second-assignee-${s}`;
  const missingAgreement = `coord-missing-agreement-${s}`,
    missingProfile = `coord-missing-profile-${s}`;
  {
    const rows = [
      {
        id: mixedUser,
        name: "Mixed",
        email: `MIXED-${s}@EXAMPLE.ORG`,
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
        id: `coord-candidate-partner-membership-${s}`,
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
        {
          id: foreign,
          projectId: await ensurePartnershipIsolationProject(
            db,
            project,
            foreign,
          ),
          organizationId: other,
        },
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
    for (const name of [
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
    ] as const) {
      const project = `coord-${name}-project-${s}`,
        own = `coord-${name}-own-${s}`,
        foreign = `coord-${name}-foreign-${s}`;
      await ensureParticipationProjectPartnerships(name, project, own, foreign);
      const rowId = `coord-${name}-row-${s}`;
      if (name === "email" || name === "mixed" || name === "old-email") {
        {
          const rows = [
            {
              id: rowId,
              projectId: project,
              representedOrganizationId: host,
              displayName: name === "old-email" ? "Earlier email" : "Existing",
              userId: name === "old-email" ? candidate : null,
              email:
                name === "mixed"
                  ? `mixed-${s}@example.org`
                  : name === "old-email"
                    ? `old-${s}@example.org`
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
              id: `coord-${name}-token-${s}`,
              projectId:
                name === "own-invitation" ? project : `${foreign}-project`,
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
              id: `coord-reference-journey-${s}`,
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
              id: `coord-${name}-claim-${s}`,
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
              id: `coord-unjoined-${s}`,
              projectId: project,
              representedOrganizationId: partner,
              displayName: "Amy Unlinked",
              email: `amy-${s}@example.org`,
            },
            {
              id: `coord-current-row-${s}`,
              projectId: project,
              representedOrganizationId: partner,
              displayName: "Zoe Current",
              userId: currentAcceptor,
              email: `current-${s}@x.org`,
              country: "PT",
            },
            {
              id: `coord-old-row-${s}`,
              projectId: project,
              representedOrganizationId: host,
              displayName: "Yan Outdated",
              userId: oldAcceptor,
              email: `old-${s}@x.org`,
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
      const ids = cases.map(({ key }) => `directory-${key}-${s}`);
      {
        const rows = cases.map(({ key, verified }, index) => ({
          id: ids[index]!,
          name: "Directory Candidate",
          email: `directory-${key}-${s}@example.org`,
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
      const ids = Array.from(
        { length: 22 },
        (_, index) => `capacity-${index}-${s}`,
      );
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
    ...["unverified", "no-profile", "stale", "wrong-role", "wrong-org"].map(
      (key) => `directory-${key}-${s}`,
    ),
    ...Array.from({ length: 22 }, (_, index) => `capacity-${index}-${s}`),
  ];
}

async function ensureSubmissionRoleUsers(db: SeedDatabase): Promise<string[]> {
  const id = (part: string) => `submit-${part}-canonical`;
  const host = id("host"),
    partner = id("partner");
  const actor = id("actor"),
    participantUser = id("participant-user");
  const now = new Date();
  const userIds = [actor, participantUser];
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
        const person = id(`matrix-${side}-${role}-${scope}`);
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
  const suffix = "canonical";
  const id = (part: string) => `submit-${part}-${suffix}`;
  const host = id("host"),
    partner = id("partner"),
    other = id("other");
  const actor = id("actor"),
    participantUser = id("participant-user");
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
      name: org,
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
  for (const name of [
    "editable",
    "submitted",
    "rejected",
    "approved",
    "paid",
    "correction",
  ] as const) {
    const scenarioId = (part: string) => id(`${name}-${part}`);
    const project = scenarioId("project"),
      secondProject = scenarioId("second-project"),
      own = scenarioId("own"),
      foreign = scenarioId("foreign"),
      elsewhere = scenarioId("elsewhere");
    const robin = scenarioId("robin"),
      sam = scenarioId("sam"),
      outsider = scenarioId("outsider"),
      third = scenarioId("third");
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
        {
          id: foreign,
          projectId: await ensurePartnershipIsolationProject(
            db,
            project,
            foreign,
          ),
          organizationId: other,
        },
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
          representedOrganizationId: host,
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

    for (const role of [
      ORGANIZATION_ROLES.OrganizationOwner,
      ORGANIZATION_ROLES.OrganizationAdmin,
      ORGANIZATION_ROLES.ProjectCoordinator,
      ORGANIZATION_ROLES.Participant,
    ]) {
      {
        const rows = [
          { projectId: project, userId: id(`matrix-host-${role}-assigned`) },
        ] satisfies (typeof hostAssignments.$inferInsert)[];
        await ensureSeedHostAssignments(db, rows);
      }
      if (
        role === ORGANIZATION_ROLES.ProjectCoordinator ||
        role === ORGANIZATION_ROLES.Participant
      ) {
        const rows = [
          { partnershipId: own, userId: id(`matrix-partner-${role}-assigned`) },
        ] satisfies (typeof assignments.$inferInsert)[];
        await ensureSeedPartnerAssignments(db, rows);
      }
    }
    const claimId = scenarioId("claim");
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
          id: scenarioId("proof"),
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
          id: id("correction-submitted-event"),
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
    "claim-coordinator-canonical",
    "claim-participant-canonical",
    "claim-owner-canonical",
    "cost-coordinator-canonical",
    "cost-user-canonical",
    "progress-coordinator-canonical",
    "progress-joined-canonical",
    "progress-pending-canonical",
    "progress-revoked-canonical",
    "progress-outsider-canonical",
  ];
}
