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
  "qi6haiste5mxtl7ubdgkpsty",
  "mimkarr03v5k3znklrhap4c2",
] as const;

/** Cost Tracker's seed scenarios. Domain dates use the fixed 2024 reference
 * calendar; metadata is run-anchored. Inserts converge without overwriting
 * developer changes. Proof Documents are synthetic metadata for mocked storage
 * coverage: seeding never writes a remote object. */
async function ensureClaimScenarios(db: SeedDatabase): Promise<void> {
  // Claims: named Partner authorization and payout scenarios.
  {
    const host = "rvvkpmsj6futf7oh5w6fc8ck";
    const partner = "dgj0r3bf101hos6d7z5tsn61";
    const other = "z8a5atkfd0mf8o8b24eze2ui";
    const coordinator = "nol2sd5ye6kezxgvovi7q5f0";
    const participant = "fhmed3rl5eut51ok5j81rodo";
    const owner = "u58a1drm42imnu2fu4304ajw";
    const project = "rmqohj3gpdw0f9detkz6osga";
    const own = "llej1oakvcdzp64hvqmwyfoi";
    const foreign = "btgjwuma0gvy6a89ovz5w4yx";
    const account = "b0196l2ew39i22ursbv48p3s";
    const secondAccount = "dsj2rua1gdb4x4jvknmymoi4";
    const foreignAccount = "n6i6klamj4v5mxrz6sv78cwf";

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
      project: "bg62wgf3ow4kypv2vobcw1bx",
      partnership: "sf9t6fbzyfur5lqqhn799mf5",
      state: "gac169ru4rlq4ztqg9ox4xaw",
    }, // editable
    {
      project: "o2l8mxic6vtl94n6r7v4sx6f",
      partnership: "kp9h78jm6bn5ob0b82bqlitb",
      state: "x0cywzx7xb4jxjvwhwlveeln",
    }, // submitted
    {
      project: "chhsra4epya74qt51zna4wnw",
      partnership: "l0ttgu2m4ieljze7t4mbzgs1",
      state: "jue0et7q2j2u650yu3x4pt41",
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
          organizationId: "rvvkpmsj6futf7oh5w6fc8ck",
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
        { projectId, userId: "nol2sd5ye6kezxgvovi7q5f0" },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        {
          id: partnershipId,
          projectId,
          organizationId: "dgj0r3bf101hos6d7z5tsn61",
        },
      ] satisfies (typeof partnerships.$inferInsert)[];
      await ensureSeedPartnerships(db, rows);
    }
    {
      const rows = [
        { partnershipId, userId: "nol2sd5ye6kezxgvovi7q5f0" },
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
            payoutAccountId: "dsj2rua1gdb4x4jvknmymoi4",
          })
          .onConflictDoNothing();
      }
    }
  }
}

async function ensureCostScenarios(db: SeedDatabase): Promise<void> {
  // Costs: named Partner authorization and allocation scenarios.
  {
    const host = "c8tzqmrknhg2bov465e90f43",
      partner = "shhydrtzn64k6rorh9k8nx86",
      other = "dl4som7bu1sb6xtdwnyyo63p";
    const coordinator = "fmpfieidsqgfc697xgnvynuw",
      participantUser = "u3pnyfkioeyhxtjks1ukfqag";
    const project = "fu1lgjy9x1bjmbhkgebeg85u",
      secondProject = "sr4b0zq9pv4u0hpz6flne3zy";
    const own = "nyh1okg2p6hf8lwkpurt2wjz",
      foreign = "cjhntjen5ijbchkis4lcu1t5",
      next = "e8qx5ziip9865a2zxshedv3a";
    const first = "qic2agmxqt1h9nzdxxd7ulgm",
      second = "m5dxpif4ebx10jnihqtd98ew",
      third = "je703i9hoq9ly4ii2kjs6d4v";
    const outside = "ev1234of98bh7eek94kefkt1",
      later = "q9rtygav622rqw8e47zxrprh";
    const ownClaim = "lc1i74hr7ioc31ynaxr0vmub",
      foreignClaim = "lv4pnwv30x1ogs6oyi78vmpq";
    const proof = "foilan4c5q220go0d56v5sxx",
      foreignProof = "kf0nrcb8r64b7dnm8m0vq0nf";

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
  const projectId = "ryxgqpmuhb5tubdl3wjm0kpl";
  const partnershipId = "cwudh3bpklwgtvyphhw088ox";
  const claimId = "iodp4iuvgjfjsx0t2fy82zj1";
  const participantId = "fvzf02owu002f9wbrtiydulc";
  const entryId = "t8b7y7gkyi51cjifgwonkns8";
  {
    const rows = [
      {
        id: projectId,
        name: "Seed Submitted Cost Project",
        organizationId: "c8tzqmrknhg2bov465e90f43",
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
        organizationId: "shhydrtzn64k6rorh9k8nx86",
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId, userId: "fmpfieidsqgfc697xgnvynuw" },
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
        representedOrganizationId: "shhydrtzn64k6rorh9k8nx86",
        displayName: "Submitted Cost Participant",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  {
    const rows = [
      {
        id: "ometzoa7791cs0vulc4cwnzh",
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
    const host = "pb8rir6gvcyfqiwaqtnk5xec";
    const partner = "yi608vzxygcikogkqozy7r81";
    const other = "y62zsfzl3timebonzploar04";
    const project = "q1jwax2hm79a3iian3hs5x73";
    const own = "kpy26vaupifiqe3vuu554twi";
    const foreign = "li8ummqf6runglocgx76791z";
    const coordinator = "d430zzfeqqkly5ldh6taz24l";
    const joined = "g2wwxic53eufnwlmzl8vplam";
    const pending = "hz7hq50rox2931x2g6fvnm9x";
    const revoked = "pn2pja15f3t265bd805eiztb";
    const outsider = "y81ceaq0pmv2oqk3wkvqd6xo";
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
          id: "hzjspo0pgd775157t62xn601",
          projectId: project,
          representedOrganizationId: partner,
          userId: joined,
          email: `${joined}@example.org`,
          displayName: "Joined",
        },
        {
          projectId: project,
          id: "kmmag9cniqtn1rijzld8d6qg",
          representedOrganizationId: other,
          userId: outsider,
          email: `${outsider}@example.org`,
          displayName: "Outsider",
        },
        {
          projectId: project,
          id: "j4i5tx5ldiy172qhxzo1zjiw",
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
        id: "umtbxajk2vn5tdm92j50q1lv",
        email: `${pending}@example.org`,
        status: "revoked",
        partnershipId: own,
        issuedAt: new Date(now.getTime() - 10000),
      },
      {
        id: "gxtubvf8mav6w9c8do4fey2f",
        email: `${pending}@example.org`,
        status: "pending",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: "onwrl0w9h1c9h5kjwzqncaen",
        email: `${joined}@example.org`,
        status: "pending",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: "gxlpav73u6x949vj4m82wv45",
        email: `${revoked}@example.org`,
        status: "revoked",
        partnershipId: own,
        issuedAt: now,
      },
      {
        id: "yjkb018277x8670ihswsqhsi",
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
  const projectId = "seryv88axzvwqw9oqb2midp3";
  const partnershipId = "xs8n7xoutdn7nm0fx0pcdge3";
  const joined = "g2wwxic53eufnwlmzl8vplam";
  const pending = "hz7hq50rox2931x2g6fvnm9x";
  {
    const rows = [
      {
        id: projectId,
        name: "Seed Expired Onboarding Progress Project",
        organizationId: "pb8rir6gvcyfqiwaqtnk5xec",
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
        organizationId: "yi608vzxygcikogkqozy7r81",
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId, userId: "d430zzfeqqkly5ldh6taz24l" },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }
  {
    const rows = [
      {
        id: "q2wk2356hxwg4uww2dkje2ri",
        projectId,
        representedOrganizationId: "yi608vzxygcikogkqozy7r81",
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
        id: "p82fofnhve803i7nzxxsdb8d",
        partnershipId,
        projectId,
        email: `${pending}@example.org`,
        status: "pending",
        expiresAt: new Date(0),
        secretHash: createHash("sha256").update(randomUUID()).digest("hex"),
        issuedByUserId: "d430zzfeqqkly5ldh6taz24l",
        issuedAt: new Date("2024-04-01"),
      },
    ] satisfies (typeof entryTokens.$inferInsert)[];
    await ensureSeedEntryTokens(db, rows);
  }
}

async function ensureEntitySearchScenario(db: SeedDatabase): Promise<string[]> {
  const actor = "un3tvw49u59cn2d2a9rop8dl";
  const coordinator = "vos8x8p742eg5c2vj6cry4l5";
  const unassignedCoordinator = "fsvc5hi90jub4no6rp7sk4qt";
  const participant = "w0vmksmuqkmwxcb21weiuzwv";
  const host = "mdeufadg0pokz21yilwj20zh";
  const partner = "jc81zdxvsmhn9amf5cd7b2z8";
  const foreign = "y4l7cye3sx531uc750fe1dfu";
  const assigned = "f1jy9mt5aes134zezdsz9rjh";
  const unassigned = "kf2n2hsv5yt7snkoqahw7012";
  const foreignProject = "c0ayqb71wobyyir727zdy669";
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
        id: "yy0c67wkivbca05auv1830ye",
        name: "Searchable 0",
      },
      {
        id: "j2wgduuhmd5eh4cojqp69xzp",
        name: "Searchable 1",
      },
      {
        id: "qbn0uzj86zkigrxudyaejgmv",
        name: "Searchable 2",
      },
      {
        id: "m3mu9h0xfsz60852s0nld0y5",
        name: "Searchable 3",
      },
      {
        id: "jf5rux41z37qdydcb97zipeu",
        name: "Searchable 4",
      },
      {
        id: "nncgadszm4lpmb08onb65sv7",
        name: "Searchable 5",
      },
      {
        id: "rx44zi293x82pe3eurpfgjli",
        name: "Searchable 6",
      },
      {
        id: "yz3mcrb41afje6cr0dz7dkjs",
        name: "Searchable 7",
      },
      {
        id: "ta5saza94oe6dsbgzp3oneyz",
        name: "Searchable 8",
      },
      {
        id: "h70dzw4s67yq89p7drk41xl5",
        name: "Searchable 9",
      },
      {
        id: "ad0utktcx37zhffpmpaaypfp",
        name: "Searchable 10",
      },
      {
        id: "btiinsn1adtr1j5moxq7l6yk",
        name: "Searchable 11",
      },
      {
        id: "uga7jk013dgum1puajj8vmw5",
        name: "Searchable 12",
      },
      {
        id: "rhxsn23wqetmalzbghjs08nb",
        name: "Searchable 13",
      },
      {
        id: "dux616zf0efcn67decpu7s5x",
        name: "Searchable 14",
      },
      {
        id: "by4tf8repgrmat6p8gpgptaj",
        name: "Searchable 15",
      },
      {
        id: "lydl4eqihkam129oxptfm9wj",
        name: "Searchable 16",
      },
      {
        id: "mlztoxxn3yspsqr8b80y9pi7",
        name: "Searchable 17",
      },
      {
        id: "pzqpxvga1b4lhv9rel98nv32",
        name: "Searchable 18",
      },
      {
        id: "w5wbrjeb5djj09zwshgsbbc9",
        name: "Searchable 19",
      },
      {
        id: "jkhzrd5nf21y36tutuio2mta",
        name: "Searchable 20",
      },
      {
        id: "wteulge3nc0tiassog1pl31r",
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
  const actor = "j3il3a249ve1ptmg95avdlgv";
  const coord = "tqsbp0h0ue0r9f3cucsau6ub";
  const stranger = "c7zd4q31mcarkmy6gj8ohr05";
  const host = "bju7ngb3cgo3pdl2mus0fd1x";
  const foreignHost = "lgiqk6xb0z0fmc5mt2a14c2h";
  const project = "oe5auzlmxm92s21kxpoy2po7";
  const foreignProject = "fjt5l9ol15czsgt9utly4k7i";
  const visibilityHost = "eear0jif4y85mgfp3egcs35t";
  const visibilityPartner = "kbw5d47mmfruysu3eseo7gdk";
  const ownProject = "s72n412ll4eehimlyctpc5u4";
  const otherProject = "ihi2lq4bmhm3k7kwyc4ru3ca";
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
      { id: "qzk86wnb1aey5g57xszuapg7", name: "Assigned Organization" },
      { id: "ru7qr7r69sz7qq4x6a7sfdjk", name: "Removable Organization" },
      { id: "i1vygof18xbl8888j7h6dlxv", name: "Candidate Organization" },
      { id: "pbsbg6s5g2p5cmc2z4kfo03v", name: "Race Organization" },
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
        id: "tevcjre6m3rlqajvg3628nd5",
        projectId: project,
        organizationId: "qzk86wnb1aey5g57xszuapg7",
      },
      {
        id: "ocv8adv9zbl8h4z6xg91hj1b",
        projectId: project,
        organizationId: "ru7qr7r69sz7qq4x6a7sfdjk",
      },
      {
        id: "jxj0285f2i5m3seadecd1i61",
        projectId: ownProject,
        organizationId: visibilityPartner,
      },
      {
        id: "o23snk0g72l78kypo19c5l50",
        projectId: otherProject,
        organizationId: visibilityPartner,
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    await ensureSeedPartnerships(db, rows);
  }
  {
    const rows = [
      { partnershipId: "jxj0285f2i5m3seadecd1i61", userId: coord },
    ] satisfies (typeof assignments.$inferInsert)[];
    await ensureSeedPartnerAssignments(db, rows);
  }
  {
    const rows = [
      {
        id: "s4hxs7xxvi2anxjzg482zo0q",
        projectId: project,
        representedOrganizationId: "qzk86wnb1aey5g57xszuapg7",
        displayName: "Assigned Participant",
      },
    ] satisfies (typeof participants.$inferInsert)[];
    await ensureSeedParticipations(db, rows);
  }
  return [actor, coord, stranger];
}

async function ensureJourneyScenarios(db: SeedDatabase): Promise<string[]> {
  const host = "vx9gyxubkxro0lssmyroxe75",
    partner = "qkygpb1cfcfftazz91qywhrn",
    other = "wqrtqzx3xvvhlhef4f8sau4l";
  const coordinator = "njj93kk5qvwteuv9nptk9ryb",
    participantUser = "b21etdwq5uyop54hnqideez1";
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
      project: "xf74qtwtye2yvslr7o7i8y34",
      "second-project": "w4uxcjyp1go2q461goegu7sv",
      own: "k8gaqhl38tx5zhue5cu8c0st",
      foreign: "v6t5aqxihtula24tlc32f1up",
      next: "jl71gr77c1ugmst6nu65q2n3",
      first: "qsv67xo722qe1b00w0g9qi0o",
      second: "adrq31kxemsrho7vxin91xii",
      outside: "p0i8js1lix8zfh0bhcpz8kcr",
      later: "hcw9cmnc0tjdg95vefyjnkg0",
      claim: "o9nti1yavwwnnttwkmhanht0",
      "legacy-journey": "c6tghowe8qfzyeyo0kz6g18p",
    }, // empty
    {
      project: "s9ehhnzr79666m99ub41kh43",
      "second-project": "mni2rdfwwwjqx8yc1mqr21xb",
      own: "c701ddgerxilbliului1u9bb",
      foreign: "pgqfrrwy26ex3j1ycrqebte9",
      next: "v6t1mcfrjs1h0c1ylgrftdau",
      first: "dnhbmektk3b0kymk67gijh5v",
      second: "c6rzw7mjcfzouw011z6glezo",
      outside: "ce90d9m4ox9pcsa6gnvzeukc",
      later: "mz3gl3c4s9dx05kxpacgab1h",
      claim: "w7nc5wfqxs162560vrkhvod9",
      "legacy-journey": "jn9kcflhyqgeo1e7i9qwfb7v",
    }, // editable
    {
      project: "bow8reilzlhbyt54sgqrgvk8",
      "second-project": "q9fs98msyjij0r2lxyq6dy4k",
      own: "khznv3ljbgkwh3n2kr2fgh50",
      foreign: "zel9micdp5alsz6737o6312j",
      next: "bbfe1u7sdhxnwir6amwkt2tr",
      first: "diwsigd48oyf7giaz6d5m76e",
      second: "weapsdhv2og96fqrblgjr8fw",
      outside: "v28trsvdlxszdjbrslj7jzhe",
      later: "o5mbhevxssukttfo6wdb7t3v",
      claim: "u0odwgoee870pdkinls1ocjb",
      "legacy-journey": "z31d4uuibabgkk4dr46dq8s4",
    }, // legacy
    {
      project: "cbffrmmttjsm36zbb4oj4b0f",
      "second-project": "yjlexiy2l38wyiz6xhp5c5b4",
      own: "wh63gm0yng191ljpdiz23hli",
      foreign: "oistv3g8cqps1mvco4t7ices",
      next: "tykyaixv9rmrjzda5e87hw49",
      first: "vzb305ommel0h8t52pmicku8",
      second: "k1f28nyl1dr0j09felqn1p65",
      outside: "htyn28cu0n1kaqbxu4bb0u60",
      later: "e0oy0n9nhhi7y1yo8iaouhji",
      claim: "y5t65ua0tn4of7agptp47utj",
      "legacy-journey": "zscqghs3a5i3k0vh0v7ievta",
    }, // correction_requested
    {
      project: "i0t9ar9uv1o9ujognpfx03wr",
      "second-project": "xzitoetsc65bzwh7b309b516",
      own: "sgw7akbszqdrsh8hohzdodho",
      foreign: "rrcolgxmdjsscu9258ghxnfe",
      next: "k4xpsu8ewl0kedpdcqqqv72b",
      first: "wq9ldyrvwbjcqoledih3950p",
      second: "wexe0nzi53wk9yxpjcyz2s5b",
      outside: "i2au75gjcz4x8vcc8f1t1avw",
      later: "kuf0x8zecl929omfs7ufyxqb",
      claim: "xlpqdftexv8wks2jdgxu2ux4",
      "legacy-journey": "wq5rfkvgsav08isx0fw6ouri",
    }, // submitted
    {
      project: "jo1xnzk227xvf5rm29q943ev",
      "second-project": "xflmv8mn5mq8bn3hcawrk914",
      own: "t5khvfs2g70vozdznokq1ddx",
      foreign: "nwyc54b8o8ixudydw2e4tow6",
      next: "eku8jl6ur1gz9k2or59jb2tx",
      first: "liixtwq2c9307qgchtzlk4sr",
      second: "q6x77i77fmcghbtj9nfb3fux",
      outside: "cox16dq4rldrb27vhbduncc8",
      later: "uean2qifj1oh7t3ztwyi391n",
      claim: "b52ejmrg1s8pcd05dy0sr2yl",
      "legacy-journey": "nz20q63vpzvgqplkgkjgufpq",
    }, // approved
    {
      project: "t3t443dc4zs057sxm5ns56al",
      "second-project": "junkjnumchq0l9f0zj4ubj4g",
      own: "z0cb8bz1yg5z72pctem0y4cz",
      foreign: "rzur7eq20mjcrrdvr6sj1gcv",
      next: "kmt5a8mrf0l75328sczod5sx",
      first: "tsvkwpwofp3dm6xj1lhl9xqn",
      second: "zjp4m9ssm5eejv3is118vb5a",
      outside: "trcmao8ecc90cbynik4tvdad",
      later: "qugg501l00hypycy2zmiggqr",
      claim: "xnmqjkszxo8e6mz8ke92f9xn",
      "legacy-journey": "wqqe26q4fcd4a8xuabrx1loa",
    }, // rejected
    {
      project: "i3i6jq6eutzj7hblwcuefrp4",
      "second-project": "kzcqabii9g43hw9bn185krqe",
      own: "il0j5p0sugn78sr5uvn58zqv",
      foreign: "v17pgcsxny5fnxgnpmz1792d",
      next: "icq58a7oeek8d088h2mhcwlq",
      first: "bj65q8qk8xu452az5stmvmfn",
      second: "duwh2xksyo3wkffxpy779j9w",
      outside: "z3k1zkw7poy8ccatgqm7ixix",
      later: "y145ox23z8dwq68p4trp0hja",
      claim: "g7wxnm8kklyy3csi5vkhgezd",
      "legacy-journey": "qocftxioovgk2opbfphoins1",
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
  const owner = "sg35qwjva9v00sz5lal6nq5k",
    host = "bv8cv1pccaghkuhwcrnvk87p",
    partner = "xecuissn7aiyiyezm3jfkkc1";
  const project = "k0asthvexnqg5oqseo2q5var",
    otherProject = "rir02zzb2jrzgh8maaa4qh4u";
  const actorIds = [
    owner,
    "e4kdv5xbdh7mdks1s5whazy0",
    "c7lv2v4wbrkggzotjnyn4y11",
    "mh9zd08yyzmjqy3t684r8us9",
    "zdvjl3sxo874wg59dfxp88ti",
    "y4c99qnw9bbaiz4cqqjpm3sb",
    "wy5shwjouvxfad8epx3t966h",
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
        id: "ue3fwothynemqt2ywrszcase",
        name: "Combined coordinator,owner",
      },
      {
        id: "ihfwcjl6hn2epqdid5rgkari",
        name: "Combined owner,participant",
      },
      { id: "taap3sr6rz40ho5ojh4dzrfa", name: "Bind Target" },
      ...["iijo00f0gw3fgf80j6k7jha7", "epdqai2n6zc14d4myu5e3b38"].map((id) => ({
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
        "taap3sr6rz40ho5ojh4dzrfa",
        "iijo00f0gw3fgf80j6k7jha7",
        "epdqai2n6zc14d4myu5e3b38",
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
        organizationId: "ue3fwothynemqt2ywrszcase",
        role: "coordinator,owner",
        createdAt: now,
      },
      {
        id: createId(),
        userId: owner,
        organizationId: "ihfwcjl6hn2epqdid5rgkari",
        role: "owner,participant",
        createdAt: now,
      },
      {
        id: createId(),
        userId: "e4kdv5xbdh7mdks1s5whazy0",
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: createId(),
        userId: "c7lv2v4wbrkggzotjnyn4y11",
        organizationId: host,
        role: ORGANIZATION_ROLES.Participant,
        createdAt: now,
      },
      {
        id: createId(),
        userId: "mh9zd08yyzmjqy3t684r8us9",
        organizationId: host,
        role: ORGANIZATION_ROLES.OrganizationAdmin,
        createdAt: now,
      },
      {
        id: createId(),
        userId: "zdvjl3sxo874wg59dfxp88ti",
        organizationId: host,
        role: ORGANIZATION_ROLES.OrganizationOwner,
        createdAt: now,
      },
      {
        id: createId(),
        userId: "y4c99qnw9bbaiz4cqqjpm3sb",
        organizationId: host,
        role: ORGANIZATION_ROLES.ProjectCoordinator,
        createdAt: now,
      },
      {
        id: createId(),
        userId: "wy5shwjouvxfad8epx3t966h",
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
      { projectId: project, userId: "e4kdv5xbdh7mdks1s5whazy0" },
      { projectId: project, userId: "y4c99qnw9bbaiz4cqqjpm3sb" },
      { projectId: otherProject, userId: "y4c99qnw9bbaiz4cqqjpm3sb" },
    ] satisfies (typeof hostAssignments.$inferInsert)[];
    await ensureSeedHostAssignments(db, rows);
  }
  return actorIds;
}

async function ensureProjectReadinessScenarios(
  db: SeedDatabase,
): Promise<string[]> {
  const userIds: string[] = [];
  const actor = "v3mlz2g5clg8w6ah4ksaxyhs";
  const roles = [
    ORGANIZATION_ROLES.OrganizationOwner,
    ORGANIZATION_ROLES.OrganizationAdmin,
    ORGANIZATION_ROLES.ProjectCoordinator,
    ORGANIZATION_ROLES.Participant,
  ];
  const otherUser = "cl3p954elr9yulp1cmy17bdt";
  const host = "qktk52yxvs7xld84b1tvuoh9";
  const partnerIds = [
    "qoqjcz9wkb9w1cu1jciykycq",
    "xykexg4zokyx3xmwsqoarbne",
    "ci9hh94qpeqiqkdd9r3bh6kv",
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
    "g1uqbte2iau4cota7ihqvsd7",
    "dnaqpymw7b42kf84mh8cjtj4",
    "ht74tddcca1pd57ckhan9jyn",
    "ozww4cen0d8jhtwwf5dpgez5",
    "cy9lv43gdjuksbp2dt3ipdb8",
    "kqndalgew54w27ztll9b2xyh",
    "tq9lhc4pcvh7m23xctv46olw",
    "n9n8i1cvwpmn65lpk3xgk1kh",
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
            eq(row.organizationId, "qktk52yxvs7xld84b1tvuoh9"),
          ),
      });
      if (!membership)
        await db
          .insert(member)
          .values({
            id: createId(),
            userId,
            organizationId: "qktk52yxvs7xld84b1tvuoh9",
            role,
            createdAt: new Date(),
          })
          .onConflictDoNothing();
    }

  const readinessScenarioIds = [
    {
      project: "yw0j74vrct2t82f1rgqtrs4t",
      otherProject: "b5giqvh1tv51xwcsaqeucmke",
      partnershipIds: [
        "l1itj52kn8m7o3wz5qashvpq",
        "cknsvj11ywg2xdo47tcw64e2",
        "woshp5cwqlxrb792vpapk4fy",
      ],
      otherPartnership: "klt10qtlacbwvzzsnm0vhhnp",
      claims: [],
      otherClaim: null,
    }, // empty
    {
      project: "qglynmc75ava9l2jpyyos5cp",
      otherProject: "rcggqd5tiwuyfqcivd6qs2z8",
      partnershipIds: [
        "fkw18w1v3iih7wo0p58xryfo",
        "z8q8zdxqim244ru6105gs70n",
        "rj38qifx3znjd6xlpfd89ng8",
      ],
      otherPartnership: "ijkq778umxq5eqvezq0rjlpf",
      claims: [
        "n73pnnekz3jhqukacbebh928",
        "yf3ok5vimpg44bdrvrebv4k4",
        "wowehcwju4ud724ttsbcn19d",
      ],
      otherClaim: "s573zoe5xtglcmy0uraj128d",
    }, // mixed
    {
      project: "aa8p1gyxlst0fkc06npqp227",
      otherProject: "xj7hc44t4oz92u8cfm6jwoim",
      partnershipIds: [
        "rk7bjf2x68ao6l634fxhkt24",
        "w7nffddjy4tjkl5rvgp14iee",
        "dg31nc77wf70psxu31v63q41",
      ],
      otherPartnership: "i018kq21fjdyq00plv76y4rj",
      claims: ["y4oooedj20iujmy11zcuy7tf", "adi523x12ms0xwd3zfbszkjr"],
      otherClaim: null,
    }, // claimless-partial
    {
      project: "wmexswb9vwkzkemjgb0fuio8",
      otherProject: "mwqzfluw6sf7prnwgqj0b41u",
      partnershipIds: [
        "q13g4ivn0cq2z4veuhqxjf6p",
        "iiqjhvncs4j5w5r9doz69zfs",
        "ba3fd8u58q8iw1w0th11t22e",
      ],
      otherPartnership: "jyz9kwzohqe5wun24i0chbgv",
      claims: [
        "np093j3wdwsj5qtuv6g1kpco",
        "wmdznz75s2uhnl0vhsdxtua8",
        "u281ji80jv5ik1obui3ecpa0",
      ],
      otherClaim: null,
    }, // terminal
    {
      project: "qhj5ysoj4rhmeakufdfcnjha",
      otherProject: "yzj71wxq73ycvvnfvxbq3ibn",
      partnershipIds: [
        "rci5s2vtnlbmze2iejtn0kcc",
        "vq44p86w8b8a7l992zonmk63",
        "rkusxmlozr9utujcob6b7lxj",
      ],
      otherPartnership: "w4bq7pdsunn9duwjwx4x97v2",
      claims: [
        "qjci422lf9laqpvwkmkd4m66",
        "p79whficzo4nwkcgpxfzx48r",
        "ggdjm8yqc921ibvotgbpxtgs",
      ],
      otherClaim: null,
    }, // editable
    {
      project: "mxszdqbyysrail9pf3t8x0f0",
      otherProject: "sz13k9ez22w1avn1gpimre5w",
      partnershipIds: [
        "b4bk95067sgdzg1a16kjypbz",
        "rdjzox5bcah8xrp49ozt30wd",
        "bmefshg635x4ebb5srsvxr78",
      ],
      otherPartnership: "u8tb9xne59fmb86lzvznq3gc",
      claims: [
        "vhk7w3ec7sk3zk9lsh2xkwwj",
        "jtbi7np59qu78bwrfo630ms2",
        "g57ttmnw94zenllezjfqu182",
      ],
      otherClaim: null,
    }, // submitted
    {
      project: "q769rcuir0ts8v9pxxra44hz",
      otherProject: "gk8s7m7qce7egn73x0p3tbmu",
      partnershipIds: [
        "awin69wb41p5xelki8g41vxe",
        "gl6rsfdo814angjd44rh903c",
        "jugzsrf7lqrqjm6ym6tu787w",
      ],
      otherPartnership: "qiajyssswo0wvoitc3thucqk",
      claims: [
        "bxdrpjbsozrolih5iu88xgbl",
        "wk03gohlwh0japrfl5v9iamh",
        "ljhl94znqtws6tf85wpk44y0",
      ],
      otherClaim: null,
    }, // correction_requested
    {
      project: "lw7lrv1wm139zv4qgnzjkao7",
      otherProject: "jl95anvdi1dwvyco65alx4fn",
      partnershipIds: [
        "kq035445vavip4ni7mat3dl8",
        "olqmp3okr9xkyjhngtsae857",
        "x9bsy8s1xb15aty8g5d0zv8p",
      ],
      otherPartnership: "clklgjj0jprwnmzhmproxjzd",
      claims: [
        "ekjea4hn46fiq5mbdck5pst2",
        "g4nbs9bhqherl3eax4d1fopz",
        "ke0bfhdu9exb4apipisclhh4",
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
        [actor, "cy9lv43gdjuksbp2dt3ipdb8", "tq9lhc4pcvh7m23xctv46olw"].map(
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

  const userId = "b9ry2h2ubab6tis178d99t25";
  const hostId = "y3vs6znh5b2au1r8larqs1c8";
  const partnerId = "g8vhp8dyvh25i35adrvuurai";
  const unrelatedId = "dx661hzjhafd0l1uujpcmqfd";
  const projectId = "zfwddd3leo8hgyzf2zqg4ka5";
  const partnershipId = "rxp8zb3d1e4bxxl3iln80q89";
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

  const userId = "jir0evdydult8a6bs4zn9nof";
  const hostId = "d7mj5abcpjlp433v6xveq0xc";
  const foreignHostId = "bm03ehh30ylx3eh32xzlm0li";
  const partnerId = "z7s6cxlk5ix6xpjd45nf0syj";
  const secondPartnerId = "om6l4k0d4454dbi59xs6an9i";
  const unrelatedId = "xpajvpxll5xfoqlql3p1j557";
  const alphaId = "ydkxm6dm66gz2nwqtf4fdogz";
  const betaId = "rcv3v5zci48pu3jvaq6mgse3";
  const climateId = "c6fx5qgb3hzbvggwe5bvldgd";
  const foreignId = "jl6dlxaq2upt0smkcgprnlwk";
  const archivedId = "s7hehnz4kzwdtfoh7sgaia63";
  const generatedIds = [
    "uublntsdq8phzxitszl5pphh",
    "m96f40eqatgg1kjfdf7eit4r",
    "wz481cam626hakr70llfmd9h",
    "d1eexz5h1rsdn133vbre1dzs",
    "cor2ktk9tilsmocpeho1v9xa",
    "vop5splkx8r053t5z04lecml",
    "acq67i27s9wr0afmjyw5k69j",
    "l6u9jegawid2bvoucwjd1fzv",
    "ayuk6zy78uiccgbglrrvljyu",
    "bqo2bj5avlv2r2g5c5u1mjib",
    "r9w50lfsctegegci5olvsfef",
    "z5pbxp6kzwnn121zj9w8189u",
    "viqjik69q2na0xzor8qu93gf",
    "s6awv84wu2u993g1ft9ybzrl",
    "i70ipwb3ane9pyarekayxdp0",
    "wk0agdfuz53imcvvhthk3md1",
    "mi6y9u5x2f8orjzxlrw301op",
    "iu8stqw5gvje2ixvc8457n88",
    "y8drj5vslb777smskw4u4ae8",
    "g0gg06kvv8uteahrgyn620pg",
    "ntkxph615bxqdvsyjvdla9yu",
    "pv0hqiw1aob6astt8bnkrfre",
    "gqrwewm5ce4uiuqwah8cbg67",
    "wp88zd1er5on3wfhng8xduuu",
    "qmklifbkbe8hh4gwcyod79db",
    "dk37thtvz40czzokbqgfhsoz",
  ];
  const partnershipIds = [
    "g8c463xpa602g4fqazlasxwx",
    "sks92zecje0ielxkfcb45xk5",
    "ljl061dqzmh8j88uieasvgr7",
    "tdp3qojgwt7j3emex6i8nz9t",
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
      id: "r4lbmg3rydm9whnikhr8uk39",
      email: "r4lbmg3rydm9whnikhr8uk39@example.org",
    },
    {
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      id: "weegow6wmcg6tmuc0zy0v5s4",
      email: "weegow6wmcg6tmuc0zy0v5s4@example.org",
    },
    {
      role: `${ORGANIZATION_ROLES.Participant},${ORGANIZATION_ROLES.ProjectCoordinator}`,
      id: "u5j0wa97s7pbjl95gb8pju0h",
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

  const userId = "qxc6jkqps0gxemssxs47zjye";
  const hostingOrganizationId = "co377paio4zfz1q1bx4whjkw";
  const partnerOrganizationId = "c12l1bn346722vdnxwfacqbx";
  const unrelatedOrganizationId = "hbsugr6cxctsen7wi6e27r20";
  const projectId = "i4vsksni1dnopm3ja3px21o0";
  const archivedProjectId = "uyjahddmbuz8d8pl10jd3al4";
  const partnershipId = "sq5kowvk1v13377kn53ktu0a";

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

  const coord = "pny51623ftjwk3daduipft1b";
  const stranger = "txknveoktb9jsg1svevjy5yd";
  const host = "j2h6zbf5nluzl5i69updxed9";
  const partner = "k9p9253nsdvi27fggezdv43d";
  const assignedProject = "csxxr9afisxdchhhwad3g3x0";
  const foreignProject = "lciizaru87wgg6zi7vn08d6h";
  const assignedPartnership = "a6abn8gwmau5e291yiku1a2u";
  const foreignPartnership = "vthey54pz5ed9yh7rozxrp1q";

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
  const host = "ycvohy4h4kwieafr6898z8kv";
  const partner = "y1trk5u6aktm6ydac8hkedqw";
  const other = "qm1q3p423syonhiz03hapvo2";
  const coordinator = "yk6wubi79tj3ebwz8yd9x08t";
  const candidate = "qvgz7f1iyhnu7gp1lgxxo0xr";
  const unassigned = "f5i4bmbo7wrhagns7u47kg9i";
  const currentAcceptor = "e7oprdkk819b6w8w68u761vp";
  const oldAcceptor = "yufbvup9o0m6ohqvfhu3fxv2";
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

  const mixedUser = "r8ekilum3fbuhjkmk4hkx9lc",
    owner = "pht5o8jyya3mxpghmyuvllso",
    secondAssignee = "bccrlmqtthueqebjmltfaa3n";
  const missingAgreement = "jwgmepz6x7kuk7n3y5c4cmkx",
    missingProfile = "h6fk257q3py9rhd1rmo60jcz";
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
        id: "kpdndnmev8v79jf62vod9cod",
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
        project: "qy0kb70zdth2bsozm38lyyal",
        own: "buqd9fv4ybyktdek9p64m7jm",
        foreign: "mgz4dfav64uk03sv0h0aa2es",
        rowId: "smgigb9xx99tr8kqpc2w5amk",
        token: null,
        claim: null,
      }, // empty
      {
        project: "niym6uhqv3ab67no8xczirfm",
        own: "qb2kl16qn1hu2ohtrryck7m6",
        foreign: "bxq8dw1qgqr1ado7aj2t5pnh",
        rowId: "sl84191j69cov4uufubu7vr1",
        token: null,
        claim: null,
      }, // email
      {
        project: "jkpjg005rsnnk5wu8vu19l4y",
        own: "ey2yp9oh84cx5ejrx2r34vod",
        foreign: "wuwbqgb048nzlvs9i48hp5ix",
        rowId: "mfbuvifruot8cgf124qosc6w",
        token: null,
        claim: null,
      }, // mixed
      {
        project: "pcejbr6jijv9xku2ryk2cmcg",
        own: "oe0a8sv4vhr01f9m3uj9dqty",
        foreign: "w8dgvghe9vqy9betz3vfnr3c",
        rowId: "tsveb7nvf5usg4bv477yeutt",
        token: null,
        claim: null,
      }, // old-email
      {
        project: "iy7j18jcstttime1pek0v8i6",
        own: "gywyrmx7v842y3173n2m691w",
        foreign: "m85eipkiekpa8p4gjyt14rmr",
        rowId: "xrzxvkbeut3c8pei21jreniq",
        token: "x1k1ow5nlxfpievn0jfkzwmd",
        claim: null,
      }, // foreign-invitation
      {
        project: "u8ttgplmlamal88vzjc71ghm",
        own: "a5uk96o7uxw9eqfdmtdjzcsg",
        foreign: "lm51d924zdrwauk77oy66rwy",
        rowId: "gtdyvctdawbdeo1ta2cspoa2",
        token: "rethju5g600q1rp1n8atpz30",
        claim: null,
      }, // own-invitation
      {
        project: "y2lt460o2dp1zdz3dxtc7az0",
        own: "rrgnrplv6g4wx6etvt0uorp0",
        foreign: "v29eadhvqwogioedzai0lpwi",
        rowId: "ypo125qjxk231y00bi0u4fw2",
        token: null,
        claim: null,
      }, // referenced
      {
        project: "bvddx0xi4oj1umogqqpe1f0z",
        own: "sxpfxlvmh9fqlagl4p9ho9ry",
        foreign: "yid1un03hn6x3snfhh607n7q",
        rowId: "g303rlwxq17ioi7opy96382x",
        token: null,
        claim: "p485wpswqwia8fhgbklnsc01",
      }, // submitted
      {
        project: "k585rjkr7rymcz8wju1oz5ey",
        own: "oh6z766sc05cjol3glr9jyzf",
        foreign: "q4r357azwi64ibqzic5vhy0o",
        rowId: "d8cqmpxlvlyjvvki4gyzl32f",
        token: null,
        claim: "umjodh9mfgj2aee9vkmub98j",
      }, // correction
      {
        project: "a4ol9541l649heo3fdt1sdsq",
        own: "r11iu43lohcnxcs3immmv7q5",
        foreign: "t9ykibatvqqu4ogg8xfkm6jy",
        rowId: "doobmn3bzc1yczqr5z0msqzt",
        token: null,
        claim: null,
      }, // report
      {
        project: "kpygjkont86bnf0papoa4kc8",
        own: "wy0ehkrybncqx4tdjx8hmb8r",
        foreign: "o98tmj5zsnen8q1vw8qpwtgj",
        rowId: "lbkm0mqf8ntop4qrvokn65kv",
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
              id: "os88qkwub98r4wuyue9pud16",
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
              id: "ahz5je5a4nth2jst8wamm1vo",
              projectId: project,
              representedOrganizationId: partner,
              displayName: "Amy Unlinked",
              email: "ut1b4diuxogz62bx2lp6ei4k@example.org",
            },
            {
              id: "g885oopdixosp0sawcpcs3yj",
              projectId: project,
              representedOrganizationId: partner,
              displayName: "Zoe Current",
              userId: currentAcceptor,
              email: "e7oprdkk819b6w8w68u761vp@x.org",
              country: "PT",
            },
            {
              id: "yx2j5gov3tgk9304xs8j4hke",
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
        "l0w9g4n0cbb3wza1tzuu847m",
        "x7t57jutj2wmcih2pvlqjopb",
        "rornt3es93uoymcfmw6md2he",
        "h3ginec0jtgjtp8c9bxpkv2w",
        "faev6x3yt3v8nynvbnvych45",
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
        "t63xd4ofymlmp0al0qxd2vlj",
        "rt2cyydpzmcdo28io5pph2db",
        "zw71b90n0w4ujzk4mlmlbxtd",
        "vy1ehwrj5u3j9lghkmu4qhko",
        "g44wak6rn3hj020u4iw8ineq",
        "uffzylfkiw7nf95obsdhulfg",
        "vckhuuz4zfq95ygfpd3jrty2",
        "f1gw8yvqbz78a5p3tdpjk9x9",
        "vtq7ld6rtni257j6759aizsq",
        "e41azp2t3vgfjb0a7dm2zyfb",
        "d9g7za72p2k227ep6jsgnqsy",
        "hl17dpmivnhjmgscsnokle95",
        "vtxulzkhcck6w40nc0otb0gc",
        "nl8jwh3w9wtq2o25u6hzru9b",
        "k2zdnrt37uygy4psomwvtr3u",
        "yspskow867h74685x073obff",
        "va1eqcn3nj3y9xpknh98rfn4",
        "m2rona103x576xenlao9avtl",
        "j779j3h8zt61xqrqgv2657sf",
        "aqgjsirvhbep9cpu26ui1j83",
        "zm1kpzoo8r265izy4ewoa2ma",
        "mdfm7dbi38yc0wcvnng2rxni",
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
    "l0w9g4n0cbb3wza1tzuu847m",
    "x7t57jutj2wmcih2pvlqjopb",
    "rornt3es93uoymcfmw6md2he",
    "h3ginec0jtgjtp8c9bxpkv2w",
    "faev6x3yt3v8nynvbnvych45",
    "t63xd4ofymlmp0al0qxd2vlj",
    "rt2cyydpzmcdo28io5pph2db",
    "zw71b90n0w4ujzk4mlmlbxtd",
    "vy1ehwrj5u3j9lghkmu4qhko",
    "g44wak6rn3hj020u4iw8ineq",
    "uffzylfkiw7nf95obsdhulfg",
    "vckhuuz4zfq95ygfpd3jrty2",
    "f1gw8yvqbz78a5p3tdpjk9x9",
    "vtq7ld6rtni257j6759aizsq",
    "e41azp2t3vgfjb0a7dm2zyfb",
    "d9g7za72p2k227ep6jsgnqsy",
    "hl17dpmivnhjmgscsnokle95",
    "vtxulzkhcck6w40nc0otb0gc",
    "nl8jwh3w9wtq2o25u6hzru9b",
    "k2zdnrt37uygy4psomwvtr3u",
    "yspskow867h74685x073obff",
    "va1eqcn3nj3y9xpknh98rfn4",
    "m2rona103x576xenlao9avtl",
    "j779j3h8zt61xqrqgv2657sf",
    "aqgjsirvhbep9cpu26ui1j83",
    "zm1kpzoo8r265izy4ewoa2ma",
    "mdfm7dbi38yc0wcvnng2rxni",
  ];
}

async function ensureSubmissionRoleUsers(db: SeedDatabase): Promise<string[]> {
  const host = "rvcaur1km9mca7jjin85kj5m",
    partner = "k2nbcl2vpykg3cxy9f8lz3fl";
  const actor = "uxeutxj67uas64bo7vsey4sr",
    participantUser = "zvs4tq30t3y59whwb4t3knqp";
  const now = new Date();
  const userIds = [actor, participantUser];
  const matrixPersonIds = [
    "gxv18y1pzjnp9c662zti90y7",
    "hhwhygf6tfpm9wspoko2bya8",
    "jkbudjbygh7pecbslkalsh3f",
    "uxyaz38ise25t23otabtuo5t",
    "pdfzs3i83b72k15yw2has3ep",
    "d28e0jt5scc82g7zcop5og4y",
    "k7o2d2mrkj6t3i2if6jx17ox",
    "cjzyp4u7nmguzlna05kw9b4i",
    "lp4bh5itvvwgxhjjfi8lp53i",
    "aac5ia5l456jhxkqtve53kw9",
    "wyiaggmoo57nbdfxsuro92ly",
    "tsqcugbwilakc07141vpx353",
    "nkd49pvzgccbn3c5vj77u935",
    "qj684zdgr4rzy2wn6cf2pkev",
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
  const host = "rvcaur1km9mca7jjin85kj5m",
    partner = "k2nbcl2vpykg3cxy9f8lz3fl",
    other = "gxian35umt6xb38qa9liisys";
  const actor = "uxeutxj67uas64bo7vsey4sr",
    participantUser = "zvs4tq30t3y59whwb4t3knqp";
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
      project: "luh2gfkwy1qlbobg3fhggmz6",
      "second-project": "sx0t9gmel9o0ounwrqpjlla3",
      own: "m2tamlimqmu4p3073psrkb2u",
      foreign: "izdjfs9otehxynijhxhchvb9",
      elsewhere: "ewmn8f8p709ttn877rdihhxk",
      robin: "bc2g6sjjzrlcpdkoqscvq2zh",
      sam: "qgxc4i0fduva2k6dy99xqojt",
      outsider: "da5vgzf6c2h4o4cq4t2vogik",
      third: "f5h3tu1f0i7zonmgdauskb44",
      claim: "ldnogv8cruaflqrhrhbqx1qj",
      proof: "pct9jkyjz1mdy9bgxaw472lc",
    }, // editable
    {
      project: "gsomgvvmjy64i4whn11obpy6",
      "second-project": "pplpkq7blor7o4emvfb2aa5i",
      own: "kk2cafpklhtfyiw2xqjkrdtg",
      foreign: "fzoa5tg6otyfo5742en8gd76",
      elsewhere: "f9wp76921jciuptwaxaimumq",
      robin: "dg5ye1kjmzpabhztlghfkzx2",
      sam: "dhf16yprotcujlx82vs3iuyp",
      outsider: "p4shlsz7b7fqkcz5dbinjakk",
      third: "heutu0d8adspp94g7tsp82k6",
      claim: "sxn9qzymvu56hdd7yy2cxcmr",
      proof: "peem2suosx2y21f8bhu7t9r6",
    }, // submitted
    {
      project: "dbwtgd36aiev0ivcgrf73zlj",
      "second-project": "v05h7mn87olv2ycypdq1uo7z",
      own: "kcpn5m5gvh8765khby63bumd",
      foreign: "bsql0y7jhg7c28qd8pgec8if",
      elsewhere: "csw8oinkqhlr1bl5dyw7ukqo",
      robin: "mng7k5xp3zb04hkxxjmtqznj",
      sam: "pal7vxgj2tmdp0ege6onf0ov",
      outsider: "ev1fb9mfco8ieglzme7lom8g",
      third: "tbzrz76i1eaoqc85u7ysvpx8",
      claim: "t3ssn4t8gxv3a3ggz2n6h5r0",
      proof: "wzbmtsf4n668w43mag53a7tr",
    }, // rejected
    {
      project: "bejcs4i97dof6cmvyb3luodw",
      "second-project": "wzo1te021cpxcj9rq4blcfyg",
      own: "gwpumb113ddri3v28lhms4uy",
      foreign: "q0uzkmbjotnvk5l316qpmxh4",
      elsewhere: "bznqh94nptyxvpk7ybs7fwa6",
      robin: "t4qu1gu6pztjgathhqwrnvud",
      sam: "ew1kqx424ysv4mocn6awopne",
      outsider: "e8009v5lorrjbrlb13f1g52g",
      third: "ogqcxxymvrunn0l92z8bkj04",
      claim: "e7ul210pvegdxxd148vs9u23",
      proof: "jaydcbf1bqenp5nfjez5vaeh",
    }, // approved
    {
      project: "t82gnzi6yaxobn0c8mfcsu0b",
      "second-project": "fdkrcwhb07pvxb7ka561pt3j",
      own: "viop9j0fgg4y8jvvg1afar1v",
      foreign: "pk0bkccpbwbe18a4fywwp74b",
      elsewhere: "x44sqidcb7tj53zpjsk2ej1f",
      robin: "ewx7htm2lf7avxu1ajkzf0u6",
      sam: "ur9n1nv3vv9o8xeyc50bcusj",
      outsider: "jh5o7w7tz6eqzb0aabxdpdr0",
      third: "likedwohbzvrl74w78h8xp9a",
      claim: "xdp911g90lrnw5l14s80m2os",
      proof: "a8xuggw1tmx8j18wmqyybx2t",
    }, // paid
    {
      project: "qjgboeu1c40q7s1934akvqo6",
      "second-project": "ecddy5i6el5prpfepmnw0mrg",
      own: "cpa0z6v9653245f5h1zgzk4s",
      foreign: "l0oo403hnolh3507uuljivvc",
      elsewhere: "peyc17o4u7xlozlevn5be6y2",
      robin: "j31v4ka2dobbgqn1ipghxr63",
      sam: "uh36vnua59x39wqks082aq9k",
      outsider: "am1fvf3tengy5wa2yjfq1asw",
      third: "diwbsj2a33ixrtt05mvdbtsx",
      claim: "m7ucc9h6942vji76np31cwyc",
      proof: "ycrm6550judv7pmx76z110dn",
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
        { projectId: project, userId: "gxv18y1pzjnp9c662zti90y7" },
        { projectId: project, userId: "jkbudjbygh7pecbslkalsh3f" },
        { projectId: project, userId: "pdfzs3i83b72k15yw2has3ep" },
        { projectId: project, userId: "k7o2d2mrkj6t3i2if6jx17ox" },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      await ensureSeedHostAssignments(db, rows);
    }
    {
      const rows = [
        { partnershipId: own, userId: "wyiaggmoo57nbdfxsuro92ly" },
        { partnershipId: own, userId: "nkd49pvzgccbn3c5vj77u935" },
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
          id: "a3xevm2bfj6nd3ku2qz1069w",
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
    "nol2sd5ye6kezxgvovi7q5f0",
    "fhmed3rl5eut51ok5j81rodo",
    "u58a1drm42imnu2fu4304ajw",
    "fmpfieidsqgfc697xgnvynuw",
    "u3pnyfkioeyhxtjks1ukfqag",
    "d430zzfeqqkly5ldh6taz24l",
    "g2wwxic53eufnwlmzl8vplam",
    "hz7hq50rox2931x2g6fvnm9x",
    "pn2pja15f3t265bd805eiztb",
    "y81ceaq0pmv2oqk3wkvqd6xo",
  ];
}
