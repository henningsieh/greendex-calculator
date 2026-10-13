import { createHash, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import {
  hostProjectAssignmentsTable as hostAssignments,
  claimsTable as claims,
  costAllocationsTable as allocations,
  partnershipPayoutAccountsTable as selections,
  travelCostEntriesTable as entries,
  participantAgreementAcceptancesTable as acceptances,
  participantEntryTokensTable as entryTokens,
  participantProfilesTable as profiles,
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

/** Cost Tracker's canonical scenarios. Domain dates use the fixed 2024 reference
 * calendar; metadata is run-anchored. Inserts converge without overwriting
 * developer changes. Proof Documents are synthetic metadata for mocked storage
 * coverage: seeding never writes a remote object. */
async function ensureClaimScenarios(db: SeedDatabase): Promise<void> {
  // Claims: named Partner authorization and payout scenarios.
  {
    const suffix = "canonical";
    const host = `claim-host-${suffix}`;
    const partner = `claim-partner-${suffix}`;
    const other = `claim-other-${suffix}`;
    const coordinator = `claim-coordinator-${suffix}`;
    const participant = `claim-participant-${suffix}`;
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
      ] satisfies (typeof user.$inferInsert)[];
      const existing = await db.select().from(user);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(user).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(organization);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(organization).values(missing).onConflictDoNothing();
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
      ] satisfies (typeof member.$inferInsert)[];
      const existing = await db.select().from(member);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.organizationId === row.organizationId &&
              saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(member).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(projects);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(projects).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      const existing = await db.select().from(hostAssignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.projectId === row.projectId && saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(hostAssignments).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
      ] satisfies (typeof partnerships.$inferInsert)[];
      const existing = await db.select().from(partnerships);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(partnerships).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
      ] satisfies (typeof assignments.$inferInsert)[];
      const existing = await db.select().from(assignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.partnershipId === row.partnershipId &&
              saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(assignments).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(accounts);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(accounts).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(projects);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(projects).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { projectId, userId: "claim-coordinator-canonical" },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      const existing = await db.select().from(hostAssignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.projectId === row.projectId && saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(hostAssignments).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        {
          id: partnershipId,
          projectId,
          organizationId: "claim-partner-canonical",
        },
      ] satisfies (typeof partnerships.$inferInsert)[];
      const existing = await db.select().from(partnerships);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(partnerships).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { partnershipId, userId: "claim-coordinator-canonical" },
      ] satisfies (typeof assignments.$inferInsert)[];
      const existing = await db.select().from(assignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.partnershipId === row.partnershipId &&
              saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(assignments).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { id: `claim-${state}-state-canonical`, partnershipId, status },
      ] satisfies (typeof claims.$inferInsert)[];
      const existing = await db.select().from(claims);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(claims).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(user);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(user).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(organization);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(organization).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(member);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.organizationId === row.organizationId &&
              saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(member).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(projects);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(projects).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      const existing = await db.select().from(hostAssignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.projectId === row.projectId && saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(hostAssignments).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
        { id: next, projectId: secondProject, organizationId: partner },
      ] satisfies (typeof partnerships.$inferInsert)[];
      const existing = await db.select().from(partnerships);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(partnerships).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
        { partnershipId: next, userId: coordinator },
      ] satisfies (typeof assignments.$inferInsert)[];
      const existing = await db.select().from(assignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.partnershipId === row.partnershipId &&
              saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(assignments).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(participants);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(participants).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { id: ownClaim, partnershipId: own },
        { id: foreignClaim, partnershipId: foreign },
      ] satisfies (typeof claims.$inferInsert)[];
      const existing = await db.select().from(claims);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(claims).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(documents);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(documents).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(projects);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(projects).values(missing).onConflictDoNothing();
  }
  {
    const rows = [
      { id: partnershipId, projectId, organizationId: "cost-partner-canonical" },
    ] satisfies (typeof partnerships.$inferInsert)[];
    const existing = await db.select().from(partnerships);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(partnerships).values(missing).onConflictDoNothing();
  }
  {
    const rows = [
      { partnershipId, userId: "cost-coordinator-canonical" },
    ] satisfies (typeof assignments.$inferInsert)[];
    const existing = await db.select().from(assignments);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.partnershipId === row.partnershipId &&
            saved.userId === row.userId,
        ),
    );
    if (missing.length > 0)
      await db.insert(assignments).values(missing).onConflictDoNothing();
  }
  {
    const rows = [
      { id: claimId, partnershipId, status: "submitted" },
    ] satisfies (typeof claims.$inferInsert)[];
    const existing = await db.select().from(claims);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(claims).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(participants);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(participants).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(documents);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(documents).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(entries);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(entries).values(missing).onConflictDoNothing();
  }
  {
    const rows = [
      {
        travelCostEntryId: entryId,
        projectParticipantId: participantId,
        amountEur: "10.00",
      },
    ] satisfies (typeof allocations.$inferInsert)[];
    const existing = await db.select().from(allocations);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.travelCostEntryId === row.travelCostEntryId &&
            saved.projectParticipantId === row.projectParticipantId,
        ),
    );
    if (missing.length > 0)
      await db.insert(allocations).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(user);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(user).values(missing).onConflictDoNothing();
    }
    {
      const rows = [host, partner, other].map((id) => ({
        country: "DE" as const,
        id,
        name: id,
        slug: id,
        createdAt: now,
      })) satisfies (typeof organization.$inferInsert)[];
      const existing = await db.select().from(organization);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(organization).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(member);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.organizationId === row.organizationId &&
              saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(member).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(projects);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(projects).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { projectId: project, userId: coordinator },
      ] satisfies (typeof hostAssignments.$inferInsert)[];
      const existing = await db.select().from(hostAssignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.projectId === row.projectId && saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(hostAssignments).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { id: own, projectId: project, organizationId: partner },
        { id: foreign, projectId: project, organizationId: other },
      ] satisfies (typeof partnerships.$inferInsert)[];
      const existing = await db.select().from(partnerships);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(partnerships).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { partnershipId: own, userId: coordinator },
        { partnershipId: own, userId: joined },
      ] satisfies (typeof assignments.$inferInsert)[];
      const existing = await db.select().from(assignments);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.partnershipId === row.partnershipId &&
              saved.userId === row.userId,
          ),
      );
      if (missing.length > 0)
        await db.insert(assignments).values(missing).onConflictDoNothing();
    }
    {
      const rows = [
        { userId: joined, fullName: "Joined" },
        { userId: pending, fullName: "Pending" },
        { userId: outsider, fullName: "Outsider" },
      ] satisfies (typeof profiles.$inferInsert)[];
      const existing = await db.select().from(profiles);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.userId === row.userId),
      );
      if (missing.length > 0)
        await db.insert(profiles).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(acceptances);
      const missing = rows.filter(
        (row) =>
          !existing.some(
            (saved) =>
              saved.userId === row.userId && saved.version === row.version,
          ),
      );
      if (missing.length > 0)
        await db.insert(acceptances).values(missing).onConflictDoNothing();
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
          representedOrganizationId: other,
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
      const existing = await db.select().from(participants);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(participants).values(missing).onConflictDoNothing();
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
      const existing = await db.select().from(entryTokens);
      const missing = rows.filter(
        (row) => !existing.some((saved) => saved.id === row.id),
      );
      if (missing.length > 0)
        await db.insert(entryTokens).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(projects);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(projects).values(missing).onConflictDoNothing();
  }
  {
    const rows = [
      {
        id: partnershipId,
        projectId,
        organizationId: "progress-partner-canonical",
      },
    ] satisfies (typeof partnerships.$inferInsert)[];
    const existing = await db.select().from(partnerships);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(partnerships).values(missing).onConflictDoNothing();
  }
  {
    const rows = [
      { partnershipId, userId: "progress-coordinator-canonical" },
    ] satisfies (typeof assignments.$inferInsert)[];
    const existing = await db.select().from(assignments);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.partnershipId === row.partnershipId &&
            saved.userId === row.userId,
        ),
    );
    if (missing.length > 0)
      await db.insert(assignments).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(participants);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(participants).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(entryTokens);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(entryTokens).values(missing).onConflictDoNothing();
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
  const owned = Array.from({ length: 55 }, (_, index) => ({
    id: `owned-result-${index}-${suffix}`,
    name: `Owned Search ${suffix} ${index.toString().padStart(2, "0")}`,
  }));
  const many = Array.from({ length: 1002 }, (_, index) => ({
    id: `picker-many-${index.toString().padStart(4, "0")}-${suffix}`,
    name: `Many Matches ${suffix}`,
  }));
  {
    const rows = [actor, coordinator, unassignedCoordinator, participant].map(
      (id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        emailVerified: true,
      }),
    ) satisfies (typeof user.$inferInsert)[];
    const existing = await db.select().from(user);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(user).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(organization);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(organization).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(member);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.userId === row.userId &&
            saved.organizationId === row.organizationId,
        ),
    );
    if (missing.length > 0)
      await db.insert(member).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(projects);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(projects).values(missing).onConflictDoNothing();
  }
  {
    const rows = [actor, coordinator].map((userId) => ({
      projectId: assigned,
      userId,
    })) satisfies (typeof hostAssignments.$inferInsert)[];
    const existing = await db.select().from(hostAssignments);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.projectId === row.projectId && saved.userId === row.userId,
        ),
    );
    if (missing.length > 0)
      await db.insert(hostAssignments).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(user);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(user).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(organization);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(organization).values(missing).onConflictDoNothing();
  }
  {
    const rows = [coord, stranger].map((userId) => ({
      id: createId(),
      userId,
      organizationId: visibilityPartner,
      role: ORGANIZATION_ROLES.ProjectCoordinator,
      createdAt: now,
    })) satisfies (typeof member.$inferInsert)[];
    const existing = await db.select().from(member);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.userId === row.userId &&
            saved.organizationId === row.organizationId,
        ),
    );
    if (missing.length > 0)
      await db.insert(member).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(projects);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(projects).values(missing).onConflictDoNothing();
  }
  {
    const rows = [project, foreignProject].map((projectId) => ({
      projectId,
      userId: actor,
    })) satisfies (typeof hostAssignments.$inferInsert)[];
    const existing = await db.select().from(hostAssignments);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.projectId === row.projectId && saved.userId === row.userId,
        ),
    );
    if (missing.length > 0)
      await db.insert(hostAssignments).values(missing).onConflictDoNothing();
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
        projectId: project,
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
    const existing = await db.select().from(partnerships);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(partnerships).values(missing).onConflictDoNothing();
  }
  {
    const rows = [
      { partnershipId: id("visibility-link-own"), userId: coord },
    ] satisfies (typeof assignments.$inferInsert)[];
    const existing = await db.select().from(assignments);
    const missing = rows.filter(
      (row) =>
        !existing.some(
          (saved) =>
            saved.partnershipId === row.partnershipId &&
            saved.userId === row.userId,
        ),
    );
    if (missing.length > 0)
      await db.insert(assignments).values(missing).onConflictDoNothing();
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
    const existing = await db.select().from(participants);
    const missing = rows.filter(
      (row) => !existing.some((saved) => saved.id === row.id),
    );
    if (missing.length > 0)
      await db.insert(participants).values(missing).onConflictDoNothing();
  }
  return [actor, coord, stranger];
}

/** The sole seed entrypoint calls this builder; it has no environment/CLI path. */
export async function ensureCostTrackerScenarios(
  db: SeedDatabase,
): Promise<string[]> {
  const partnershipUserIds = await ensurePartnershipScenarios(db);
  const entitySearchUserIds = await ensureEntitySearchScenario(db);
  await ensureClaimScenarios(db);
  await ensureCostScenarios(db);
  await ensureLockedCostScenario(db);
  await ensureOnboardingProgressScenario(db);
  await ensureExpiredOnboardingProgressScenario(db);
  return [
    ...partnershipUserIds,
    ...entitySearchUserIds,
    "claim-coordinator-canonical",
    "claim-participant-canonical",
    "cost-coordinator-canonical",
    "cost-user-canonical",
    "progress-coordinator-canonical",
    "progress-joined-canonical",
    "progress-pending-canonical",
    "progress-revoked-canonical",
    "progress-outsider-canonical",
  ];
}
