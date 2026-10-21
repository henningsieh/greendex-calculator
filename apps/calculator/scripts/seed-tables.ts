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
import { and, eq, inArray, or } from "drizzle-orm";

import type { SeedDatabase } from "./seed";

export async function ensureSeedUsers(
  db: SeedDatabase,
  rows: (typeof user.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(user)
    .where(
      inArray(
        user.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length) await db.insert(user).values(missing).onConflictDoNothing();
}

export async function ensureSeedOrganizations(
  db: SeedDatabase,
  rows: (typeof organization.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(organization)
    .where(
      inArray(
        organization.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(organization).values(missing).onConflictDoNothing();
}

export async function ensureSeedMemberships(
  db: SeedDatabase,
  rows: (typeof member.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(member)
    .where(
      or(
        ...rows.map((row) =>
          and(
            eq(member.organizationId, row.organizationId),
            eq(member.userId, row.userId),
          ),
        ),
      ),
    );
  const existingKeys = new Set(
    existing.map((saved) => JSON.stringify([saved.organizationId, saved.userId])),
  );
  const missing = rows.filter(
    (row) => !existingKeys.has(JSON.stringify([row.organizationId, row.userId])),
  );
  if (missing.length)
    await db.insert(member).values(missing).onConflictDoNothing();
}

export async function ensureSeedProjects(
  db: SeedDatabase,
  rows: (typeof projects.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(projects)
    .where(
      inArray(
        projects.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(projects).values(missing).onConflictDoNothing();
}

export async function ensureSeedHostAssignments(
  db: SeedDatabase,
  rows: (typeof hostAssignments.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(hostAssignments)
    .where(
      or(
        ...rows.map((row) =>
          and(
            eq(hostAssignments.projectId, row.projectId),
            eq(hostAssignments.userId, row.userId),
          ),
        ),
      ),
    );
  const existingKeys = new Set(
    existing.map((saved) => JSON.stringify([saved.projectId, saved.userId])),
  );
  const missing = rows.filter(
    (row) => !existingKeys.has(JSON.stringify([row.projectId, row.userId])),
  );
  if (missing.length)
    await db.insert(hostAssignments).values(missing).onConflictDoNothing();
}

export async function ensureSeedPartnerships(
  db: SeedDatabase,
  rows: (typeof partnerships.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(partnerships)
    .where(
      inArray(
        partnerships.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(partnerships).values(missing).onConflictDoNothing();
}

export async function ensureSeedPartnerAssignments(
  db: SeedDatabase,
  rows: (typeof assignments.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(assignments)
    .where(
      or(
        ...rows.map((row) =>
          and(
            eq(assignments.partnershipId, row.partnershipId),
            eq(assignments.userId, row.userId),
          ),
        ),
      ),
    );
  const existingKeys = new Set(
    existing.map((saved) => JSON.stringify([saved.partnershipId, saved.userId])),
  );
  const missing = rows.filter(
    (row) => !existingKeys.has(JSON.stringify([row.partnershipId, row.userId])),
  );
  if (missing.length)
    await db.insert(assignments).values(missing).onConflictDoNothing();
}

export async function ensureSeedPayoutAccounts(
  db: SeedDatabase,
  rows: (typeof accounts.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(accounts)
    .where(
      inArray(
        accounts.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(accounts).values(missing).onConflictDoNothing();
}

export async function ensureSeedClaims(
  db: SeedDatabase,
  rows: (typeof claims.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(claims)
    .where(
      inArray(
        claims.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(claims).values(missing).onConflictDoNothing();
}

export async function ensureSeedParticipations(
  db: SeedDatabase,
  rows: (typeof participants.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(participants)
    .where(
      inArray(
        participants.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(participants).values(missing).onConflictDoNothing();
}

export async function ensureSeedProofDocuments(
  db: SeedDatabase,
  rows: (typeof documents.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(documents)
    .where(
      inArray(
        documents.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(documents).values(missing).onConflictDoNothing();
}

export async function ensureSeedTravelCostEntries(
  db: SeedDatabase,
  rows: (typeof entries.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(entries)
    .where(
      inArray(
        entries.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(entries).values(missing).onConflictDoNothing();
}

export async function ensureSeedCostAllocations(
  db: SeedDatabase,
  rows: (typeof allocations.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(allocations)
    .where(
      or(
        ...rows.map((row) =>
          and(
            eq(allocations.projectParticipantId, row.projectParticipantId),
            eq(allocations.travelCostEntryId, row.travelCostEntryId),
          ),
        ),
      ),
    );
  const existingKeys = new Set(
    existing.map((saved) =>
      JSON.stringify([saved.projectParticipantId, saved.travelCostEntryId]),
    ),
  );
  const missing = rows.filter(
    (row) =>
      !existingKeys.has(
        JSON.stringify([row.projectParticipantId, row.travelCostEntryId]),
      ),
  );
  if (missing.length)
    await db.insert(allocations).values(missing).onConflictDoNothing();
}

export async function ensureSeedProfiles(
  db: SeedDatabase,
  rows: (typeof profiles.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(profiles)
    .where(
      inArray(
        profiles.userId,
        rows.map((row) => row.userId),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.userId));
  const missing = rows.filter((row) => !existingKeys.has(row.userId));
  if (missing.length)
    await db.insert(profiles).values(missing).onConflictDoNothing();
}

export async function ensureSeedAgreementAcceptances(
  db: SeedDatabase,
  rows: (typeof acceptances.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(acceptances)
    .where(
      or(
        ...rows.map((row) =>
          and(
            eq(acceptances.userId, row.userId),
            eq(acceptances.version, row.version),
          ),
        ),
      ),
    );
  const existingKeys = new Set(
    existing.map((saved) => JSON.stringify([saved.userId, saved.version])),
  );
  const missing = rows.filter(
    (row) => !existingKeys.has(JSON.stringify([row.userId, row.version])),
  );
  if (missing.length)
    await db.insert(acceptances).values(missing).onConflictDoNothing();
}

export async function ensureSeedEntryTokens(
  db: SeedDatabase,
  rows: (typeof entryTokens.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(entryTokens)
    .where(
      inArray(
        entryTokens.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(entryTokens).values(missing).onConflictDoNothing();
}

export async function ensureSeedClaimsByPartnership(
  db: SeedDatabase,
  rows: (typeof claims.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(claims)
    .where(
      inArray(
        claims.partnershipId,
        rows.map((row) => row.partnershipId),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.partnershipId));
  const missing = rows.filter((row) => !existingKeys.has(row.partnershipId));
  if (missing.length)
    await db.insert(claims).values(missing).onConflictDoNothing();
}

export async function ensureSeedJourneysByParticipation(
  db: SeedDatabase,
  rows: (typeof journeys.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(journeys)
    .where(
      inArray(
        journeys.projectParticipantId,
        rows.map((row) => row.projectParticipantId),
      ),
    );
  const existingKeys = new Set(
    existing.map((saved) => saved.projectParticipantId),
  );
  const missing = rows.filter(
    (row) => !existingKeys.has(row.projectParticipantId),
  );
  if (missing.length)
    await db.insert(journeys).values(missing).onConflictDoNothing();
}

export async function ensureSeedPayoutSelections(
  db: SeedDatabase,
  rows: (typeof selections.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(selections)
    .where(
      inArray(
        selections.partnershipId,
        rows.map((row) => row.partnershipId),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.partnershipId));
  const missing = rows.filter((row) => !existingKeys.has(row.partnershipId));
  if (missing.length)
    await db.insert(selections).values(missing).onConflictDoNothing();
}

export async function ensureSeedClaimHistory(
  db: SeedDatabase,
  rows: (typeof history.$inferInsert)[],
): Promise<void> {
  if (!rows.length) return;
  const existing = await db
    .select()
    .from(history)
    .where(
      inArray(
        history.id,
        rows.map((row) => row.id).filter((id): id is string => id !== undefined),
      ),
    );
  const existingKeys = new Set(existing.map((saved) => saved.id));
  const missing = rows.filter(
    (row) => row.id === undefined || !existingKeys.has(row.id),
  );
  if (missing.length)
    await db.insert(history).values(missing).onConflictDoNothing();
}
