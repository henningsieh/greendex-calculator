import { createHash, randomUUID } from "node:crypto";

import { ORGANIZATION_ROLES } from "@greendex/auth/permissions";
import {
  invitation,
  member,
  user,
  projectSharedTravelLegsTable as sharedLegs,
} from "@greendex/database/schema";
import { createId } from "@paralleldrive/cuid2";
import { eq, inArray } from "drizzle-orm";

import type { SeedDatabase } from "./seed";
import {
  SEED_READ_ONLY_INVITATION_EXPIRY,
  SEED_REVIEW_SCENARIOS,
} from "./seed-scenarios";
import {
  ensureSeedClaimsByPartnership,
  ensureSeedEntryTokens,
  ensureSeedMemberships,
  ensureSeedOrganizations,
  ensureSeedPartnerships,
  ensureSeedProjects,
  ensureSeedUsers,
} from "./seed-tables";

/** Ordinary read-only preconditions, owned by the canonical seed, not test setup. */
export async function ensureReviewScenarios(
  db: SeedDatabase,
  hostId: string,
  partnerId: string,
  secondPartnerId: string,
  ownerId: string,
  hostingActorEmails: string[],
): Promise<string> {
  const auth = SEED_REVIEW_SCENARIOS.newestMembership;
  await ensureSeedUsers(db, [
    {
      id: auth.userId,
      name: "Seed Newest Membership User",
      email: auth.email,
      emailVerified: true,
    },
  ]);
  await ensureSeedOrganizations(
    db,
    [auth.olderOrganizationId, auth.newestOrganizationId].map((id) => ({
      id,
      slug: id,
      name: `Seed ${id}`,
      country: "DE",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    })),
  );
  await ensureSeedMemberships(
    db,
    [auth.olderOrganizationId, auth.newestOrganizationId].map(
      (organizationId, index) => ({
        id: createId(),
        userId: auth.userId,
        organizationId,
        role: ORGANIZATION_ROLES.OrganizationAdmin,
        createdAt: new Date(
          index === 0 ? "2024-01-01T00:00:00Z" : "2024-01-02T00:00:00Z",
        ),
      }),
    ),
  );
  await ensureSeedProjects(
    db,
    SEED_REVIEW_SCENARIOS.restProjects.map((project) => ({
      ...project,
      organizationId: hostId,
      location: "Berlin",
      country: "DE",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-12-31T00:00:00Z"),
    })),
  );
  const ids = SEED_REVIEW_SCENARIOS.staffInvitations;
  await ensureSeedOrganizations(db, [
    {
      id: ids.organizationId,
      slug: ids.organizationId,
      name: "Seed Staff Invitation Organization",
      country: "DE",
      createdAt: new Date("2024-01-01T00:00:00Z"),
    },
  ]);
  const staffActors = await db
    .select({ id: user.id })
    .from(user)
    .where(inArray(user.email, hostingActorEmails));
  const staffActorIds = new Set([ownerId, ...staffActors.map(({ id }) => id)]);
  const hostingMembers = await db
    .select()
    .from(member)
    .where(eq(member.organizationId, hostId));
  await ensureSeedMemberships(
    db,
    hostingMembers
      .filter(({ userId }) => staffActorIds.has(userId))
      .map((row) => ({
        ...row,
        id: createId(),
        organizationId: ids.organizationId,
        // Older than the main Memberships: staff-read scenarios must not alter
        // the canonical actors' default active Organization at sign-in.
        createdAt: new Date("2023-01-01T00:00:00Z"),
      })),
  );
  const existing = await db.select().from(invitation);
  const rows = [
    {
      organizationId: ids.organizationId,
      email: ids.causeEmail,
      status: "pending",
    },
    {
      organizationId: ids.organizationId,
      email: ids.pendingEmail,
      status: "pending",
    },
    {
      organizationId: partnerId,
      email: ids.foreignEmail,
      status: "pending",
    },
    {
      organizationId: ids.organizationId,
      email: ids.acceptedEmail,
      status: "accepted",
    },
  ].map((row) => ({
    ...row,
    id: createId(),
    role: ORGANIZATION_ROLES.OrganizationAdmin,
    inviterId: ownerId,
    expiresAt: new Date(SEED_READ_ONLY_INVITATION_EXPIRY),
  }));
  const missing = rows.filter(
    (row) =>
      !existing.some(
        (saved) =>
          saved.organizationId === row.organizationId &&
          saved.email === row.email &&
          saved.status === row.status,
      ),
  );
  if (missing.length) await db.insert(invitation).values(missing);
  const sharedTravel = SEED_REVIEW_SCENARIOS.sharedTravelLegProcedures;
  await ensureSeedProjects(db, [
    {
      id: sharedTravel.projectId,
      name: sharedTravel.name,
      organizationId: hostId,
      location: "Berlin",
      country: "DE",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-12-31T00:00:00Z"),
    },
  ]);
  const travel = SEED_REVIEW_SCENARIOS.travelLegManagement;
  await ensureSeedProjects(db, [
    {
      id: travel.projectId,
      name: "Seed Travel Leg Management Project",
      organizationId: hostId,
      location: "Berlin",
      country: "DE",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-12-31T00:00:00Z"),
    },
  ]);
  if (
    !(await db.query.projectSharedTravelLegsTable.findFirst({
      where: eq(sharedLegs.id, travel.legId),
    }))
  )
    await db.insert(sharedLegs).values({
      id: travel.legId,
      projectId: travel.projectId,
      transportEmissionProfile: "bus",
      distanceKm: 75.3,
      description: "Seed Team Event",
      travelDate: new Date("2025-03-10T00:00:00Z"),
    });
  const registration = SEED_REVIEW_SCENARIOS.submittedRegistration;
  await ensureSeedProjects(db, [
    {
      id: registration.projectId,
      name: "Seed Submitted Registration Project",
      organizationId: hostId,
      location: "Berlin",
      country: "DE",
      startDate: new Date("2024-04-01T00:00:00Z"),
      endDate: new Date("2024-04-03T00:00:00Z"),
    },
  ]);
  await ensureSeedPartnerships(db, [
    {
      id: registration.partnershipId,
      projectId: registration.projectId,
      organizationId: secondPartnerId,
    },
  ]);
  await ensureSeedClaimsByPartnership(db, [
    { partnershipId: registration.partnershipId, status: "submitted" },
  ]);
  await ensureSeedEntryTokens(db, [
    {
      id: registration.linkId,
      projectId: registration.projectId,
      partnershipId: registration.partnershipId,
      email: null,
      status: "revoked",
      secretHash: createHash("sha256").update(randomUUID()).digest("hex"),
      expiresAt: null,
      issuedByUserId: ownerId,
    },
  ]);
  return auth.userId;
}
