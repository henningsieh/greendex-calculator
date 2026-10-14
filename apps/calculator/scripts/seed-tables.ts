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

import type { SeedDatabase } from "./seed";

export async function ensureSeedUsers(
  db: SeedDatabase,
  rows: (typeof user.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(user);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length) await db.insert(user).values(missing).onConflictDoNothing();
}

export async function ensureSeedOrganizations(
  db: SeedDatabase,
  rows: (typeof organization.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(organization);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(organization).values(missing).onConflictDoNothing();
}

export async function ensureSeedMemberships(
  db: SeedDatabase,
  rows: (typeof member.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(member);
  const missing = rows.filter(
    (row) =>
      !existing.some(
        (saved) =>
          saved.organizationId === row.organizationId &&
          saved.userId === row.userId,
      ),
  );
  if (missing.length)
    await db.insert(member).values(missing).onConflictDoNothing();
}

export async function ensureSeedProjects(
  db: SeedDatabase,
  rows: (typeof projects.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(projects);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(projects).values(missing).onConflictDoNothing();
}

export async function ensureSeedHostAssignments(
  db: SeedDatabase,
  rows: (typeof hostAssignments.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(hostAssignments);
  const missing = rows.filter(
    (row) =>
      !existing.some(
        (saved) =>
          saved.projectId === row.projectId && saved.userId === row.userId,
      ),
  );
  if (missing.length)
    await db.insert(hostAssignments).values(missing).onConflictDoNothing();
}

export async function ensureSeedPartnerships(
  db: SeedDatabase,
  rows: (typeof partnerships.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(partnerships);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(partnerships).values(missing).onConflictDoNothing();
}

export async function ensureSeedPartnerAssignments(
  db: SeedDatabase,
  rows: (typeof assignments.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(assignments);
  const missing = rows.filter(
    (row) =>
      !existing.some(
        (saved) =>
          saved.partnershipId === row.partnershipId &&
          saved.userId === row.userId,
      ),
  );
  if (missing.length)
    await db.insert(assignments).values(missing).onConflictDoNothing();
}

export async function ensureSeedPayoutAccounts(
  db: SeedDatabase,
  rows: (typeof accounts.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(accounts);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(accounts).values(missing).onConflictDoNothing();
}

export async function ensureSeedClaims(
  db: SeedDatabase,
  rows: (typeof claims.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(claims);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(claims).values(missing).onConflictDoNothing();
}

export async function ensureSeedParticipations(
  db: SeedDatabase,
  rows: (typeof participants.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(participants);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(participants).values(missing).onConflictDoNothing();
}

export async function ensureSeedProofDocuments(
  db: SeedDatabase,
  rows: (typeof documents.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(documents);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(documents).values(missing).onConflictDoNothing();
}

export async function ensureSeedTravelCostEntries(
  db: SeedDatabase,
  rows: (typeof entries.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(entries);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(entries).values(missing).onConflictDoNothing();
}

export async function ensureSeedCostAllocations(
  db: SeedDatabase,
  rows: (typeof allocations.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(allocations);
  const missing = rows.filter(
    (row) =>
      !existing.some(
        (saved) =>
          saved.projectParticipantId === row.projectParticipantId &&
          saved.travelCostEntryId === row.travelCostEntryId,
      ),
  );
  if (missing.length)
    await db.insert(allocations).values(missing).onConflictDoNothing();
}

export async function ensureSeedProfiles(
  db: SeedDatabase,
  rows: (typeof profiles.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(profiles);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.userId === row.userId),
  );
  if (missing.length)
    await db.insert(profiles).values(missing).onConflictDoNothing();
}

export async function ensureSeedAgreementAcceptances(
  db: SeedDatabase,
  rows: (typeof acceptances.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(acceptances);
  const missing = rows.filter(
    (row) =>
      !existing.some(
        (saved) => saved.userId === row.userId && saved.version === row.version,
      ),
  );
  if (missing.length)
    await db.insert(acceptances).values(missing).onConflictDoNothing();
}

export async function ensureSeedEntryTokens(
  db: SeedDatabase,
  rows: (typeof entryTokens.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(entryTokens);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(entryTokens).values(missing).onConflictDoNothing();
}

export async function ensureSeedClaimsByPartnership(
  db: SeedDatabase,
  rows: (typeof claims.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(claims);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.partnershipId === row.partnershipId),
  );
  if (missing.length)
    await db.insert(claims).values(missing).onConflictDoNothing();
}

export async function ensureSeedJourneysByParticipation(
  db: SeedDatabase,
  rows: (typeof journeys.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(journeys);
  const missing = rows.filter(
    (row) =>
      !existing.some(
        (saved) => saved.projectParticipantId === row.projectParticipantId,
      ),
  );
  if (missing.length)
    await db.insert(journeys).values(missing).onConflictDoNothing();
}

export async function ensureSeedPayoutSelections(
  db: SeedDatabase,
  rows: (typeof selections.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(selections);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.partnershipId === row.partnershipId),
  );
  if (missing.length)
    await db.insert(selections).values(missing).onConflictDoNothing();
}

export async function ensureSeedClaimHistory(
  db: SeedDatabase,
  rows: (typeof history.$inferInsert)[],
): Promise<void> {
  const existing = await db.select().from(history);
  const missing = rows.filter(
    (row) => !existing.some((saved) => saved.id === row.id),
  );
  if (missing.length)
    await db.insert(history).values(missing).onConflictDoNothing();
}
